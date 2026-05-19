import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`missing env ${key}`);
  return v;
}

const baseURL = required("LLM_BASE_URL");
const apiKey = required("LLM_API_KEY");
const modelId = required("LLM_MODEL_ID");
const providerName = process.env.LLM_PROVIDER_NAME ?? "custom";

const provider = createOpenAICompatible({
  name: providerName,
  apiKey,
  baseURL,
  // Tell the SDK this endpoint supports OpenAI strict json_schema mode.
  // Disable via LLM_STRUCTURED_OUTPUTS=0 if a fronted model rejects it.
  supportsStructuredOutputs: process.env.LLM_STRUCTURED_OUTPUTS !== "0",
});

export const model = provider(modelId);
export const modelLabel = `${providerName}:${modelId}`;
