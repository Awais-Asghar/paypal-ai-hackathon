// Voicemail to text with Groq Whisper (OpenAI-compatible transcription endpoint).
export async function transcribeAudio(file: Blob, filename: string, env = process.env, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!env.GROQ_API_KEY) return null;
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", env.GROQ_STT_MODEL || "whisper-large-v3-turbo");
  form.append("response_format", "json");
  try {
    const res = await fetchImpl("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { text?: string };
    return body.text?.trim().slice(0, 8000) || null;
  } catch {
    return null;
  }
}
