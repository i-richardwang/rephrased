import { createHash } from "node:crypto";
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
  type: z.string().describe("Card type, e.g. Paraphrase / Precise Wording"),
  user_said: z.string().describe("User's original words, keep the vagueness, ≤80 chars"),
  ai_phrased: z.string().describe("AI's precise rephrasing, ≤80 chars"),
  takeaway: z
    .object({
      vocab: z.array(z.string()).describe("Reusable terms array, can be empty"),
      pattern: z.string().describe("Transferable sentence pattern; empty string if none"),
    })
    .describe("Transferable takeaway"),
  context_hint: z.string().describe("Scene for recall, ≤20 chars"),
  source_ref: z
    .object({
      user_line: z.number().int().nullable().describe("User line number or null"),
      ai_line: z.number().int().nullable().describe("AI line number or null"),
    })
    .describe("Line numbers in the source transcript"),
});

const CardsSchema = z.object({
  cards: z.array(CardSchema).max(5).describe("0–5 cards"),
});

export type ExtractedCard = z.infer<typeof CardSchema>;

export interface AnalyzedCard extends ExtractedCard {
  content_hash: string;
}

export interface AnalyzeResult {
  cards: AnalyzedCard[];
  model: string;
}

export function contentHash(userSaid: string, aiPhrased: string): string {
  return createHash("md5")
    .update(userSaid + "||" + aiPhrased)
    .digest("hex")
    .slice(0, 16);
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
  const cardsWithHash: AnalyzedCard[] = object.cards.map((card) => ({
    ...card,
    content_hash: contentHash(card.user_said, card.ai_phrased),
  }));
  return { cards: cardsWithHash, model: modelLabel };
}
