import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
const DEFAULT_PGLITE_DIR = ".pglite";

type Handle = { db: Db; migrate: () => Promise<void>; close: () => Promise<void> };

/**
 * DATABASE_URL picks the driver: a postgres:// URL uses node-postgres (Render),
 * anything else is a PGlite data directory ("memory://" for tests, empty for ./.pglite).
 */
export function createDb(url = process.env.DATABASE_URL ?? ""): Handle {
  if (/^postgres(ql)?:\/\//.test(url)) {
    const pool = new Pool({ connectionString: url, max: 5 });
    const db = drizzlePg(pool, { schema });
    return {
      db: db as unknown as Db,
      migrate: () => migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => pool.end(),
    };
  }
  const client = new PGlite(url.replace(/^pglite:/, "") || DEFAULT_PGLITE_DIR);
  const db = drizzlePglite(client, { schema });
  return {
    db: db as unknown as Db,
    migrate: () => migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => client.close(),
  };
}

// One handle per server process; globalThis keeps it across dev hot reloads.
const globalForDb = globalThis as unknown as { suresendDb?: Promise<Handle> };

export function getDb(): Promise<Db> {
  globalForDb.suresendDb ??= (async () => {
    const handle = createDb();
    await handle.migrate();
    return handle;
  })();
  return globalForDb.suresendDb.then((h) => h.db);
}

export { schema };
