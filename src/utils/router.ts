/**
 * Smart project/section routing: map task content to the best project/section.
 */

import type { TodoistProject, TodoistSection, RouteResult } from "../todoist/types.js";

type ProjectWithSections = TodoistProject & { sections: TodoistSection[] };

/**
 * Route a task to a project (and optionally section) using hint or keyword matching.
 * Returns project_id and section_id (or null). Falls back to Inbox if no match.
 */
export function routeTask(
  taskContent: string,
  projects: ProjectWithSections[],
  hint?: string
): RouteResult {
  const normalizedContent = taskContent.toLowerCase().trim();
  const words = normalizedContent.split(/\s+/).filter((w) => w.length > 1);

  // 1. If user provided a hint (project name), match it first.
  if (hint && hint.trim()) {
    const hintNorm = hint.trim().toLowerCase();
    const byHint = projects.find(
      (p) =>
        p.name.toLowerCase().includes(hintNorm) ||
        hintNorm.includes(p.name.toLowerCase())
    );
    if (byHint) {
      const sectionId = matchSection(normalizedContent, words, byHint.sections);
      return { projectId: byHint.id, sectionId };
    }
  }

  // 2. Keyword matching: task content vs project and section names.
  let best: { projectId: string; sectionId: string | null; score: number } = {
    projectId: "",
    sectionId: null,
    score: 0,
  };

  for (const project of projects) {
    const projectNameNorm = project.name.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (projectNameNorm.includes(word) || word.length >= 3 && projectNameNorm.includes(word)) {
        score += 1;
      }
    }
    const section = matchSection(normalizedContent, words, project.sections);
    const sectionBonus = section ? 2 : 0;
    const total = score + sectionBonus;
    if (total > best.score) {
      best = {
        projectId: project.id,
        sectionId: section,
        score: total,
      };
    }
  }

  // Common patterns: map keywords to project name substrings.
  const patternProject: Array<{ keywords: string[]; projectSubstr: string }> = [
    { keywords: ["review", "pr", "merge", "code", "dev", "engineering", "sprint"], projectSubstr: "eng" },
    { keywords: ["review", "pr", "merge", "code", "dev"], projectSubstr: "dev" },
    { keywords: ["invoice", "payment", "budget", "finance", "expense"], projectSubstr: "finan" },
    { keywords: ["follow up", "follow-up", "contact", "crm", "client", "customer"], projectSubstr: "crm" },
    { keywords: ["follow up", "follow-up", "contact", "client"], projectSubstr: "work" },
  ];

  for (const { keywords, projectSubstr } of patternProject) {
    const contentHas = keywords.some((k) => normalizedContent.includes(k));
    if (!contentHas) continue;
    const project = projects.find((p) => p.name.toLowerCase().includes(projectSubstr));
    if (project) {
      const sectionId = matchSection(normalizedContent, words, project.sections);
      const score = 2 + (sectionId ? 1 : 0);
      if (score > best.score) {
        best = { projectId: project.id, sectionId, score };
      }
    }
  }

  if (best.projectId) {
    return { projectId: best.projectId, sectionId: best.sectionId };
  }

  // 4. Fall back to Inbox (first project is often Inbox in Todoist, or by name).
  const inbox = projects.find(
    (p) => p.name.toLowerCase() === "inbox" || p.name.toLowerCase().includes("inbox")
  );
  if (inbox) {
    return { projectId: inbox.id, sectionId: null };
  }
  if (projects.length > 0) {
    return { projectId: projects[0].id, sectionId: null };
  }

  return { projectId: "", sectionId: null };
}

function matchSection(
  normalizedContent: string,
  words: string[],
  sections: TodoistSection[]
): string | null {
  for (const section of sections) {
    const nameNorm = section.name.toLowerCase();
    if (normalizedContent.includes(nameNorm)) return section.id;
    if (words.some((w) => w.length >= 2 && nameNorm.includes(w))) return section.id;
  }
  return null;
}
