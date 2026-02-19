/**
 * MCP tool: list_projects — list all projects with IDs, names, and section names.
 */

import type { TodoistClient } from "../todoist/client.js";

export async function listProjects(client: TodoistClient): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const projects = await client.getProjects();
  const lines: string[] = ["Projects (ID | Name | Sections):"];
  for (const p of projects) {
    const sectionNames = p.sections.map((s) => s.name).join(", ");
    lines.push(`- ${p.name} (id: ${p.id}) | Sections: ${sectionNames || "(none)"}`);
  }
  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}
