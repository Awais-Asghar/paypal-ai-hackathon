import "server-only";
import { modelsFromEnv } from "@/lib/ai/llm";
import { getDb } from "@/lib/db";
import { ReportService } from "./service";

let service: Promise<ReportService> | undefined;

export function getReports() {
  service ??= getDb().then((db) => new ReportService(db, modelsFromEnv()));
  return service;
}

export { canReport, moneyLost, outcomeOf } from "./service";
