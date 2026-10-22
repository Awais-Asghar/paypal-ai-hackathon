// Creates the local database (PGlite in ./.pglite unless DATABASE_URL is set), runs migrations
// and seeds the demo circle. Usage: npm run seed
import { createDb } from "../src/lib/db";
import { seedDemo, seedEnvFromProcess } from "../src/lib/db/seed";

const handle = createDb();
try {
  await handle.migrate();
  const env = seedEnvFromProcess();
  const result = await seedDemo(handle.db, env);
  console.log(result.created ? `Seeded demo circle ${result.circleId}` : `Demo circle already exists (${result.circleId})`);
  if (!env.ethanPayerId) console.log("Note: SANDBOX_ETHAN_PAYER_ID is empty, so Ethan can't verify or receive payouts yet.");
} finally {
  await handle.close();
}
