import { eq } from "drizzle-orm";
import type { Db } from "./index";
import { circles, members, payees } from "./schema";

export const DEMO_CIRCLE_NAME = "Collins family";

export type SeedEnv = {
  margaretEmail?: string;
  ethanEmail?: string;
  ethanPayerId?: string;
  robertEmail?: string;
};

export function seedEnvFromProcess(env = process.env): SeedEnv {
  return {
    margaretEmail: env.SANDBOX_MARGARET_EMAIL,
    ethanEmail: env.SANDBOX_ETHAN_EMAIL,
    ethanPayerId: env.SANDBOX_ETHAN_PAYER_ID,
    robertEmail: env.SANDBOX_ROBERT_EMAIL,
  };
}

/** Demo circle from docs/DEMO_PLAN.md. Does nothing if it already exists. */
export async function seedDemo(db: Db, env: SeedEnv) {
  const [existing] = await db.select().from(circles).where(eq(circles.name, DEMO_CIRCLE_NAME));
  if (existing) return { circleId: existing.id, created: false };

  return db.transaction(async (t) => {
    const [circle] = await t.insert(circles).values({ name: DEMO_CIRCLE_NAME }).returning();
    const [margaret, ethan] = await t
      .insert(members)
      .values([
        { circleId: circle.id, role: "protected", name: "Margaret Collins", contactEmail: env.margaretEmail ?? null, paypalEmail: env.margaretEmail ?? null },
        {
          circleId: circle.id,
          role: "trusted",
          name: "Ethan Collins",
          contactEmail: env.ethanEmail ?? null,
          paypalEmail: env.ethanEmail ?? null,
          paypalPayerId: env.ethanPayerId ?? null,
          verifiedAt: env.ethanPayerId ? new Date() : null,
        },
        { circleId: circle.id, role: "trusted", name: "Sarah Collins", contactEmail: null },
      ])
      .returning();
    await t.insert(payees).values([
      { circleId: circle.id, label: "Ethan Collins (grandson)", paypalEmail: env.ethanEmail ?? "ethan@example.com", memberId: ethan.id, known: true },
      { circleId: circle.id, label: "Robert Hayes (landlord)", paypalEmail: env.robertEmail ?? "robert@example.com", known: true },
      { circleId: circle.id, label: "Officer Daniels (bail office)", paypalEmail: "bail-office@example.com", known: false },
    ]);
    return { circleId: circle.id, created: true, protectedMemberId: margaret.id };
  });
}
