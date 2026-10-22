import "server-only";
import { judgeMode } from "./scenarios";

/** Judge Mode routes answer 404 unless JUDGE_MODE=1. */
export const judgeOff = () => (judgeMode() ? null : Response.json({ error: "Judge Mode is off" }, { status: 404 }));

/** Form posts come back to a page with a 303, so the browser follows with a GET. */
export const backTo = (request: Request, path: string) => Response.redirect(new URL(path, request.url), 303);
