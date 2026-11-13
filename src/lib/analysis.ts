export type ScoreMap = Record<string, number>;

export interface AnalysisData {
  race: ScoreMap;
  age: ScoreMap;
  gender: ScoreMap;
}

export interface AnalysisResponse {
  message: string;
  data: AnalysisData;
}

export type Attribute = keyof AnalysisData;

export interface RankedScore {
  label: string;
  score: number;
}

const attributes: Attribute[] = ["race", "age", "gender"];

export function parseAnalysisResponse(value: unknown): AnalysisResponse {
  if (!value || typeof value !== "object") {
    throw new Error("The scan response was not in the expected format.");
  }

  const response = value as Partial<AnalysisResponse>;
  if (!response.data || typeof response.data !== "object") {
    throw new Error("The scan response did not include demographic results.");
  }

  for (const attribute of attributes) {
    const scores = response.data[attribute];
    if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
      throw new Error(`The scan response did not include ${attribute} scores.`);
    }

    const entries = Object.entries(scores);
    if (entries.length === 0 || entries.some(([, score]) => typeof score !== "number" || !Number.isFinite(score))) {
      throw new Error(`The scan response included invalid ${attribute} scores.`);
    }
  }

  return {
    message: typeof response.message === "string" ? response.message : "Analysis complete.",
    data: response.data as AnalysisData,
  };
}

export function rankAllScores(scores: ScoreMap): RankedScore[] {
  return Object.entries(scores)
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
}

export function rankScores(scores: ScoreMap): RankedScore[] {
  return rankAllScores(scores).slice(0, 2);
}

export function formatScore(score: number): string {
  return score.toFixed(2);
}
