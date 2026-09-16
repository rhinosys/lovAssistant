import { getDbPool } from "../db";
import { User } from "./types";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  createOrFind(username: string): Promise<User>;
}

export class PgUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const pool = getDbPool();
    const result = await pool.query<{
      id: string;
      username: string;
      created_at: Date;
    }>("SELECT id, username, created_at FROM users WHERE id = $1", [id]);

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      createdAt: row.created_at,
    };
  }

  async findByUsername(username: string): Promise<User | null> {
    const pool = getDbPool();
    const result = await pool.query<{
      id: string;
      username: string;
      created_at: Date;
    }>("SELECT id, username, created_at FROM users WHERE username = $1", [username]);

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      createdAt: row.created_at,
    };
  }

  async createOrFind(username: string): Promise<User> {
    const pool = getDbPool();
    const result = await pool.query<{
      id: string;
      username: string;
      created_at: Date;
    }>(
      `INSERT INTO users (username)
       VALUES ($1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username, created_at`,
      [username]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      createdAt: row.created_at,
    };
  }
}

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.username === username) return u;
    }
    return null;
  }

  async createOrFind(username: string): Promise<User> {
    const existing = await this.findByUsername(username);
    if (existing) return existing;

    const user: User = {
      id: `usr_${Math.random().toString(36).substring(2, 11)}`,
      username,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }
}
