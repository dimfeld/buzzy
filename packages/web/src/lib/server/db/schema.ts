import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chats = sqliteTable('chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title'),

  started_at: integer('started_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
  last_message_at: integer('last_message_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export const messages = sqliteTable(
  'messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    chat_id: integer('chat_id')
      .references(() => chats.id)
      .notNull(),
    timestamp: integer('timestamp', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => {
    return {
      chatIdx: index('chat_idx').on(table.chat_id, table.timestamp),
    };
  }
);
