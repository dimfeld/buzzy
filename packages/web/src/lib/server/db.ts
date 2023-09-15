import { env } from '$env/dynamic/private';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const sqlite = new Database(env.DB_PATH || 'buzzy.db');
export const db: BetterSQLite3Database = drizzle(sqlite);

migrate(db, { migrationsFolder: env.DB_MIGRATIONS_PATH || 'src/lib/server/db/migrations' });

export * from './db/schema.js';
export { sql } from 'drizzle-orm';
