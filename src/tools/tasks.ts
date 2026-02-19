/**
 * MCP tools: create_task, create_subtasks, list_tasks, update_task, complete_task, parse_meeting_notes.
 */

import type { TodoistClient } from "../todoist/client.js";
import { parseDueDate } from "../utils/dateParser.js";
import { routeTask } from "../utils/router.js";
import { extractActionItems } from "../utils/meetingNotes.js";

type TextContent = { type: "text"; text: string };

function text(s: string): TextContent {
  return { type: "text", text: s };
}

export async function parseMeetingNotes(
  client: TodoistClient,
  rawNotes: string,
  targetProjectName?: string
): Promise<{ content: TextContent[] }> {
  const items = extractActionItems(rawNotes);
  const projects = await client.getProjects();
  const summary: string[] = [];
  let created = 0;

  for (const item of items) {
    const { projectId, sectionId } = routeTask(item.content, projects, targetProjectName);
    if (!projectId) continue;
    try {
      const task = await client.createTask({
        content: item.content,
        description: item.description,
        projectId,
        sectionId,
        due: item.dueDate ?? undefined,
        priority: item.priority,
        labels: [],
      });
      created++;
      summary.push(`Created: "${task.content}" in project ${projectId}${sectionId ? `, section ${sectionId}` : ""}`);
      if (item.subtasks.length > 0) {
        for (const sub of item.subtasks) {
          await client.createSubtask(task.id, { content: sub });
        }
        summary[summary.length - 1] += ` (${item.subtasks.length} subtasks)`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.push(`Failed to create "${item.content}": ${msg}`);
    }
  }

  const result = [
    `Parsed ${items.length} action item(s); created ${created} task(s).`,
    ...summary,
  ].join("\n");
  return { content: [text(result)] };
}

export async function createTask(
  client: TodoistClient,
  params: {
    content: string;
    description?: string;
    project_name?: string;
    section_name?: string;
    due_string?: string;
    priority?: number;
    labels?: string[];
    parent_task_name?: string;
  }
): Promise<{ content: TextContent[] }> {
  let projectId: string | undefined;
  let sectionId: string | null = null;
  let parentId: string | null = null;

  if (params.project_name) {
    const project = await client.findProjectByName(params.project_name);
    if (!project) {
      return { content: [text(`Project not found: "${params.project_name}". Check list_projects for names.`)] };
    }
    projectId = project.id;
    if (params.section_name) {
      const section = await client.findSectionByName(project.id, params.section_name);
      if (section) sectionId = section.id;
    }
  }

  if (params.parent_task_name) {
    const parent = await client.findTaskByName(params.parent_task_name);
    if (!parent) {
      return { content: [text(`Parent task not found: "${params.parent_task_name}".`)] };
    }
    parentId = parent.id;
    if (!projectId) projectId = parent.projectId;
  }

  const due = params.due_string ? parseDueDate(params.due_string) : undefined;
  const task = await client.createTask({
    content: params.content,
    description: params.description,
    projectId,
    sectionId: sectionId ?? undefined,
    due: due ? { date: due } : undefined,
    priority: params.priority,
    parentId,
    labels: params.labels,
  });
  return { content: [text(`Created task: "${task.content}" (id: ${task.id})`)] };
}

export async function createSubtasks(
  client: TodoistClient,
  parentTaskName: string,
  subtaskStrings: string[]
): Promise<{ content: TextContent[] }> {
  const parent = await client.findTaskByName(parentTaskName);
  if (!parent) {
    return { content: [text(`Parent task not found: "${parentTaskName}".`)] };
  }
  const created: string[] = [];
  for (const content of subtaskStrings) {
    const t = await client.createSubtask(parent.id, { content: content.trim() });
    created.push(t.content);
  }
  return { content: [text(`Added ${created.length} subtask(s) to "${parent.content}": ${created.join("; ")}`)] };
}

export async function listTasks(
  client: TodoistClient,
  params: {
    project_name?: string;
    section_name?: string;
    priority?: number;
    due_today?: boolean;
  }
): Promise<{ content: TextContent[] }> {
  let projectId: string | undefined;
  let sectionId: string | undefined;
  if (params.project_name) {
    const project = await client.findProjectByName(params.project_name);
    if (!project) {
      return { content: [text(`Project not found: "${params.project_name}".`)] };
    }
    projectId = project.id;
    if (params.section_name) {
      const section = await client.findSectionByName(project.id, params.section_name);
      if (section) sectionId = section.id;
      else {
        return { content: [text(`Section "${params.section_name}" not found in project "${params.project_name}".`)] };
      }
    }
  } else if (params.section_name) {
    const found = await client.findSectionByNameInAnyProject(params.section_name);
    if (!found) {
      return { content: [text(`Section "${params.section_name}" not found in any project.`)] };
    }
    projectId = found.projectId;
    sectionId = found.sectionId;
  }
  const tasks = await client.getTasks({
    projectId,
    sectionId,
    priority: params.priority,
    dueToday: params.due_today,
  });
  const formatDue = (t: { due?: { date?: string; datetime?: string | null } | null }): string => {
    if (!t.due?.date && !t.due?.datetime) return "";
    const dueStr = t.due.datetime ?? t.due.date ?? "";
    return dueStr ? ` (due: ${dueStr})` : "";
  };
  if (sectionId) {
    const filtered = tasks.filter((t) => t.sectionId === sectionId);
    const lines = filtered.map((t) => `- [${t.id}] ${t.content}${formatDue(t)}`);
    return { content: [text(lines.length ? lines.join("\n") : "No tasks found in that section.")] };
  }
  const lines = tasks.map((t) => `- [${t.id}] ${t.content}${formatDue(t)}`);
  return { content: [text(lines.length ? lines.join("\n") : "No tasks found.")] };
}

export async function updateTask(
  client: TodoistClient,
  params: {
    task_name: string;
    content?: string;
    description?: string;
    due_string?: string | null;
    priority?: number;
    project_name?: string;
    section_name?: string;
  }
): Promise<{ content: TextContent[] }> {
  const task = await client.findTaskByName(params.task_name);
  if (!task) {
    return { content: [text(`Task not found: "${params.task_name}".`)] };
  }
  let projectId: string | undefined;
  let sectionId: string | null | undefined;
  if (params.project_name) {
    const project = await client.findProjectByName(params.project_name);
    if (!project) {
      return { content: [text(`Project not found: "${params.project_name}".`)] };
    }
    projectId = project.id;
    sectionId = params.section_name
      ? (await client.findSectionByName(project.id, params.section_name))?.id ?? null
      : undefined;
  }
  let due: string | null | undefined = undefined;
  if (params.due_string === null) due = null;
  else if (params.due_string != null) due = parseDueDate(params.due_string) ?? undefined;
  await client.updateTask(task.id, {
    content: params.content,
    description: params.description,
    due,
    priority: params.priority,
    projectId,
    sectionId,
  });
  return { content: [text(`Updated task: "${params.content ?? task.content}"`)] };
}

export async function completeTask(
  client: TodoistClient,
  taskName: string
): Promise<{ content: TextContent[] }> {
  const task = await client.findTaskByName(taskName);
  if (!task) {
    return { content: [text(`Task not found: "${taskName}".`)] };
  }
  await client.closeTask(task.id);
  return { content: [text(`Completed task: "${task.content}"`)] };
}
