import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { APPROVAL_NOTE, loginItemState, shouldOfferMove } from "../login-item-state";

describe("loginItemState", () => {
  test("macOS 13+: status decides", () => {
    assert.deepEqual(loginItemState({ openAtLogin: true, status: "enabled" }), { enabled: true });
    assert.deepEqual(loginItemState({ openAtLogin: false, status: "requires-approval" }), { enabled: true, note: APPROVAL_NOTE });
    assert.deepEqual(loginItemState({ openAtLogin: true, status: "not-registered" }), { enabled: false });
    assert.deepEqual(loginItemState({ openAtLogin: false, status: "not-found" }), { enabled: false });
  });

  test("macOS 12 (no status): openAtLogin decides", () => {
    assert.deepEqual(loginItemState({ openAtLogin: true }), { enabled: true });
    assert.deepEqual(loginItemState({ openAtLogin: false }), { enabled: false });
  });
});

describe("shouldOfferMove", () => {
  test("only for the packaged app outside /Applications, unless declined", () => {
    assert.equal(shouldOfferMove({ packaged: true, inApplications: false, declined: false }), true);
    assert.equal(shouldOfferMove({ packaged: true, inApplications: true, declined: false }), false);
    assert.equal(shouldOfferMove({ packaged: true, inApplications: false, declined: true }), false);
    assert.equal(shouldOfferMove({ packaged: false, inApplications: false, declined: false }), false);
  });
});
