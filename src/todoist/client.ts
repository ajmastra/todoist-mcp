/**
 * Todoist API client wrapper that resolves project/section names to IDs
 * and caches the project/section list. Uses @doist/todoist-api-typescript.
 */

import { TodoistApi } from "@doist/todoist-api-typescript";
import type { Task } from "@doist/todoist-api-typescript";
import type { TodoistProject, TodoistSection, ListTasksFilters, UpdateTaskParams } from "./types.js";

/** Cached project with sections. */
type ProjectWithSections = TodoistProject & { sections: TodoistSection[] };

export class TodoistClient {
  private api: TodoistApi;
  private cache: {
    projects: ProjectWithSections[] | null;
    allTasks: Task[] | null;
  } = {
    projects: null,
    allTasks: null,
  };

  constructor(apiToken: string) {
    this.api = new TodoistApi(apiToken);
  }

  /** Refresh project and section cache. */
  async refreshCache(): Promise<void> {
    const { results: projects } = await this.api.getProjects({});
    const withSections: ProjectWithSections[] = await Promise.all(
      projects.map(async (p) => {
        const { results: sections } = await this.api.getSections({ projectId: p.id });
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          isArchived: p.isArchived,
          isDeleted: p.isDeleted,
          order: "childOrder" in p ? (p as { childOrder: number }).childOrder : 0,
          parentId: "parentId" in p ? (p as { parentId?: string | null }).parentId : undefined,
          isFavorite: p.isFavorite,
          sections: sections.map((s) => ({
            id: s.id,
            name: s.name,
            projectId: s.projectId,
            order: s.sectionOrder ?? 0,
          })),
        };
      })
    );
    this.cache.projects = withSections;
    this.cache.allTasks = null;
  }

  /** Get projects with sections; refresh cache if empty. */
  async getProjects(): Promise<ProjectWithSections[]> {
    if (!this.cache.projects) {
      await this.refreshCache();
    }
    return this.cache.projects ?? [];
  }

  /** Get sections for a project. Uses cache when available. */
  async getSections(projectId: string): Promise<TodoistSection[]> {
    const projects = await this.getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (project) return project.sections;
    const { results } = await this.api.getSections({ projectId });
    return results.map((s) => ({
      id: s.id,
      name: s.name,
      projectId: s.projectId,
      order: s.sectionOrder ?? 0,
    }));
  }

  /** Create a task. Params use IDs (resolve project/section names elsewhere). */
  async createTask(params: {
    content: string;
    description?: string;
    projectId?: string;
    sectionId?: string | null;
    due?: string | { date: string };
    priority?: number;
    parentId?: string | null;
    labels?: string[];
  }): Promise<Task> {
    const body: Record<string, unknown> = {
      content: params.content,
      ...(params.description != null && { description: params.description }),
      ...(params.projectId != null && { projectId: params.projectId }),
      ...(params.sectionId != null && params.sectionId !== "" && { sectionId: params.sectionId }),
      ...(params.priority != null && { priority: params.priority }),
      ...(params.parentId != null && params.parentId !== "" && { parentId: params.parentId }),
      ...(params.labels != null && params.labels.length > 0 && { labels: params.labels }),
    };
    if (params.due != null) {
      body.due = typeof params.due === "string" ? { date: params.due } : params.due;
    }
    return this.api.addTask(body as Parameters<TodoistApi["addTask"]>[0]);
  }

  /** Create a subtask under a parent task. */
  async createSubtask(parentId: string, params: { content: string; description?: string; due?: string; priority?: number }): Promise<Task> {
    const body: Record<string, unknown> = {
      content: params.content,
      parentId,
      ...(params.description != null && { description: params.description }),
      ...(params.priority != null && { priority: params.priority }),
    };
    if (params.due != null) {
      body.due = { date: params.due };
    }
    return this.api.addTask(body as Parameters<TodoistApi["addTask"]>[0]);
  }

  /** Get tasks with optional filters. */
  async getTasks(filters: ListTasksFilters = {}): Promise<Task[]> {
    const args: Record<string, string | undefined> = {};
    if (filters.projectId) args.projectId = filters.projectId;
    if (filters.sectionId) args.sectionId = filters.sectionId;
    const { results, nextCursor } = await this.api.getTasks(args as Parameters<TodoistApi["getTasks"]>[0]);
    let tasks = results;
    let cursor = nextCursor;
    while (cursor) {
      const next = await this.api.getTasks({ ...args, cursor } as Parameters<TodoistApi["getTasks"]>[0]);
      tasks = tasks.concat(next.results);
      cursor = next.nextCursor;
    }
    if (filters.priority != null) {
      tasks = tasks.filter((t) => t.priority === filters.priority);
    }
    if (filters.dueToday === true) {
      const now = new Date();
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      tasks = tasks.filter((t) => {
        const d = t.due;
        if (!d) return false;
        const dateStr = d.date ?? d.datetime ?? "";
        if (!dateStr) return false;
        const taskDate = dateStr.slice(0, 10);
        return taskDate === todayLocal;
      });
    }
    return tasks;
  }

  /** Update a task by ID. */
  async updateTask(id: string, params: UpdateTaskParams): Promise<Task> {
    const body: Record<string, unknown> = {};
    if (params.content != null) body.content = params.content;
    if (params.description != null) body.description = params.description;
    if (params.priority != null) body.priority = params.priority;
    if (params.due !== undefined) {
      body.due = params.due == null ? null : typeof params.due === "string" ? { date: params.due } : params.due;
    }
    if (params.projectId != null) body.projectId = params.projectId;
    if (params.sectionId != null) body.sectionId = params.sectionId;
    return this.api.updateTask(id, body as Parameters<TodoistApi["updateTask"]>[1]);
  }

  /** Close (complete) a task by ID. */
  async closeTask(id: string): Promise<boolean> {
    return this.api.closeTask(id);
  }

  /** Find a task by name (fuzzy: content includes name, case-insensitive). */
  async findTaskByName(name: string): Promise<Task | null> {
    const lower = name.trim().toLowerCase();
    if (!lower) return null;
    const tasks = await this.getTasks({});
    return tasks.find((t) => t.content.toLowerCase().includes(lower)) ?? null;
  }

  /** Find project by name (case-insensitive, partial match). Refresh cache if not found. */
  async findProjectByName(name: string): Promise<TodoistProject | null> {
    const projects = await this.getProjects();
    const normalized = name.trim().toLowerCase();
    let match: ProjectWithSections | null | undefined = projects.find(
      (p) => p.name.toLowerCase().includes(normalized) || normalized.includes(p.name.toLowerCase())
    );
    if (!match) {
      await this.refreshCache();
      const again = await this.getProjects();
      match = again.find((p) => p.name.toLowerCase().includes(normalized) || normalized.includes(p.name.toLowerCase())) ?? null;
    }
    return match ?? null;
  }

  /** Find section by name within a project. */
  async findSectionByName(projectId: string, name: string): Promise<TodoistSection | null> {
    const sections = await this.getSections(projectId);
    const normalized = name.trim().toLowerCase();
    return sections.find((s) => s.name.toLowerCase().includes(normalized) || normalized.includes(s.name.toLowerCase())) ?? null;
  }

  /** Find a section by name in any project. Returns projectId and sectionId for the first match. */
  async findSectionByNameInAnyProject(sectionName: string): Promise<{ projectId: string; sectionId: string } | null> {
    const projects = await this.getProjects();
    const normalized = sectionName.trim().toLowerCase();
    for (const project of projects) {
      const section = project.sections.find(
        (s) => s.name.toLowerCase().includes(normalized) || normalized.includes(s.name.toLowerCase())
      );
      if (section) return { projectId: project.id, sectionId: section.id };
    }
    return null;
  }

  /** Add a section to a project. */
  async addSection(projectId: string, name: string): Promise<TodoistSection> {
    const section = await this.api.addSection({ projectId, name });
    this.cache.projects = null;
    return {
      id: section.id,
      name: section.name,
      projectId: section.projectId,
      order: section.sectionOrder ?? 0,
    };
  }

  /** Add a project. */
  async addProject(name: string): Promise<TodoistProject> {
    const project = await this.api.addProject({ name });
    this.cache.projects = null;
    return {
      id: project.id,
      name: project.name,
      color: project.color,
      isArchived: project.isArchived,
      isDeleted: project.isDeleted,
      order: "childOrder" in project ? (project as { childOrder: number }).childOrder : 0,
      parentId: "parentId" in project ? (project as { parentId?: string | null }).parentId : undefined,
      isFavorite: project.isFavorite,
    };
  }
}
