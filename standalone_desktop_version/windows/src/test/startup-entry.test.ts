import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseRegQueryValue, programFromCommandLine, startupApprovedEnabled } from "../startup-entry";

describe("programFromCommandLine", () => {
  test("quoted path with arguments (as written by Electron)", () => {
    assert.equal(programFromCommandLine("\"C:\\Users\\me\\AppData\\Local\\Programs\\Sonion Companion\\Sonion Companion.exe\" --autostart"),
      "C:\\Users\\me\\AppData\\Local\\Programs\\Sonion Companion\\Sonion Companion.exe");
  });

  test("unquoted path with spaces and arguments", () => {
    assert.equal(programFromCommandLine("C:\\Program Files\\App\\App.exe --flag"), "C:\\Program Files\\App\\App.exe");
  });

  test("unterminated quote and bare program", () => {
    assert.equal(programFromCommandLine("\"C:\\app.exe"), "C:\\app.exe");
    assert.equal(programFromCommandLine("  app  "), "app");
  });
});

describe("startupApprovedEnabled", () => {
  test("no Task Manager entry means enabled", () => {
    assert.equal(startupApprovedEnabled(undefined), true);
    assert.equal(startupApprovedEnabled(""), true);
  });

  test("even first byte = enabled, odd = disabled", () => {
    assert.equal(startupApprovedEnabled("020000000000000000000000"), true);
    assert.equal(startupApprovedEnabled("060000000000000000000000"), true);
    assert.equal(startupApprovedEnabled("030000000000000000000000"), false);
    assert.equal(startupApprovedEnabled("07AB12CD0000000000000000"), false);
  });
});

describe("parseRegQueryValue", () => {
  const output = [
    "",
    "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
    "    Other App    REG_SZ    \"C:\\Other\\other.exe\" /background",
    "    SonionCompanion    REG_SZ    \"C:\\Programs\\Sonion Companion\\Sonion Companion.exe\" --autostart",
    ""
  ].join("\r\n");

  test("finds the named value", () => {
    assert.equal(parseRegQueryValue(output, "SonionCompanion"), "\"C:\\Programs\\Sonion Companion\\Sonion Companion.exe\" --autostart");
    assert.equal(parseRegQueryValue(output, "Other App"), "\"C:\\Other\\other.exe\" /background");
  });

  test("binary values and missing names", () => {
    assert.equal(parseRegQueryValue("    SonionCompanion    REG_BINARY    030000000000000000000000", "SonionCompanion"), "030000000000000000000000");
    assert.equal(parseRegQueryValue(output, "Missing"), undefined);
  });
});
