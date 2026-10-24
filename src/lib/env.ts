/**
 * The app's public address: APP_BASE_URL if set, else the URL Render gives a web service
 * (RENDER_EXTERNAL_URL), else local dev on 127.0.0.1 (Log In with PayPal rejects localhost).
 */
export const appBaseUrl = (env: Record<string, string | undefined> = process.env) =>
  (env.APP_BASE_URL || env.RENDER_EXTERNAL_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
