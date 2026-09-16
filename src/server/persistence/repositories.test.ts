import { describe, it, expect, beforeEach } from "vitest";
import {
  setForceInMemoryRepositories,
  getUserRepository,
  getThreadRepository,
  getMessageRepository,
} from "./index";

describe("Persistence Layer & Repositories", () => {
  beforeEach(() => {
    setForceInMemoryRepositories(true);
  });

  it("creates and retrieves a user", async () => {
    const userRepo = getUserRepository();
    const user = await userRepo.createOrFind("marie_fablab");

    expect(user.id).toBeDefined();
    expect(user.username).toBe("marie_fablab");

    const found = await userRepo.findById(user.id);
    expect(found).not.toBeNull();
    expect(found?.username).toBe("marie_fablab");

    // Idempotent find-or-create
    const sameUser = await userRepo.createOrFind("marie_fablab");
    expect(sameUser.id).toBe(user.id);
  });

  it("manages threads lifecycle for a user", async () => {
    const userRepo = getUserRepository();
    const threadRepo = getThreadRepository();

    const user = await userRepo.createOrFind("jean_fablab");
    const thread1 = await threadRepo.create({ userId: user.id, title: "Impression 3D PLA" });
    const thread2 = await threadRepo.create({ userId: user.id, title: "Découpeuse Laser CO2" });

    expect(thread1.userId).toBe(user.id);
    expect(thread1.title).toBe("Impression 3D PLA");

    const userThreads = await threadRepo.listByUserId(user.id);
    expect(userThreads).toHaveLength(2);

    // Update title
    const updated = await threadRepo.updateTitle(thread1.id, "Impression 3D Résine UV");
    expect(updated?.title).toBe("Impression 3D Résine UV");

    // Delete thread
    const deleted = await threadRepo.delete(thread2.id);
    expect(deleted).toBe(true);

    const remainingThreads = await threadRepo.listByUserId(user.id);
    expect(remainingThreads).toHaveLength(1);
    expect(remainingThreads[0].id).toBe(thread1.id);
  });

  it("persists messages in chronological order with metadata", async () => {
    const userRepo = getUserRepository();
    const threadRepo = getThreadRepository();
    const messageRepo = getMessageRepository();

    const user = await userRepo.createOrFind("lucas_fablab");
    const thread = await threadRepo.create({ userId: user.id, title: "Réglage plateau" });

    const msg1 = await messageRepo.create({
      threadId: thread.id,
      role: "user",
      content: "Comment calibrer la buse ?",
      metadata: { source: "web_ui" },
    });

    const msg2 = await messageRepo.create({
      threadId: thread.id,
      role: "assistant",
      content: "Voici les étapes pour régler le Z-offset...",
      metadata: {
        model: "qwen2.5:7b-instruct",
        tokenCount: 42,
        futureCitations: ["S1", "S2"],
      },
    });

    const messages = await messageRepo.listByThreadId(thread.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe(msg1.id);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Comment calibrer la buse ?");

    expect(messages[1].id).toBe(msg2.id);
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].metadata.model).toBe("qwen2.5:7b-instruct");
    expect(messages[1].metadata.futureCitations).toEqual(["S1", "S2"]);
  });
});
