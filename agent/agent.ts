import { createAnthropic } from "@ai-sdk/anthropic";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { defineAgent } from "eve";

const baseURL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/anthropic";
const modelId = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

const deepseek = createAnthropic({
  name: "deepseek",
  baseURL,
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
});

// The Anthropic provider caps unknown model ids at 4096 output tokens. A large
// A2UI surface runs past that, so raise the cap explicitly.
const model = wrapLanguageModel({
  model: deepseek(modelId),
  middleware: defaultSettingsMiddleware({ settings: { maxOutputTokens: 8192 } }),
});

export default defineAgent({
  model,
  modelContextWindowTokens: 131_072,
  // The demo agent only draws interfaces. Shell, file and web tools would add
  // prompt noise and give the model somewhere else to go.
  defaultTools: false,
});
