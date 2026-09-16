import { IUserRepository, PgUserRepository, InMemoryUserRepository } from "./repositories/user-repository";
import { IThreadRepository, PgThreadRepository, InMemoryThreadRepository } from "./repositories/thread-repository";
import { IMessageRepository, PgMessageRepository, InMemoryMessageRepository } from "./repositories/message-repository";

export * from "./repositories/types";
export * from "./repositories/user-repository";
export * from "./repositories/thread-repository";
export * from "./repositories/message-repository";
export * from "./db";
export * from "./migrate";

let userRepositoryInstance: IUserRepository | null = null;
let threadRepositoryInstance: IThreadRepository | null = null;
let messageRepositoryInstance: IMessageRepository | null = null;

let forceInMemory = false;

export function setForceInMemoryRepositories(value: boolean): void {
  forceInMemory = value;
  userRepositoryInstance = null;
  threadRepositoryInstance = null;
  messageRepositoryInstance = null;
}

export function isForceInMemory(): boolean {
  return forceInMemory;
}

export function getUserRepository(): IUserRepository {
  if (!userRepositoryInstance) {
    userRepositoryInstance = forceInMemory ? new InMemoryUserRepository() : new PgUserRepository();
  }
  return userRepositoryInstance;
}

export function getThreadRepository(): IThreadRepository {
  if (!threadRepositoryInstance) {
    threadRepositoryInstance = forceInMemory ? new InMemoryThreadRepository() : new PgThreadRepository();
  }
  return threadRepositoryInstance;
}

export function getMessageRepository(): IMessageRepository {
  if (!messageRepositoryInstance) {
    messageRepositoryInstance = forceInMemory ? new InMemoryMessageRepository() : new PgMessageRepository();
  }
  return messageRepositoryInstance;
}
