import { getDbPool } from "../db";
import { Thread, CreateThreadInput, ListThreadsOptions } from "./types";

export interface IThreadRepository {
  create(input: CreateThreadInput): Promise<Thread>;
  findById(id: string): Promise<Thread | null>;
  listByUserId(userId: string, options?: ListThreadsOptions): Promise<Thread[]>;
  updateTitle(id: string, title: string): Promise<Thread | null>;
  delete(id: string): Promise<boolean>;
}

export class PgThreadRepository implements IThreadRepository {
  async create(input: CreateThreadInput): Promise<Thread> {
    const pool = getDbPool();
    const title = input.title || "Nouvelle conversation";
    const result = await pool.query<{
      id: string;
      user_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO threads (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id, title, created_at, updated_at`,
      [input.userId, title]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findById(id: string): Promise<Thread | null> {
    const pool = getDbPool();
    const result = await pool.query<{
      id: string;
      user_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
    }>(
      "SELECT id, user_id, title, created_at, updated_at FROM threads WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listByUserId(userId: string, options: ListThreadsOptions = {}): Promise<Thread[]> {
    const pool = getDbPool();
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const result = await pool.query<{
      id: string;
      user_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, user_id, title, created_at, updated_at
       FROM threads
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updateTitle(id: string, title: string): Promise<Thread | null> {
    const pool = getDbPool();
    const result = await pool.query<{
      id: string;
      user_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE threads
       SET title = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, user_id, title, created_at, updated_at`,
      [title, id]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async delete(id: string): Promise<boolean> {
    const pool = getDbPool();
    const result = await pool.query("DELETE FROM threads WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export class InMemoryThreadRepository implements IThreadRepository {
  private threads: Map<string, Thread> = new Map();

  async create(input: CreateThreadInput): Promise<Thread> {
    const thread: Thread = {
      id: `thr_${Math.random().toString(36).substring(2, 11)}`,
      userId: input.userId,
      title: input.title || "Nouvelle conversation",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.threads.set(thread.id, thread);
    return thread;
  }

  async findById(id: string): Promise<Thread | null> {
    return this.threads.get(id) || null;
  }

  async listByUserId(userId: string, options: ListThreadsOptions = {}): Promise<Thread[]> {
    const list: Thread[] = [];
    for (const t of this.threads.values()) {
      if (t.userId === userId) {
        list.push(t);
      }
    }
    list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    return list.slice(offset, offset + limit);
  }

  async updateTitle(id: string, title: string): Promise<Thread | null> {
    const thread = this.threads.get(id);
    if (!thread) return null;
    thread.title = title;
    thread.updatedAt = new Date();
    return thread;
  }

  async delete(id: string): Promise<boolean> {
    return this.threads.delete(id);
  }
}
