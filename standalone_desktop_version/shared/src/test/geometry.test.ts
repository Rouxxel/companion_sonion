import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { boundsInWorkArea, companionDimensions, DisplayInfo, normalizedPosition, pickDisplay, saveDisplay } from "../geometry";

const left: DisplayInfo = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const right: DisplayInfo = { id: 2, bounds: { x: 1920, y: 0, width: 2560, height: 1440 }, workArea: { x: 1920, y: 0, width: 2560, height: 1400 } };

describe("companionDimensions", () => {
  test("square without a known aspect ratio", () => {
    assert.deepEqual(companionDimensions(180), { width: 180, height: 180 });
    assert.deepEqual(companionDimensions(180, 0), { width: 180, height: 180 });
    assert.deepEqual(companionDimensions(180, Number.NaN), { width: 180, height: 180 });
  });

  test("size is the longer side", () => {
    assert.deepEqual(companionDimensions(180, 16 / 9), { width: 180, height: 101 });
    assert.deepEqual(companionDimensions(180, 0.5), { width: 90, height: 180 });
  });
});

describe("boundsInWorkArea / normalizedPosition", () => {
  test("round-trip on a secondary monitor", () => {
    const size = companionDimensions(200, 1.5);
    for (const position of [{ x: 0, y: 0 }, { x: 0.25, y: 0.75 }, { x: 1, y: 1 }]) {
      const bounds = boundsInWorkArea(position, size, right.workArea);
      assert.ok(bounds.x >= right.workArea.x && bounds.x + bounds.width <= right.workArea.x + right.workArea.width);
      const back = normalizedPosition(bounds, right.workArea);
      assert.ok(Math.abs(back.x - position.x) < 0.001 && Math.abs(back.y - position.y) < 0.001, JSON.stringify({ position, back }));
    }
  });

  test("uses width and height separately (non-square companions)", () => {
    const bounds = { x: 1920 - 90, y: 0, width: 90, height: 180 };
    assert.deepEqual(normalizedPosition(bounds, left.workArea), { x: 1, y: 0 });
  });

  test("positions outside the work area are clamped to 0–1", () => {
    assert.deepEqual(normalizedPosition({ x: -500, y: 5000, width: 100, height: 100 }, left.workArea), { x: 0, y: 1 });
  });

  test("a companion larger than the work area stays at the work area origin", () => {
    assert.deepEqual(boundsInWorkArea({ x: 1, y: 1 }, { width: 3000, height: 3000 }, left.workArea), { x: 0, y: 0, width: 3000, height: 3000 });
  });
});

describe("pickDisplay", () => {
  const saved = saveDisplay(right);

  test("same id and bounds → the saved display", () => {
    assert.equal(pickDisplay(saved, [left, right], left).id, 2);
  });

  test("id changed but same place (re-docking) → the display at that place", () => {
    assert.equal(pickDisplay(saved, [left, { ...right, id: 7 }], left).id, 7);
  });

  test("same id but the monitor moved elsewhere → the display now at the saved place, else fallback", () => {
    const moved = { ...right, bounds: { ...right.bounds, x: -2560 } };
    assert.equal(pickDisplay(saved, [left, moved], left).id, 1);
  });

  test("monitor unplugged → fallback", () => {
    assert.equal(pickDisplay(saved, [left], left).id, 1);
  });

  test("no saved display (older data) → fallback", () => {
    assert.equal(pickDisplay(undefined, [left, right], right).id, 2);
  });
});
