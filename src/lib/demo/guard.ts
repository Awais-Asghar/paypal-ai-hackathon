import "server-only";
import { judgeMode } from "./scenarios";

/** Judge Mode routes answer 404 unless JUDGE_MODE=1. */
export const judgeOff = () => (judgeMode() ? null : Response.json({ error: "Judge Mode is off" }, { status: 404 }));
