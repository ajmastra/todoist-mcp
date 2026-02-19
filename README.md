# Todoist Meeting MCP

[![CI](https://github.com/ajmastra/todist-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ajmastra/todist-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/ajmastra/todist-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/ajmastra/todist-mcp/actions/workflows/release.yml)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Replace `YOUR_ORG` in the badge URLs with your GitHub username or org** so the badges reflect your repo’s CI and release status.

A production-ready **Model Context Protocol (MCP)** server that connects Claude with Todoist for intelligent meeting note processing. Parse meeting notes into actionable Todoist tasks with inferred due dates and priorities, create and complete tasks by name, and list projects and tasks—all through natural language in Claude.

---

## What this does

This MCP server exposes Todoist as tools to Claude: you can paste meeting notes and have action items turned into tasks, create tasks with natural-language due dates (e.g. "by Friday"), add subtasks, list projects and tasks, update tasks, and complete them by name. Tasks are routed to projects/sections by keyword matching or an optional target project hint.

---

## Prerequisites

- **Node.js 18+**
- **Claude Desktop** (or another MCP client)
- A **Todoist** account and [API token](https://todoist.com/app/settings/integrations/developer)

---

## Quick setup

1. **Get your Todoist API token**  
   Todoist → Settings → Integrations → Developer → copy your API token.

2. **Configure Claude Desktop**  
   Edit (or create) the MCP config file. If it doesn't exist, create the `Claude` folder and the file:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

   Add (or merge in) the following, replacing `your_todoist_api_token_here` with your token:

   ```json
   {
     "mcpServers": {
       "todoist-meeting-mcp": {
         "command": "npx",
         "args": ["-y", "todoist-meeting-mcp"],
         "env": {
           "TODOIST_API_TOKEN": "your_todoist_api_token_here"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**  
   The server will start when Claude needs it. Ensure `TODOIST_API_TOKEN` is set or the server will exit with a clear error.

---

## Example prompts

- **Meeting notes → tasks:**  
  *"Here are my standup notes: [paste notes]. Create Todoist tasks."*

- **Single task:**  
  *"Create a task called 'Review PR #42' in my Engineering project due Friday."*

- **Subtasks:**  
  *"Add subtasks to my 'Q2 Planning' task: research competitors, draft slides, schedule review."*

- **List & complete:**  
  *"List my tasks due today."* / *"Complete the task 'Review PR #42'."*

---

## Tool reference

| Tool | Description |
|------|-------------|
| `parse_meeting_notes` | Parse raw meeting note text; extract action items, deadlines, priorities; create Todoist tasks (optional target project). |
| `create_task` | Create a single task with content, description, project/section by name, natural-language due date, priority, labels, optional parent (subtask). |
| `create_subtasks` | Add multiple subtasks to a parent task (parent found by name). |
| `list_projects` | List all projects with IDs, names, and section names (for routing context). |
| `list_tasks` | List tasks with optional filters: project_name, section_name, priority, due_today. |
| `update_task` | Update a task (found by name): content, description, due date, priority, project, section. |
| `complete_task` | Mark a task complete (found by name, fuzzy match). |

---

## GitHub release / self-hosted usage

Releases are built and published on GitHub when you push a tag `v*.*.*` (e.g. `v1.0.0`). The workflow uploads **`todoist-meeting-mcp.js`** as a release asset.

- **Run with npx (no download):** use the config block above; npx will run the published package.

- **Run from a downloaded asset:**  
  1. Download `todoist-meeting-mcp.js` from the [Releases](https://github.com/YOUR_ORG/todoist-meeting-mcp/releases) page.  
  2. Point Claude at it:

  ```json
  "mcpServers": {
    "todoist-meeting-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/todoist-meeting-mcp.js"],
      "env": {
        "TODOIST_API_TOKEN": "your_todoist_api_token_here"
      }
    }
  }
  ```

---

## Build and test locally

From the project root:

```bash
# Install dependencies
npm ci

# Typecheck and lint (same as CI)
npm run typecheck
npm run lint

# Build (single file to dist/index.js)
npm run build

# Run the server (reads MCP over stdio; set token first)
export TODOIST_API_TOKEN=your_token_here
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### Code quality (CI)

On every push and pull request to `main`/`master`, the [CI workflow](.github/workflows/ci.yml) runs:

- **Typecheck** — `tsc --noEmit`
- **Lint** — ESLint (TypeScript) on `src/`
- **Build** — `npm run build`

The badges at the top show the status of the [CI](.github/workflows/ci.yml) and [Release](.github/workflows/release.yml) workflows once you set `YOUR_ORG` to your GitHub org or username.

---

## License

MIT
