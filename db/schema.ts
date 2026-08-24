import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const gameProgress = sqliteTable('game_progress', {
  clientId: text('client_id').primaryKey(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
