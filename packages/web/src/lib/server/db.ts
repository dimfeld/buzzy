import { env } from '$env/dynamic/private';
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const sqlite = new Database(env.DB_PATH || 'buzzy.db');
export const db: BunSQLiteDatabase = drizzle(sqlite);

migrate(db, { migrationsFolder: env.DB_MIGRATIONS_PATH || 'src/lib/server/db/migrations' });

export * from './db/schema.js';
export { sql } from 'drizzle-orm';
