/**
 * Entry point: read TODOIST_API_TOKEN, init Todoist client, start MCP server on stdio.
 * All logging goes to stderr so stdout is reserved for the MCP protocol.
 */

import { TodoistClient } from "./todoist/client.js";
import { runServer } from "./server.js";

const log = (msg: string): void => {
  process.stderr.write(`[todoist-meeting-mcp] ${msg}\n`);
};

async function main(): Promise<void> {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token || token.trim() === "") {
    log("ERROR: TODOIST_API_TOKEN is not set. Set it in your environment or claude_desktop_config.json env.");
    process.exit(1);
  }

  const client = new TodoistClient(token);
  await runServer(client);
}

main().catch((err) => {
  log(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
