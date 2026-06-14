import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const liveSessionSource = fs.readFileSync(
  path.resolve(dirname, "../../src/app/live-session/LiveSessionClient.tsx"),
  "utf8"
);

describe("live session source", () => {
  it("uses calculated time_for_carbs triggers instead of a demo timeline", () => {
    expect(liveSessionSource.includes(["demo", "Timeline"].join(""))).toBe(false);
    expect(liveSessionSource).toContain("calculatedFuelingPlan.triggers");
    expect(liveSessionSource).toContain("trigger.tag");
  });

  it("shows a clear state when no active session exists", () => {
    expect(liveSessionSource).toContain("Geen actieve sessie");
    expect(liveSessionSource).toContain("Ga naar dashboard en start een sessie.");
  });

  it("keeps the live-session UI focused on Web Push only", () => {
    expect(liveSessionSource).not.toContain("Niveau 1");
    expect(liveSessionSource).not.toContain("Niveau 2");
    expect(liveSessionSource).not.toContain("Level 1");
    expect(liveSessionSource).not.toContain("Level 2");
    expect(liveSessionSource).toContain("Start demo session");
    expect(liveSessionSource).toContain("Alert timeline");
  });
});
