import type { HoldState } from "@/lib/db/schema";

export const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(cents / 100);

/** Plain-language status for the protected person and their family. */
export const STATE_COPY: Record<HoldState, { title: string; body: string; tone: "wait" | "safe" | "sent" | "neutral" }> = {
  DRAFT: { title: "Waiting for PayPal", body: "Approve the payment in PayPal to continue.", tone: "neutral" },
  HELD: { title: "Held, not sent", body: "Your money is reserved in PayPal but has not moved.", tone: "wait" },
  ASSESSING: { title: "Checking", body: "We are asking a few questions to make sure this is safe.", tone: "wait" },
  COOLING_OFF: { title: "Waiting to be safe", body: "This payment waits a little while before it goes out. You can still stop it.", tone: "wait" },
  VERIFYING: { title: "Checking with your family", body: "We asked the person named in the story to confirm it is really them.", tone: "wait" },
  APPROVED: { title: "Approved", body: "Sending now.", tone: "sent" },
  RELEASED: { title: "Sent", body: "The money went to the verified person.", tone: "sent" },
  DENIED: { title: "Stopped", body: "The payment was stopped. Your money is being released back to you.", tone: "safe" },
  VOIDED: { title: "Kept safe", body: "The payment was cancelled. The money never left your account.", tone: "safe" },
  CANCELLED: { title: "Cancelled", body: "Nothing was sent.", tone: "neutral" },
};
