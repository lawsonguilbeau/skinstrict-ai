import { describe, expect, it } from "vitest";
import { formatScore, parseAnalysisResponse, rankAllScores, rankScores } from "./analysis";

describe("analysis helpers", () => {
  it("orders the highest two scores and formats them as percentages", () => {
    expect(rankScores({ first: 0.24, second: 0.81, third: 0.5 })).toEqual([
      { label: "second", score: 0.81 },
      { label: "third", score: 0.5 },
    ]);
    expect(rankAllScores({ first: 0.24, second: 0.81, third: 0.5 })).toHaveLength(3);
    expect(formatScore(0.81)).toBe("0.81");
  });

  it("rejects incomplete or invalid score responses", () => {
    expect(() => parseAnalysisResponse({ data: { race: {}, age: {}, gender: {} } })).toThrow(/race scores/);
  });
});
