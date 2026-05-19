import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateObject } from "ai";
import { z } from "zod";
import { model, modelLabel } from "../llm.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../../prompts/analyze.md");
const SYSTEM_PROMPT = readFileSync(PROMPT_PATH, "utf8");

const CardSchema = z.object({
  type: z.string().describe("卡片类型，中文"),
  user_said: z.string().describe("用户原话，保留模糊感，≤80字"),
  ai_phrased: z.string().describe("AI 的精准说法，≤80字"),
  takeaway: z
    .object({
      vocab: z.array(z.string()).describe("可复用词数组，可空"),
      pattern: z.string().describe("可迁移句式，一句话；无则空字符串"),
    })
    .describe("迁移价值"),
  context_hint: z.string().describe("回忆场景，≤20字"),
  source_ref: z
    .object({
      user_line: z.number().int().nullable().describe("用户行号或 null"),
      ai_line: z.number().int().nullable().describe("AI 行号或 null"),
    })
    .describe("源对话脚本中的行号"),
});

const CardsSchema = z.object({
  cards: z.array(CardSchema).max(5).describe("0-5 张卡片"),
});

export type ExtractedCard = z.infer<typeof CardSchema>;

export interface AnalyzeResult {
  cards: ExtractedCard[];
  model: string;
}

export async function analyzeTranscript(
  transcript: string,
): Promise<AnalyzeResult> {
  const { object } = await generateObject({
    model,
    schema: CardsSchema,
    system: SYSTEM_PROMPT,
    prompt: transcript,
  });
  return { cards: object.cards, model: modelLabel };
}
