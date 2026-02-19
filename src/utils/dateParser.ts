/**
 * Natural language due date parsing using chrono-node.
 * Returns ISO 8601 date string (YYYY-MM-DD) or null.
 */

import * as chrono from "chrono-node";

/**
 * Parse a date/time expression from text and return an ISO 8601 date string (YYYY-MM-DD).
 * Handles: "by Friday", "next Monday", "tomorrow at 3pm", "end of month", "in 2 weeks".
 * If only a time is mentioned without a date (e.g. "by EOD"), returns today's date.
 */
export function parseDueDate(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const ref = new Date();
  const results = chrono.parse(trimmed, ref, { forwardDate: true });

  if (results.length === 0) {
    // EOD / end of day without date → today
    if (/eod|end of day|e\.o\.d/i.test(trimmed)) {
      return toDateString(ref);
    }
    return null;
  }

  const first = results[0];
  const date = first.date();
  return toDateString(date);
}

/** Format a Date as YYYY-MM-DD. */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
