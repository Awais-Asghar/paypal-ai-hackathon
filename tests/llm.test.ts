import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FallbackModel, GeminiModel, generateJson, GroqModel, jsonSchemaFor, modelsFromEnv, type JsonModel } from "@/lib/ai/llm";

const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function recordingFetch(response: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return okJson(response);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const schema = z.object({ risk: z.enum(["LOW", "HIGH"]) });

describe("GeminiModel", () => {
  it("sends system text, inline images and a JSON schema, and parses the answer", async () => {
    const f = recordingFetch({ candidates: [{ content: { parts: [{ text: '{"risk":"HIGH"}' }] } }] });
    const model = new GeminiModel("key-123", "gemini-test", "gemini", f.fn);
    const out = await generateJson(
      model,
      { schemaName: "v", system: "be careful", messages: [{ role: "user", parts: [{ image: { mimeType: "image/png", base64: "AAA" } }, { text: "hi" }] }, { role: "assistant", parts: [{ text: "ok" }] }] },
      schema,
    );
    expect(out).toEqual({ risk: "HIGH" });

    expect(f.calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect((f.calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("key-123");
    const body = JSON.parse(f.calls[0].init.body as string);
    expect(body.systemInstruction).toEqual({ parts: [{ text: "be careful" }] });
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: "image/png", data: "AAA" } });
    expect(body.contents[1].role).toBe("model");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.properties.risk.enum).toEqual(["LOW", "HIGH"]);
  });
});

describe("GroqModel", () => {
  it("uses response_format json_schema", async () => {
    const f = recordingFetch({ choices: [{ message: { content: '{"risk":"LOW"}' } }] });
    const out = await generateJson(new GroqModel("gk", "openai/gpt-oss-120b", f.fn), { schemaName: "v", system: "s", messages: [{ role: "user", parts: [{ text: "x" }] }] }, schema);
    expect(out).toEqual({ risk: "LOW" });
    const body = JSON.parse(f.calls[0].init.body as string);
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "v" } });
    expect(body.messages[0]).toEqual({ role: "system", content: "s" });
  });

  it("refuses images, so the fallback moves on to a vision model", async () => {
    const f = recordingFetch({});
    await expect(new GroqModel("gk", "m", f.fn).json({ schemaName: "v", system: "s", schema: {}, messages: [{ role: "user", parts: [{ image: { mimeType: "image/png", base64: "A" } }] }] })).rejects.toThrow("no vision");
    expect(f.calls).toHaveLength(0);
  });
});

describe("FallbackModel", () => {
  const failing: JsonModel = { name: "down", json: async () => { throw new Error("429 rate limited"); } };
  const working: JsonModel = { name: "up", json: async () => ({ risk: "LOW" }) };

  it("uses the next model when one fails", async () => {
    expect(await new FallbackModel([failing, working]).json({ schemaName: "v", system: "", schema: {}, messages: [] })).toEqual({ risk: "LOW" });
  });
  it("reports every failure when none answer", async () => {
    await expect(new FallbackModel([failing]).json({ schemaName: "v", system: "", schema: {}, messages: [] })).rejects.toThrow("429 rate limited");
  });
  it("rejects answers that don't match the schema", async () => {
    const wrong: JsonModel = { name: "wrong", json: async () => ({ risk: "MAYBE" }) };
    await expect(generateJson(wrong, { schemaName: "v", system: "", messages: [] }, schema)).rejects.toThrow();
  });
});

describe("modelsFromEnv", () => {
  const keys = { GEMINI_API_KEY_Pro: "p", GEMINI_API_KEY_Plus: "q", GROQ_API_KEY: "g" };

  it("puts Groq first by default, then each Gemini key with its main and fallback model", () => {
    expect(modelsFromEnv(keys).name).toBe(
      "groq:openai/gpt-oss-120b > gemini:gemini-3.8-flash > gemini:gemini-flash-lite-latest > gemini-backup:gemini-3.8-flash > gemini-backup:gemini-flash-lite-latest",
    );
  });
  it("puts Gemini first with LLM_PROVIDER=gemini and skips a duplicate fallback model", () => {
    expect(modelsFromEnv({ ...keys, LLM_PROVIDER: "gemini", GEMINI_FALLBACK_MODEL: "gemini-3.8-flash", GEMINI_API_KEY_Plus: "" }).name).toBe(
      "gemini:gemini-3.8-flash > groq:openai/gpt-oss-120b",
    );
  });
});

it("produces JSON Schema without the $schema keyword", () => {
  expect(jsonSchemaFor(schema)).not.toHaveProperty("$schema");
});
