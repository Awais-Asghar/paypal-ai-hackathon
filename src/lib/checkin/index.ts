import "server-only";
import { CheckinAgent } from "@/lib/ai/checkin-agent";
import { modelsFromEnv } from "@/lib/ai/llm";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { getDb } from "@/lib/db";
import { getGate } from "@/lib/gate";
import { CheckinService } from "./service";

let service: Promise<CheckinService> | undefined;

export function getCheckin() {
  service ??= Promise.all([getDb(), getGate()]).then(
    ([db, gate]) => new CheckinService(db, gate, new CheckinAgent(modelsFromEnv()), (file, name) => transcribeAudio(file, name)),
  );
  return service;
}
