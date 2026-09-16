export interface User {
  id: string;
  username: string;
  createdAt: Date;
}

export interface Thread {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateThreadInput {
  userId: string;
  title?: string;
}

export interface CreateMessageInput {
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ListThreadsOptions {
  limit?: number;
  offset?: number;
}
