/**
 * Todoist types and interfaces used across the MCP server.
 * Re-exports and extends types from the official client where needed.
 */

import type { Task, Section } from "@doist/todoist-api-typescript";

/** Project type from Todoist (personal or workspace). */
export type TodoistProject = {
  id: string;
  name: string;
  color?: string;
  isArchived?: boolean;
  isDeleted?: boolean;
  order?: number;
  parentId?: string | null;
  isFavorite?: boolean;
};

/** Section with optional project context. */
export type TodoistSection = {
  id: string;
  name: string;
  projectId: string;
  order: number;
};

/** Task as returned by the API (use official Task type for API calls). */
export type TodoistTask = Task;

/** Re-export Section for API params. */
export type { Section };

/** Result of routing a task to a project/section. */
export type RouteResult = {
  projectId: string;
  sectionId: string | null;
};

/** Filters for listing tasks. */
export type ListTasksFilters = {
  projectId?: string;
  sectionId?: string;
  priority?: number;
  dueToday?: boolean;
};

/** Params for creating a task (name-based; IDs resolved by client). */
export type CreateTaskParams = {
  content: string;
  description?: string;
  projectId?: string;
  sectionId?: string | null;
  due?: string | { date: string };
  priority?: number;
  parentId?: string | null;
  labels?: string[];
};

/** Params for updating a task. */
export type UpdateTaskParams = {
  content?: string;
  description?: string;
  due?: string | { date: string } | null;
  priority?: number;
  projectId?: string;
  sectionId?: string | null;
};

/** Extracted action item from meeting notes. */
export type ExtractedActionItem = {
  content: string;
  description?: string;
  dueDate: string | null;
  priority: number;
  subtasks: string[];
};
