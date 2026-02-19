/**
 * Heuristic extraction of action items, deadlines, and priority from meeting note text.
 */

import { parseDueDate } from "./dateParser.js";
import type { ExtractedActionItem } from "../todoist/types.js";

const URGENT_PATTERN = /\b(urgent|asap|as soon as possible|blocker|critical|priority 1|p1)\b/i;
const IMPORTANT_PATTERN = /\b(important|soon|priority 2|p2)\b/i;

function inferPriority(line: string): number {
  if (URGENT_PATTERN.test(line)) return 1;
  if (IMPORTANT_PATTERN.test(line)) return 2;
  return 4;
}

/**
 * Extract action items from raw meeting note text.
 * Looks for: bullet points, "Action:", "TODO:", "Follow-up:", numbered items, and inline dates.
 */
export function extractActionItems(text: string): ExtractedActionItem[] {
  if (!text || typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ExtractedActionItem[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const restOfLine = line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "");

    const actionPrefix = /^(action|todo|follow-up|follow up|next step|deliverable):\s*/i.exec(restOfLine);
    const bullet = /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
    const bracket = /^\[[\sx]\]\s+/i.test(line);

    const isAction =
      (actionPrefix && actionPrefix[0].length > 0) ||
      bullet ||
      bracket ||
      (/^[-*•]\s*/.test(line) && line.length > 3);

    if (isAction) {
      let content = restOfLine;
      if (actionPrefix) content = content.slice(actionPrefix[0].length).trim();
      content = content.replace(/^\[[\sx]\]\s*/i, "").trim();
      if (content.length < 2) {
        i++;
        continue;
      }

      const dueDate = parseDueDate(content) ?? parseDueDate(line) ?? null;
      const priority = inferPriority(line);
      const subtasks: string[] = [];
      let description = line;

      // Collect continuation lines (indented or next bullets under this).
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const nextTrim = next.replace(/^\s+/, "");
        const nextBullet = /^[-*•]\s+/.test(nextTrim) || /^\d+[.)]\s+/.test(nextTrim);
        const nextIndent = next.length - nextTrim.length > 0;
        if (nextBullet && nextIndent) {
          subtasks.push(nextTrim.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim());
          description += "\n" + next;
          i++;
        } else if (nextIndent && nextTrim.length > 0 && !/^#|\*\*/.test(nextTrim)) {
          subtasks.push(nextTrim);
          description += "\n" + next;
          i++;
        } else if (next === "" || /^#{1,3}\s/.test(next)) {
          break;
        } else {
          break;
        }
      }

      items.push({
        content: content.slice(0, 500),
        description: description.slice(0, 2000),
        dueDate,
        priority,
        subtasks: subtasks.slice(0, 20),
      });
      continue;
    }

    i++;
  }

  return items;
}
