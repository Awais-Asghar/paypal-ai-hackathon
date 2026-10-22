import { getCheckin } from "@/lib/checkin";
import { errorResponse } from "@/lib/http";

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm"];

// A screenshot of the message (read by Gemini vision) or a voicemail (transcribed by Groq Whisper).
export async function POST(request: Request, ctx: RouteContext<"/api/holds/[id]/checkin/evidence">) {
  const { id } = await ctx.params;
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No file" }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 10 MB" }, { status: 413 });
    const kind = IMAGE_TYPES.includes(file.type) ? "screenshot" : AUDIO_TYPES.includes(file.type) ? "voicemail" : null;
    if (!kind) return Response.json({ error: "Use a PNG, JPEG or WebP screenshot, or an audio file" }, { status: 415 });

    const text = await (await getCheckin()).addEvidence(id, kind, file);
    if (!text) return Response.json({ kind, read: false, message: "We couldn't read that file. You can describe it in your own words instead." });
    return Response.json({ kind, read: true, text });
  } catch (e) {
    return errorResponse(e);
  }
}
