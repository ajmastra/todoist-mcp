/**
 * MCP server: tool registration and routing.
 * All tool inputs are validated with zod; errors returned as readable MCP responses.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { TodoistClient } from "./todoist/client.js";
import { listProjects } from "./tools/projects.js";
import {
  parseMeetingNotes,
  createTask,
  createSubtasks,
  listTasks,
  updateTask,
  completeTask,
} from "./tools/tasks.js";

const log = (msg: string): void => {
  process.stderr.write(`[todoist-meeting-mcp] ${msg}\n`);
};

export async function createMcpServer(client: TodoistClient): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "todoist-meeting-mcp",
      version: "1.0.0",
    },
    {}
  );

  // parse_meeting_notes
  server.registerTool(
    "parse_meeting_notes",
    {
      description:
        "Parse raw meeting note text to extract action items, decisions, follow-ups, and deadlines; create Todoist tasks with inferred due dates and priorities. Optionally route to a target project by name.",
      inputSchema: z.object({
        raw_notes: z.string().describe("Raw meeting note text to parse"),
        target_project_name: z.string().optional().describe("Optional project name to route all tasks to"),
      }),
    },
    async (args) => {
      try {
        return await parseMeetingNotes(client, args.raw_notes, args.target_project_name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`parse_meeting_notes error: ${msg}`);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // create_task
  server.registerTool(
    "create_task",
    {
      description:
        "Create a single Todoist task. Supports project/section by name, natural language due date, priority 1-4, labels, and optional parent task (subtask).",
      inputSchema: z.object({
        content: z.string().describe("Task title/content"),
        description: z.string().optional(),
        project_name: z.string().optional().describe("Project name (resolved to ID)"),
        section_name: z.string().optional().describe("Section name within the project"),
        due_string: z.string().optional().describe("Natural language due date, e.g. 'by Friday', 'tomorrow'"),
        priority: z.number().min(1).max(4).optional(),
        labels: z.array(z.string()).optional(),
        parent_task_name: z.string().optional().describe("Create as subtask of this task (matched by name)"),
      }),
    },
    async (args) => {
      try {
        return await createTask(client, args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`create_task error: ${msg}`);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // create_subtasks
  server.registerTool(
    "create_subtasks",
    {
      description: "Create multiple subtasks under a parent task. Parent is found by name (fuzzy match).",
      inputSchema: z.object({
        parent_task_name: z.string().describe("Name of the parent task"),
        subtask_strings: z.array(z.string()).describe("Array of subtask content strings"),
      }),
    },
    async (args) => {
      try {
        return await createSubtasks(client, args.parent_task_name, args.subtask_strings);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`create_subtasks error: ${msg}`);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // list_projects
  server.registerTool(
    "list_projects",
    {
      description: "List all Todoist projects with their IDs, names, and section names. Use for routing context.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return await listProjects(client);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`list_projects error: ${msg}`);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // list_tasks
  server.registerTool(
    "list_tasks",
    {
      description: "List tasks with optional filters: project_name, section_name, priority (1-4), due_today.",
      inputSchema: z.object({
        project_name: z.string().optional(),
        section_name: z.string().optional(),
        priority: z.number().min(1).max(4).optional(),
        due_today: z.boolean().optional(),
      }),
    },
    async (args) => {
      try {
        return await listTasks(client, args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`list_tasks error: ${msg}`);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // update_task
  server.registerTool(
    "update_task",
    {
      description:
        "Update a task found by name. Can change content, description, due date, priority, project, or section.",
      inputSchema: z.object({
        task_name: z.string().describe("Task to update (matched by name)"),
        content: z.string().optional(),
        description: z.string().optional(),
        due_string: z.union([z.string(), z.null()]).optional().describe("Natural language date, or null to clear"),
        priority: z.number().min(1).max(4).optional(),
        project_name: z.string().optional(),
        section_name: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        return await updateTask(client, args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`update_task error: ${msg}`);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // complete_task
  server.registerTool(
    "complete_task",
    {
      description: "Mark a task as complete. Task is found by name (fuzzy match).",
      inputSchema: z.object({
        task_name: z.string().describe("Name of the task to complete"),
      }),
    },
    async (args) => {
      try {
        return await completeTask(client, args.task_name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`complete_task error: ${msg}`);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  return server;
}

export async function runServer(client: TodoistClient): Promise<void> {
  const server = await createMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP server running on stdio");
}
