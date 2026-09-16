import { getDbPool } from "../db";
import { Message, CreateMessageInput } from "./types";

export interface IMessageRepository {
  create(input: CreateMessageInput): Promise<Message>;
  listByThreadId(threadId: string): Promise<Message[]>;
  deleteByThreadId(threadId: string): Promise<number>;
}

export class PgMessageRepository implements IMessageRepository {
  async create(input: CreateMessageInput): Promise<Message> {
    const pool = getDbPool();
    const metadata = input.metadata || {};

    const result = await pool.query<{
      id: string;
      thread_id: string;
      role: string;
      content: string;
      metadata: Record<string, unknown>;
      created_at: Date;
    }>(
      `INSERT INTO messages (thread_id, role, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id, thread_id, role, content, metadata, created_at`,
      [input.threadId, input.role, input.content, JSON.stringify(metadata)]
    );

    // Also update thread updated_at
    await pool.query("UPDATE threads SET updated_at = NOW() WHERE id = $1", [input.threadId]);

    const row = result.rows[0];
    return {
      id: row.id,
      threadId: row.thread_id,
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
    };
  }

  async listByThreadId(threadId: string): Promise<Message[]> {
    const pool = getDbPool();
    const result = await pool.query<{
      id: string;
      thread_id: string;
      role: string;
      content: string;
      metadata: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT id, thread_id, role, content, metadata, created_at
       FROM messages
       WHERE thread_id = $1
       ORDER BY created_at ASC`,
      [threadId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
    }));
  }

  async deleteByThreadId(threadId: string): Promise<number> {
    const pool = getDbPool();
    const result = await pool.query("DELETE FROM messages WHERE thread_id = $1", [threadId]);
    return result.rowCount ?? 0;
  }
}

export class InMemoryMessageRepository implements IMessageRepository {
  private messages: Map<string, Message> = new Map();

  async create(input: CreateMessageInput): Promise<Message> {
    const message: Message = {
      id: `msg_${Math.random().toString(36).substring(2, 11)}`,
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      metadata: input.metadata || {},
      createdAt: new Date(),
    };
    this.messages.set(message.id, message);
    return message;
  }

  async listByThreadId(threadId: string): Promise<Message[]> {
    const list: Message[] = [];
    for (const m of this.messages.values()) {
      if (m.threadId === threadId) {
        list.push(m);
      }
    }
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return list;
  }

  async deleteByThreadId(threadId: string): Promise<number> {
    let count = 0;
    for (const [id, m] of this.messages.entries()) {
      if (m.threadId === threadId) {
        this.messages.delete(id);
        count++;
      }
    }
    return count;
  }
}
