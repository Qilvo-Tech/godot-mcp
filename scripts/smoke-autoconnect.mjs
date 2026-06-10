#!/usr/bin/env node
/**
 * Live smoke test for the editor-bridge auto-connect path.
 *
 * Registers the editor tools against the *built* dist module and calls a
 * couple of handlers WITHOUT first calling godot_connect — proving that a
 * fresh MCP session (socket = null) self-heals via ensureConnected's lazy
 * auto-connect. Runs in-process against dist so it reflects the latest build
 * immediately, unlike the long-lived MCP server which only picks up a rebuild
 * on restart.
 *
 * Usage:
 *   node scripts/smoke-autoconnect.mjs [--host H] [--port N] [--project PATH]
 *   npm run smoke -- --port 6550
 *
 * Exit codes:
 *   0  bridge reachable and editor tools worked, OR bridge down (SKIP)
 *   1  bridge reachable but an editor tool failed (real regression)
 *
 * Bridge-down is a SKIP, not a failure: this is a smoke test, and a closed
 * editor is an environment gap, not a code defect. The dead-port hint path is
 * still exercised so you can eyeball the error text.
 */

import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { registerEditorTools } from "../dist/tools/editor-tools.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultProject = path.resolve(here, "..", "..", "..", "client");

function parseArgs(argv) {
  const opts = { host: "127.0.0.1", port: 6550, project: defaultProject };
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === "--host" && next) {
      opts.host = next;
      i++;
    } else if (argv[i] === "--port" && next) {
      opts.port = parseInt(next, 10);
      i++;
    } else if (argv[i] === "--project" && next) {
      opts.project = path.resolve(next);
      i++;
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

const tools = new Map();
const state = {
  projectPath: opts.project,
  editorConnected: false,
  editorHost: opts.host,
  editorPort: opts.port,
};
registerEditorTools(tools, state);

console.log(`[smoke] target ${opts.host}:${opts.port}  project=${opts.project}`);

// Deliberately skip godot_connect — this is the whole point of the smoke.
const status = await tools.get("godot_connection_status").handler({});
console.log(`[smoke] connection_status: ${JSON.stringify(status)}`);

if (!status.connected) {
  console.log(
    "[smoke] SKIP — bridge unreachable (open Godot with the AI Bridge plugin to run the live path). " +
      "The hint above shows the failure text editor tools now surface."
  );
  process.exit(0);
}

try {
  const info = await tools.get("godot_editor_get_project_info").handler({});
  console.log(`[smoke] project_info: ${JSON.stringify(info)}`);
  const tree = await tools.get("godot_editor_get_scene_tree").handler({});
  const treeStr = JSON.stringify(tree);
  console.log(`[smoke] scene_tree ok (${treeStr.length} chars)`);
  console.log("[smoke] PASS — auto-connect worked without an explicit godot_connect.");
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[smoke] FAIL — editor tool errored while connected: ${message}`);
  process.exit(1);
}
