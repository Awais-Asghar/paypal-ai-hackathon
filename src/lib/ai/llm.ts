import { z } from "zod";

// Provider-neutral JSON generation. LLM_PROVIDER picks the first choice; the others are
// fallbacks in order, so a free-tier rate limit on one provider doesn't stop the check-in.
// Request shapes follow the official SDKs: Gemini generateContent with responseJsonSchema,
// Groq OpenAI-compatible chat completions with response_format json_schema.

export type Part = { text: string } | { image: { mimeType: string; base64: string } };
export type Message = { role: "user" | "assistant"; parts: Part[] };
export type JsonRequest = { system: string; messages: Message[]; schemaName: string; schema: Record<string, unknown> };

export interface JsonModel {
  readonly name: string;
  json(req: JsonRequest): Promise<unknown>;
}

const TIMEOUT_MS = 25_000;

export class GeminiModel implements JsonModel {
  readonly name: string;
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    label = "gemini",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.name = `${label}:${model}`;
  }

  async json(req: JsonRequest) {
    const res = await this.fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: m.parts.map((p) => ("text" in p ? { text: p.text } : { inlineData: { mimeType: p.image.mimeType, data: p.image.base64 } })),
        })),
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: req.schema, temperature: 0.2 },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${this.name} ${res.status}: ${body?.error?.message ?? "request failed"}`);
    const text: string | undefined = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
    if (!text) throw new Error(`${this.name}: empty response (${body?.candidates?.[0]?.finishReason ?? "no candidate"})`);
    return JSON.parse(text);
  }
}

export class GroqModel implements JsonModel {
  readonly name: string;
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.name = `groq:${model}`;
  }

  async json(req: JsonRequest) {
    if (req.messages.some((m) => m.parts.some((p) => "image" in p))) throw new Error(`${this.name}: no vision support`);
    const res = await this.fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: req.system },
          ...req.messages.map((m) => ({ role: m.role, content: m.parts.map((p) => ("text" in p ? p.text : "")).join("\n") })),
        ],
        response_format: { type: "json_schema", json_schema: { name: req.schemaName, schema: req.schema, strict: false } },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${this.name} ${res.status}: ${body?.error?.message ?? "request failed"}`);
    const text: string | undefined = body?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${this.name}: empty response`);
    return JSON.parse(text);
  }
}

/** Tries each model in order and returns the first answer that matches the schema. */
export class FallbackModel implements JsonModel {
  readonly name: string;
  constructor(private readonly models: JsonModel[]) {
    this.name = models.map((m) => m.name).join(" > ") || "none";
  }

  async json(req: JsonRequest) {
    const errors: string[] = [];
    for (const m of this.models) {
      try {
        return await m.json(req);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    throw new Error(`No model answered: ${errors.join(" | ") || "no models configured"}`);
  }
}

/** JSON Schema for a zod schema, trimmed to the keywords Gemini's responseJsonSchema accepts. */
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const out = z.toJSONSchema(schema) as Record<string, unknown>;
  delete out.$schema;
  return out;
}

export async function generateJson<T extends z.ZodType>(model: JsonModel, req: Omit<JsonRequest, "schema">, schema: T): Promise<z.infer<T>> {
  const raw = await model.json({ ...req, schema: jsonSchemaFor(schema) });
  return schema.parse(raw);
}

export function modelsFromEnv(env = process.env): JsonModel {
  const gemini: JsonModel[] = [];
  const model = env.GEMINI_MODEL || "gemini-3.8-flash";
  if (env.GEMINI_API_KEY_Pro) gemini.push(new GeminiModel(env.GEMINI_API_KEY_Pro, model, "gemini"));
  if (env.GEMINI_API_KEY_Plus) gemini.push(new GeminiModel(env.GEMINI_API_KEY_Plus, model, "gemini-backup"));
  const groq: JsonModel[] = env.GROQ_API_KEY ? [new GroqModel(env.GROQ_API_KEY, env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b")] : [];
  return new FallbackModel(env.LLM_PROVIDER === "groq" ? [...groq, ...gemini] : [...gemini, ...groq]);
}
