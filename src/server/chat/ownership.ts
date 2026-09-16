import { getThreadRepository, Thread } from "../persistence";
import { AuthorizationError } from "../auth/session";

export class ThreadNotFoundError extends Error {
  constructor(message = "Thread not found") {
    super(message);
    this.name = "ThreadNotFoundError";
  }
}

export async function assertThreadOwnership(userId: string, threadId: string): Promise<Thread> {
  const threadRepo = getThreadRepository();
  const thread = await threadRepo.findById(threadId);

  if (!thread) {
    throw new ThreadNotFoundError(`Thread with id '${threadId}' does not exist.`);
  }

  if (thread.userId !== userId) {
    throw new AuthorizationError(
      `Access denied: User '${userId}' is not the owner of thread '${threadId}'.`
    );
  }

  return thread;
}
