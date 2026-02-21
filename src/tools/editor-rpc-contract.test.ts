import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

describe("editor RPC contract", () => {
  it("keeps editor tool RPC methods in sync with plugin dispatch", () => {
    const editorTools = readProjectFile("src/tools/editor-tools.ts");
    const pluginHandler = readProjectFile("addons/godot_ai_bridge/message_handler.gd");

    const sentMethods = uniqueSorted(
      [...editorTools.matchAll(/sendRequest\("([^"]+)"/g)].map((match) => match[1])
    );

    const dispatchStart = pluginHandler.indexOf("func _dispatch");
    const dispatchEnd = pluginHandler.indexOf("func _handle_initialize");
    const dispatchBlock = pluginHandler.slice(dispatchStart, dispatchEnd);

    const dispatchedMethods = uniqueSorted(
      [...dispatchBlock.matchAll(/^\s*"([^"]+)":\s*$/gm)].map(
        (match) => match[1]
      )
    );

    const missingInPlugin = sentMethods.filter(
      (method) => !dispatchedMethods.includes(method)
    );

    expect(missingInPlugin).toEqual([]);
  });

  it("documents all plugin RPC methods in README", () => {
    const readme = readProjectFile("README.md");
    const pluginHandler = readProjectFile("addons/godot_ai_bridge/message_handler.gd");

    const sectionStart = readme.indexOf("### JSON-RPC Methods");
    const sectionEnd = readme.indexOf("\n---", sectionStart);
    const rpcSection = readme.slice(sectionStart, sectionEnd);

    const documentedMethods = uniqueSorted(
      [...rpcSection.matchAll(/\|\s*`([^`]+)`\s*\|/g)].map((match) => match[1])
    );

    const dispatchStart = pluginHandler.indexOf("func _dispatch");
    const dispatchEnd = pluginHandler.indexOf("func _handle_initialize");
    const dispatchBlock = pluginHandler.slice(dispatchStart, dispatchEnd);

    const dispatchedMethods = uniqueSorted(
      [...dispatchBlock.matchAll(/^\s*"([^"]+)":\s*$/gm)].map(
        (match) => match[1]
      )
    );

    const undocumented = dispatchedMethods.filter(
      (method) => !documentedMethods.includes(method)
    );

    expect(undocumented).toEqual([]);
  });
});
