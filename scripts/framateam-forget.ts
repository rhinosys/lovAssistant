import os from "node:os";
import { resetConfigCache } from "../src/server/config";
import { closeDbPool } from "../src/server/persistence/db";
import { getFramateamStore } from "../src/server/framateam/store";
import { createThreadRebuilder, forgetChannel, forgetPost } from "../src/server/framateam/privacy";

// Load local environment variables
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
    resetConfigCache();
  }
} catch {
  // Optional
}

const HELP = `Usage :
  npm run framateam:forget -- --post <id|permalien>   retire un message de l'index (définitivement)
  npm run framateam:forget -- --channel <nom|id>      retire tout un canal et désactive son indexation
  npm run framateam:forget -- --list                  liste les canaux et le nombre de fils indexés`;

async function run() {
  const [flag, value] = process.argv.slice(2);
  const by = `cli:${os.userInfo().username}`;
  const store = getFramateamStore();
  if (flag === "--list") {
    const counts = await store.countThreadsByChannel();
    for (const c of await store.listChannels()) {
      const flags = [c.indexEnabled ? "indexé" : "non indexé", c.listenEnabled ? "bot actif" : null].filter(Boolean).join(", ");
      console.log(`~${c.name} (${c.channelId}) — ${flags} — ${c.postsRead} message(s) lu(s), ${counts.get(c.channelId) ?? 0} fil(s) indexé(s)`);
    }
    return;
  }
  if (flag === "--post" && value) {
    const result = await forgetPost(value, { by, store, rebuild: await createThreadRebuilder(store) });
    console.log(`Message ${result.postId} ajouté à la liste des messages retirés.`);
    if (!result.threadRemoved) console.log("Il n'était pas indexé ; il ne le sera jamais.");
    else if (result.rootPostId === result.postId) console.log("Le fil complet a été retiré de l'index.");
    else console.log(result.threadRebuilt ? "Le fil a été réindexé sans ce message." : "Le fil a été retiré ; il sera réindexé sans ce message lors de sa prochaine modification.");
    return;
  }
  if (flag === "--channel" && value) {
    const { channel, removedChunks } = await forgetChannel(value, { by, store });
    console.log(`Canal ~${channel.name} retiré de l'index (${removedChunks} extrait(s) supprimé(s)) ; indexation désactivée.`);
    return;
  }
  console.log(HELP);
  if (flag !== "--help" && flag !== "-h") process.exitCode = 1;
}

run()
  .catch((err) => {
    console.error("Échec :", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDbPool());
