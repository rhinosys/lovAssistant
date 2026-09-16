# YunoHost Package for AdminLova Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package AdminLova (Next.js chat assistant) as an installable YunoHost app, plus the three minimal app-side patches (SSO auth, basePath, DB migration script) it depends on.

**Architecture:** Two repos. (1) `AdminLova` (this repo) gets three small, backward-compatible patches. (2) A new sibling repo `admin_lova_ynh` (YunoHost packaging convention) holds `manifest.toml`, install/upgrade/remove/backup/restore/change_url scripts, and nginx/systemd/cron config templates. The YunoHost package clones AdminLova at a pinned ref, builds it natively (no Docker) via `ynh_install_nodejs` + systemd, and provisions a dedicated Postgres DB via `ynh_add_psql_db`.

**Tech Stack:** Next.js 15 / React 19 / TypeScript / vitest (AdminLova side); Bash + YunoHost helpers (`ynh_*`) targeting `packaging_format = 2`, `integration.yunohost >= 11.2` (packaging side).

## Global Constraints

- Node.js version for the package: 22 (matches `Dockerfile`'s `node:22-alpine`).
- No Docker in the YunoHost package — native systemd service, per YunoHost packaging conventions.
- No Ollama service installed by the package — Mistral Cloud is the default engine; Ollama is an optional external LAN URL.
- basePath must be resolved at **build time** (Next.js requirement) — every script that changes the URL (`install`, `upgrade`, `change_url`) must re-run `npm run build`.
- Package scope is personal/LOV use — no YunoHost catalog CI is required.
- All three AdminLova patches must stay backward-compatible: existing dev/Docker usage (no SSO headers, no basePath, direct `npm start`) must keep working unchanged.

---

## Part A — AdminLova app patches

### Task 1: SSO header support in auth service

**Files:**
- Modify: `src/server/auth/session.ts:75-126` (method `TokenAuthService.authenticateRequest`)
- Test: `src/server/auth/auth.test.ts`

**Interfaces:**
- Consumes: existing `SessionUser` type (`src/server/auth/types.ts`), existing `getUserRepository()` from `src/server/persistence`.
- Produces: no signature change — `authenticateRequest` still returns `Promise<SessionUser>`. Later tasks don't depend on new exports from this task.

- [ ] **Step 1: Write the failing test**

Add to `src/server/auth/auth.test.ts`, inside the `describe("Authentication & User Isolation", ...)` block, a new nested `describe`:

```typescript
  describe("YunoHost SSO headers", () => {
    it("authenticates from the Remote-User header when present", async () => {
      const user = await authService.authenticateRequest({
        "remote-user": "alice.ynh",
      });
      expect(user.username).toBe("alice.ynh");
    });

    it("falls back to Auth-User when Remote-User is absent", async () => {
      const user = await authService.authenticateRequest({
        "auth-user": "bob.ynh",
      });
      expect(user.username).toBe("bob.ynh");
    });

    it("prefers Remote-User over Auth-User when both are present", async () => {
      const user = await authService.authenticateRequest({
        "remote-user": "alice.ynh",
        "auth-user": "bob.ynh",
      });
      expect(user.username).toBe("alice.ynh");
    });

    it("prefers Remote-User over the legacy x-username fallback", async () => {
      const user = await authService.authenticateRequest({
        "remote-user": "alice.ynh",
        "x-username": "legacy-user",
      });
      expect(user.username).toBe("alice.ynh");
    });

    it("still supports the legacy x-username header when no SSO header is present", async () => {
      const user = await authService.authenticateRequest({
        "x-username": "legacy-user",
      });
      expect(user.username).toBe("legacy-user");
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth.test.ts`
Expected: FAIL — the three SSO-header tests fail because `remote-user`/`auth-user` are not read (they fall through to the anonymous `fablab_member` default), while the two legacy tests already pass.

- [ ] **Step 3: Write minimal implementation**

In `src/server/auth/session.ts`, inside `authenticateRequest`, insert a new check **between** the cookie check (step 2, ending around line 103) and the existing `x-user-id`/`x-username` block (step 3, starting around line 106):

```typescript
    // 3. YunoHost SSO (SSOwat) headers — takes priority over the legacy dev fallback
    const remoteUser = getHeader("remote-user") || getHeader("auth-user");
    if (remoteUser) {
      const userRepo = getUserRepository();
      const user = await userRepo.createOrFind(remoteUser);
      return {
        id: user.id,
        username: user.username,
        roles: ["member"],
      };
    }
```

Renumber the comment on the following block from `// 3. PoC Dev fallback...` to `// 4. PoC Dev fallback...` and the final default block comment stays as-is (it becomes step 5 conceptually, no need to renumber the code itself — only comments are affected, do not change behavior).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth.test.ts`
Expected: PASS — all tests in `auth.test.ts` green, including the 5 new SSO tests and the pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/session.ts src/server/auth/auth.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): support YunoHost SSO headers (Remote-User/Auth-User)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Dynamic basePath support

**Files:**
- Modify: `next.config.ts`
- Create: `src/lib/api-url.ts`
- Test: `src/lib/api-url.test.ts`
- Modify: `src/app/chat/page.tsx:85,103,161,187,219` (the 5 `fetch("/api/...")` call sites)

**Interfaces:**
- Produces: `apiUrl(path: string): string` exported from `src/lib/api-url.ts`. Later tasks (none in this plan) would import it as `import { apiUrl } from "@/lib/api-url"`.
- Consumes: `process.env.NEXT_PUBLIC_BASE_PATH` (client-visible env var, empty string when unset).

- [ ] **Step 1: Write the failing test**

Create `src/lib/api-url.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { apiUrl } from "./api-url";

describe("apiUrl", () => {
  const originalValue = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalValue;
    }
  });

  it("returns the path unchanged when no base path is set", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(apiUrl("/api/threads")).toBe("/api/threads");
  });

  it("returns the path unchanged when the base path is an empty string", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    expect(apiUrl("/api/threads")).toBe("/api/threads");
  });

  it("prefixes the path with the configured base path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/assistant";
    expect(apiUrl("/api/threads")).toBe("/assistant/api/threads");
  });

  it("strips a trailing slash from the base path before prefixing", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/assistant/";
    expect(apiUrl("/api/threads")).toBe("/assistant/api/threads");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api-url.test.ts`
Expected: FAIL with "Cannot find module './api-url'" (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/api-url.ts`:

```typescript
export function apiUrl(path: string): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  return `${basePath}${path}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api-url.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Wire basePath into next.config.ts**

Replace the contents of `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const basePath = (process.env.NEXT_BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
```

- [ ] **Step 6: Use apiUrl() at every fetch call site in chat/page.tsx**

In `src/app/chat/page.tsx`:

1. Add the import near the top, after the `MarkdownContent` import (currently line 22):

```typescript
import { apiUrl } from "@/lib/api-url";
```

2. Line 85 — change:
```typescript
      const res = await fetch("/api/threads");
```
to:
```typescript
      const res = await fetch(apiUrl("/api/threads"));
```

3. Line 103 — change:
```typescript
        const res = await fetch("/api/health/ready");
```
to:
```typescript
        const res = await fetch(apiUrl("/api/health/ready"));
```

4. Line 161 — change:
```typescript
      const res = await fetch(`/api/threads/${threadId}`);
```
to:
```typescript
      const res = await fetch(apiUrl(`/api/threads/${threadId}`));
```

5. Line 187 — change:
```typescript
      const res = await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
```
to:
```typescript
      const res = await fetch(apiUrl(`/api/threads/${threadId}`), { method: "DELETE" });
```

6. Line 219 — change:
```typescript
      const response = await fetch("/api/chat", {
```
to:
```typescript
      const response = await fetch(apiUrl("/api/chat"), {
```

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS — all existing tests plus the new `api-url.test.ts` green.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual verification with no basePath (regression check)**

Run: `npm run dev`, open `http://localhost:3005/chat`, send a message, confirm it still works exactly as before (no basePath set → `apiUrl` is a no-op).

- [ ] **Step 9: Commit**

```bash
git add next.config.ts src/lib/api-url.ts src/lib/api-url.test.ts src/app/chat/page.tsx
git commit -m "$(cat <<'EOF'
feat(routing): support a configurable basePath for sub-path installs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Explicit DB migration script

**Files:**
- Create: `scripts/migrate.ts`
- Modify: `package.json` (add `db:migrate` script)

**Interfaces:**
- Consumes: `runMigrations()` from `src/server/persistence/migrate.ts` (already exists, returns `Promise<string[]>` — the list of applied migration file names).
- Produces: CLI command `npm run db:migrate`, exit code 0 on success / 1 on failure (consumed by the YunoHost `install`/`upgrade` scripts in Part B).

- [ ] **Step 1: Write the script**

Create `scripts/migrate.ts`, following the same pattern as `scripts/index-rag.ts` (env loading + top-level run + error exit code):

```typescript
import { runMigrations } from "../src/server/persistence/migrate";

// Load local environment variables
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // Optional
}

async function run() {
  console.log("=== DATABASE MIGRATIONS ===");
  const applied = await runMigrations();
  if (applied.length === 0) {
    console.log("Aucune nouvelle migration à appliquer.");
  } else {
    console.log(`✓ ${applied.length} migration(s) appliquée(s) :`);
    for (const name of applied) {
      console.log(`  - ${name}`);
    }
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, inside `"scripts"`, add a new entry right after `"lint": "next lint",`:

```json
    "db:migrate": "tsx scripts/migrate.ts",
```

- [ ] **Step 3: Verify it runs against the local dev database**

Run: `npm run db:migrate`
Expected: prints `=== DATABASE MIGRATIONS ===` then either `Aucune nouvelle migration à appliquer.` (if `001_initial_schema.sql` was already applied by a prior app run) or lists it as newly applied. Exit code 0.

- [ ] **Step 4: Verify idempotency**

Run: `npm run db:migrate` a second time immediately after.
Expected: `Aucune nouvelle migration à appliquer.` — confirms the `_schema_migrations` guard table prevents re-application, which the YunoHost `upgrade` script relies on.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate.ts package.json
git commit -m "$(cat <<'EOF'
feat(db): add explicit npm run db:migrate script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part B — `admin_lova_ynh` packaging repo

All tasks below operate in a new sibling repo: `/Users/nrineau/Projects/admin_lova_ynh`. Task 4 creates and initializes it; every later task assumes it already exists and is the working directory for file paths given as `<repo>/...`.

### Task 4: Repo skeleton and manifest.toml

**Files:**
- Create: `<repo>/manifest.toml`
- Create: `<repo>/doc/DESCRIPTION.md`
- Create: `<repo>/scripts/_common.sh`

**Interfaces:**
- Produces: `manifest.toml` resource IDs consumed by every later script: `main` (app resource), `database` (Postgres, `ynh_psql_*` helpers), `install_dir` (`$install_dir` variable), `port` (`$port` variable), `system_user` (`$app` system user). Install questions produced: `mistral_api_key`, `ollama_base_url`.
- Produces: `<repo>/scripts/_common.sh` sourced by every script in Part B — defines `YNH_MISTRAL_MODEL_DEFAULT="mistral-small-latest"` and the function `admin_lova_build()` (runs `npm ci && npm run build` with the right env vars), reused by `install`, `upgrade`, and `change_url`.

- [ ] **Step 1: Initialize the repo**

```bash
mkdir -p /Users/nrineau/Projects/admin_lova_ynh/{conf,scripts,doc}
cd /Users/nrineau/Projects/admin_lova_ynh
git init
```

- [ ] **Step 2: Write manifest.toml**

Create `<repo>/manifest.toml`:

```toml
packaging_format = 2

id = "admin_lova"
name = "Assistant Fablab (AdminLova)"
description.fr = "Assistant IA de chat pour le FabLab, avec RAG sur le wiki historique"
description.en = "AI chat assistant for the FabLab, with RAG over the historical wiki"

version = "0.1.0~ynh1"

maintainers = ["nicolas.rineau"]

[upstream]
license = "free"
website = "https://labovilleurbanne.fr/"
code = "https://github.com/nrineau/AdminLova"

[integration]
yunohost = ">= 11.2"
architectures = "all"
multi_instance = true
ldap = false
sso = true
disk = "200M"
ram.build = "1G"
ram.runtime = "300M"

[install]
    [install.domain]
    type = "domain"

    [install.path]
    type = "path"
    default = "/"

    [install.init_main_permission]
    type = "group"
    default = "visitors"

    [install.mistral_api_key]
    ask.fr = "Clé API Mistral AI (obligatoire, pour le chat et le RAG)"
    ask.en = "Mistral AI API key (required, used for chat and RAG)"
    type = "string"

    [install.ollama_base_url]
    ask.fr = "URL d'un serveur Ollama local sur le réseau (optionnel, laisser vide si non utilisé)"
    ask.en = "URL of a local Ollama server on the LAN (optional, leave empty if unused)"
    type = "string"
    default = ""
    optional = true

[resources]
    [resources.system_user]

    [resources.install_dir]

    [resources.ports]
        main.default = 3005

    [resources.apt]
        packages = "postgresql"

    [resources.database]
        type = "postgresql"
```

- [ ] **Step 3: Write doc/DESCRIPTION.md**

Create `<repo>/doc/DESCRIPTION.md`:

```markdown
Assistant IA de chat pour le FabLab de Villeurbanne (LOV), basé sur
Next.js et assistant-ui. Répond aux questions sur les machines et
procédures de l'atelier en s'appuyant sur :

- le wiki YesWiki actuel du LOV (interrogé en direct) ;
- les archives historiques du DokuWiki du LOV (indexées localement via
  un pipeline RAG : scraping, découpage en chunks, embeddings Mistral).

Moteur de chat : Mistral AI Cloud par défaut, avec possibilité de
configurer un serveur Ollama local sur le réseau en complément.
```

- [ ] **Step 4: Write scripts/_common.sh**

Create `<repo>/scripts/_common.sh`:

```bash
#!/bin/bash

ADMIN_LOVA_REPO="https://github.com/nrineau/AdminLova"
ADMIN_LOVA_REF="main"

# Runs npm ci + npm run build with the env vars that must be baked into
# the build (NEXT_BASE_PATH/NEXT_PUBLIC_BASE_PATH affect next.config.ts
# at build time and cannot be changed afterwards without rebuilding).
admin_lova_build() {
	pushd "$install_dir" || ynh_die --message="Cannot cd into $install_dir"

	ynh_hide_warnings ynh_exec_as "$app" env PATH="$PATH" npm ci --production=false
	NEXT_BASE_PATH="$next_base_path" \
		NEXT_PUBLIC_BASE_PATH="$next_base_path" \
		ynh_exec_as "$app" env PATH="$PATH" npm run build

	popd || ynh_die --message="Cannot leave $install_dir"
}

# Computes next_base_path from YunoHost's $path variable ("" for root,
# "/assistant" for a sub-path — Next.js basePath must never be a bare "/").
compute_next_base_path() {
	if [ "$path" = "/" ]; then
		next_base_path=""
	else
		next_base_path="${path%/}"
	fi
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add manifest.toml doc/DESCRIPTION.md scripts/_common.sh
git commit -m "$(cat <<'EOF'
feat: initial manifest.toml and shared script helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: nginx and systemd config templates

**Files:**
- Create: `<repo>/conf/nginx.conf`
- Create: `<repo>/conf/systemd.service`

**Interfaces:**
- Consumes: YunoHost template variables substituted by `ynh_add_nginx_config`/`ynh_add_systemd_config` at install/upgrade/change_url time: `$path`, `$port`, `$install_dir`, `$app`.
- Produces: files referenced by name (`nginx.conf`, `systemd.service`) from Task 6/7/10's calls to `ynh_add_nginx_config`/`ynh_add_systemd_config`.

- [ ] **Step 1: Write conf/nginx.conf**

Create `<repo>/conf/nginx.conf`:

```nginx
location __PATH__/ {
  proxy_pass http://127.0.0.1:__PORT__/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # Streaming chat responses use text/event-stream — disable buffering
  proxy_buffering off;
  proxy_read_timeout 300s;

  more_set_headers "Content-Security-Policy: frame-ancestors 'self'";
}
```

(`__PATH__` and `__PORT__` are YunoHost's standard nginx template placeholders, substituted by `ynh_add_nginx_config` from `$path` and `$port`. When `$path` is `/`, YunoHost's helper collapses `__PATH__/` correctly to `/` — this is standard behavior, no special-casing needed here.)

- [ ] **Step 2: Write conf/systemd.service**

Create `<repo>/conf/systemd.service`:

```ini
[Unit]
Description=Assistant Fablab (AdminLova)
After=network.target postgresql.service

[Service]
Type=simple
User=__APP__
Group=__APP__
WorkingDirectory=__INSTALL_DIR__
EnvironmentFile=__INSTALL_DIR__/.env
ExecStart=__YNH_NODE__/node __INSTALL_DIR__/node_modules/.bin/next start -p __PORT__
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/__APP__/__APP__.log
StandardError=inherit

[Install]
WantedBy=multi-user.target
```

(`__APP__`, `__INSTALL_DIR__`, `__PORT__`, `__YNH_NODE__` are substituted by `ynh_add_systemd_config` from `$app`, `$install_dir`, `$port`, and the Node.js path set up by `ynh_install_nodejs` in Task 6.)

- [ ] **Step 3: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add conf/nginx.conf conf/systemd.service
git commit -m "$(cat <<'EOF'
feat: add nginx and systemd config templates

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: install script

**Files:**
- Create: `<repo>/scripts/install`
- Create: `<repo>/conf/.env.template`

**Interfaces:**
- Consumes: `admin_lova_build()` and `compute_next_base_path()` from Task 4's `_common.sh`; `manifest.toml` questions `mistral_api_key`, `ollama_base_url` (available as `$mistral_api_key`, `$ollama_base_url` YunoHost env vars); resources from Task 4 (`$db_name`, `$db_user`, `$db_pwd`, `$install_dir`, `$port`, `$app`, `$path`, `$domain`).
- Produces: `$install_dir/.env` file (consumed by Task 7's upgrade script, which regenerates it the same way) and the running systemd service (consumed by Task 5's `.service` file, already written, and by Task 8/backup).

- [ ] **Step 1: Write conf/.env.template**

Create `<repo>/conf/.env.template`:

```bash
DATABASE_URL="postgresql://__DB_USER__:__DB_PWD__@localhost:5432/__DB_NAME__"
NODE_ENV="production"
PORT=__PORT__
SESSION_SECRET="__SESSION_SECRET__"
LOG_LEVEL="info"

MISTRAL_API_KEY="__MISTRAL_API_KEY__"
MISTRAL_MODEL="mistral-small-latest"
MISTRAL_BASE_URL="https://api.mistral.ai/v1"
DEFAULT_LLM_PROVIDER="mistral"

OLLAMA_BASE_URL="__OLLAMA_BASE_URL__"
OLLAMA_MODEL="qwen2.5:7b-instruct-q4_K_M"

APP_BASE_URL="https://__DOMAIN____PATH__"
YESWIKI_BASE_URL="https://labovilleurbanne.fr/yeswiki/"

NEXT_BASE_PATH="__NEXT_BASE_PATH__"
NEXT_PUBLIC_BASE_PATH="__NEXT_BASE_PATH__"
```

- [ ] **Step 2: Write scripts/install**

Create `<repo>/scripts/install`:

```bash
#!/bin/bash

source /usr/share/yunohost/helpers
source scripts/_common.sh

ynh_script_progression --message="Validating installation parameters..."

compute_next_base_path

ynh_script_progression --message="Storing settings..."
session_secret=$(ynh_string_random --length=32)
ynh_app_setting_set --app=$app --key=session_secret --value="$session_secret"
ynh_app_setting_set --app=$app --key=mistral_api_key --value="$mistral_api_key"
ynh_app_setting_set --app=$app --key=ollama_base_url --value="$ollama_base_url"

ynh_script_progression --message="Installing Node.js..."
ynh_install_nodejs --nodejs_version=22

ynh_script_progression --message="Fetching sources..."
ynh_setup_source --dest_dir="$install_dir" --source_id="app" \
	--full_replace=1 --git_repo="$ADMIN_LOVA_REPO" --git_revision="$ADMIN_LOVA_REF"
chown -R "$app:$app" "$install_dir"

ynh_script_progression --message="Configuring environment..."
env_path="$install_dir/.env"
cp conf/.env.template "$env_path"
ynh_replace_string --match_string="__DB_USER__" --replace_string="$db_user" --target_file="$env_path"
ynh_replace_string --match_string="__DB_PWD__" --replace_string="$db_pwd" --target_file="$env_path"
ynh_replace_string --match_string="__DB_NAME__" --replace_string="$db_name" --target_file="$env_path"
ynh_replace_string --match_string="__PORT__" --replace_string="$port" --target_file="$env_path"
ynh_replace_string --match_string="__SESSION_SECRET__" --replace_string="$session_secret" --target_file="$env_path"
ynh_replace_string --match_string="__MISTRAL_API_KEY__" --replace_string="$mistral_api_key" --target_file="$env_path"
ynh_replace_string --match_string="__OLLAMA_BASE_URL__" --replace_string="$ollama_base_url" --target_file="$env_path"
ynh_replace_string --match_string="__DOMAIN__" --replace_string="$domain" --target_file="$env_path"
ynh_replace_string --match_string="__PATH__" --replace_string="${path%/}" --target_file="$env_path"
ynh_replace_string --match_string="__NEXT_BASE_PATH__" --replace_string="$next_base_path" --target_file="$env_path"
chmod 600 "$env_path"
chown "$app:$app" "$env_path"

ynh_script_progression --message="Building the application (this can take a few minutes)..."
admin_lova_build

ynh_script_progression --message="Running database migrations..."
ynh_exec_as "$app" env PATH="$PATH" --chdir="$install_dir" npm run db:migrate

ynh_script_progression --message="Building the initial RAG index (scraping the DokuWiki, this can take a minute)..."
ynh_exec_as "$app" env PATH="$PATH" --chdir="$install_dir" npm run rag:crawl \
	|| ynh_print_warn --message="RAG crawl failed — the app will still work, without RAG grounding, until the next cron refresh."
ynh_exec_as "$app" env PATH="$PATH" --chdir="$install_dir" npm run rag:index \
	|| ynh_print_warn --message="RAG indexing failed — the app will still work, without RAG grounding, until the next cron refresh."

ynh_script_progression --message="Configuring systemd service..."
ynh_add_systemd_config
yunohost service add "$app" --description="Assistant Fablab (AdminLova)" --log="/var/log/$app/$app.log"

ynh_script_progression --message="Configuring nginx..."
ynh_add_nginx_config

ynh_script_progression --message="Configuring the RAG refresh cron job..."
ynh_add_config --template="../conf/cron_rag_refresh" --destination="/etc/cron.weekly/$app-rag-refresh"
chmod +x "/etc/cron.weekly/$app-rag-refresh"

ynh_script_progression --message="Starting the application..."
ynh_systemd_action --service_name="$app" --action="start" \
	--log_path="/var/log/$app/$app.log" --line_match="Ready in"

ynh_script_progression --message="Installation complete" --last
```

- [ ] **Step 3: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add conf/.env.template scripts/install
git commit -m "$(cat <<'EOF'
feat: add install script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: cron RAG refresh config

**Files:**
- Create: `<repo>/conf/cron_rag_refresh`

**Interfaces:**
- Consumes: nothing beyond the app's own npm scripts (`rag:crawl`, `rag:index`, both already present in `package.json`).
- Produces: the file installed by Task 6's `install` script (and Task 8's `upgrade` script) at `/etc/cron.weekly/$app-rag-refresh`.

- [ ] **Step 1: Write conf/cron_rag_refresh**

Create `<repo>/conf/cron_rag_refresh`:

```bash
#!/bin/bash
# Weekly RAG refresh for __APP__ — re-scrapes the DokuWiki and re-indexes it.
# Installed by the install/upgrade scripts at /etc/cron.weekly/__APP__-rag-refresh.

LOG_FILE="/var/log/__APP__/rag-refresh.log"
cd "__INSTALL_DIR__" || exit 1

{
	echo "=== $(date -Iseconds) — RAG refresh starting ==="
	sudo -u __APP__ env PATH="$PATH" npm run rag:crawl
	sudo -u __APP__ env PATH="$PATH" npm run rag:index
	echo "=== $(date -Iseconds) — RAG refresh finished ==="
} >> "$LOG_FILE" 2>&1
```

(`__APP__` and `__INSTALL_DIR__` are substituted by `ynh_add_config` in Task 6's `install` script, from `$app` and `$install_dir`.)

- [ ] **Step 2: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add conf/cron_rag_refresh
git commit -m "$(cat <<'EOF'
feat: add weekly RAG refresh cron template

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: upgrade script

**Files:**
- Create: `<repo>/scripts/upgrade`

**Interfaces:**
- Consumes: same helpers/variables as Task 6 (`admin_lova_build`, `compute_next_base_path`, all `$db_*`/`$install_dir`/`$port`/`$app` resource variables, plus `$session_secret`/`$mistral_api_key`/`$ollama_base_url` read back via `ynh_app_setting_get`).
- Produces: nothing new — refreshes the same `.env`, build output, and systemd/nginx/cron config Task 6 created.

- [ ] **Step 1: Write scripts/upgrade**

Create `<repo>/scripts/upgrade`:

```bash
#!/bin/bash

source /usr/share/yunohost/helpers
source scripts/_common.sh

ynh_script_progression --message="Reading settings..."
session_secret=$(ynh_app_setting_get --app=$app --key=session_secret)
mistral_api_key=$(ynh_app_setting_get --app=$app --key=mistral_api_key)
ollama_base_url=$(ynh_app_setting_get --app=$app --key=ollama_base_url)

compute_next_base_path

ynh_script_progression --message="Stopping the application..."
ynh_systemd_action --service_name="$app" --action="stop"

ynh_script_progression --message="Upgrading Node.js..."
ynh_install_nodejs --nodejs_version=22

ynh_script_progression --message="Fetching updated sources..."
ynh_setup_source --dest_dir="$install_dir" --source_id="app" \
	--full_replace=1 --git_repo="$ADMIN_LOVA_REPO" --git_revision="$ADMIN_LOVA_REF" \
	--keep="wiki-old .env"
chown -R "$app:$app" "$install_dir"

ynh_script_progression --message="Refreshing environment configuration..."
env_path="$install_dir/.env"
cp conf/.env.template "$env_path"
ynh_replace_string --match_string="__DB_USER__" --replace_string="$db_user" --target_file="$env_path"
ynh_replace_string --match_string="__DB_PWD__" --replace_string="$db_pwd" --target_file="$env_path"
ynh_replace_string --match_string="__DB_NAME__" --replace_string="$db_name" --target_file="$env_path"
ynh_replace_string --match_string="__PORT__" --replace_string="$port" --target_file="$env_path"
ynh_replace_string --match_string="__SESSION_SECRET__" --replace_string="$session_secret" --target_file="$env_path"
ynh_replace_string --match_string="__MISTRAL_API_KEY__" --replace_string="$mistral_api_key" --target_file="$env_path"
ynh_replace_string --match_string="__OLLAMA_BASE_URL__" --replace_string="$ollama_base_url" --target_file="$env_path"
ynh_replace_string --match_string="__DOMAIN__" --replace_string="$domain" --target_file="$env_path"
ynh_replace_string --match_string="__PATH__" --replace_string="${path%/}" --target_file="$env_path"
ynh_replace_string --match_string="__NEXT_BASE_PATH__" --replace_string="$next_base_path" --target_file="$env_path"
chmod 600 "$env_path"
chown "$app:$app" "$env_path"

ynh_script_progression --message="Rebuilding the application..."
admin_lova_build

ynh_script_progression --message="Running database migrations..."
ynh_exec_as "$app" env PATH="$PATH" --chdir="$install_dir" npm run db:migrate

ynh_script_progression --message="Refreshing systemd and nginx configuration..."
ynh_add_systemd_config
ynh_add_nginx_config

ynh_script_progression --message="Refreshing the RAG cron job..."
ynh_add_config --template="../conf/cron_rag_refresh" --destination="/etc/cron.weekly/$app-rag-refresh"
chmod +x "/etc/cron.weekly/$app-rag-refresh"

ynh_script_progression --message="Restarting the application..."
ynh_systemd_action --service_name="$app" --action="start" \
	--log_path="/var/log/$app/$app.log" --line_match="Ready in"

ynh_script_progression --message="Upgrade complete" --last
```

- [ ] **Step 2: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add scripts/upgrade
git commit -m "$(cat <<'EOF'
feat: add upgrade script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: remove script

**Files:**
- Create: `<repo>/scripts/remove`

**Interfaces:**
- Consumes: `$app`, `$install_dir` (YunoHost resource variables — the Postgres DB is torn down automatically by the `database` resource declared in Task 4's `manifest.toml`, no explicit `ynh_psql_remove_db` call needed under `packaging_format = 2`).
- Produces: nothing — terminal task, nothing depends on it.

- [ ] **Step 1: Write scripts/remove**

Create `<repo>/scripts/remove`:

```bash
#!/bin/bash

source /usr/share/yunohost/helpers

ynh_script_progression --message="Removing the systemd service..."
ynh_remove_systemd_config
yunohost service remove "$app" 2>/dev/null || true

ynh_script_progression --message="Removing the nginx configuration..."
ynh_remove_nginx_config

ynh_script_progression --message="Removing the RAG refresh cron job..."
ynh_secure_remove --file="/etc/cron.weekly/$app-rag-refresh"

ynh_script_progression --message="Removing Node.js..."
ynh_remove_nodejs

ynh_script_progression --message="Removing application files..."
ynh_secure_remove --file="$install_dir"

ynh_script_progression --message="Removing log files..."
ynh_secure_remove --file="/var/log/$app"

ynh_script_progression --message="Removal complete" --last
```

(The Postgres database itself is dropped automatically by YunoHost's resource system since `resources.database` is declared in `manifest.toml` — no manual `ynh_psql_remove_db` call is required under `packaging_format = 2`.)

- [ ] **Step 2: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add scripts/remove
git commit -m "$(cat <<'EOF'
feat: add remove script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: backup and restore scripts

**Files:**
- Create: `<repo>/scripts/backup`
- Create: `<repo>/scripts/restore`

**Interfaces:**
- Consumes (backup): `$app`, `$install_dir` and the `database` resource's own backup hook (declared in Task 4's `manifest.toml`, handled automatically — no manual `ynh_psql_dump_db` call needed under `packaging_format = 2`).
- Consumes (restore): the archive produced by `backup`; `admin_lova_build()` and `compute_next_base_path()` from Task 4's `_common.sh`.
- Produces: nothing further downstream — both are terminal, invoked directly by YunoHost core.

- [ ] **Step 1: Write scripts/backup**

Create `<repo>/scripts/backup`:

```bash
#!/bin/bash

source /usr/share/yunohost/helpers

ynh_script_progression --message="Backing up the application files..."
ynh_backup --src_path="$install_dir" --not_mandatory

ynh_script_progression --message="Backing up the systemd and nginx configuration..."
ynh_backup --src_path="/etc/systemd/system/$app.service"
ynh_backup --src_path="/etc/nginx/conf.d/$domain.d/$app.conf"

ynh_script_progression --message="Backing up the RAG refresh cron job..."
ynh_backup --src_path="/etc/cron.weekly/$app-rag-refresh" --not_mandatory

ynh_script_progression --message="Backup complete" --last
```

(The Postgres database dump is handled automatically by the `database` resource declared in `manifest.toml` — no manual `ynh_psql_dump_db` call is needed under `packaging_format = 2`. `$install_dir` already contains `wiki-old/` — its `markdown/`, `raw/`, `manifest.json`, and `vector-index.json` — so it's backed up as part of the app files, no separate step needed.)

- [ ] **Step 2: Write scripts/restore**

Create `<repo>/scripts/restore`:

```bash
#!/bin/bash

source /usr/share/yunohost/helpers
source scripts/_common.sh

ynh_script_progression --message="Restoring application files..."
ynh_restore_file --origin_path="$install_dir"
chown -R "$app:$app" "$install_dir"

ynh_script_progression --message="Restoring Node.js..."
ynh_install_nodejs --nodejs_version=22

ynh_script_progression --message="Restoring systemd and nginx configuration..."
ynh_restore_file --origin_path="/etc/systemd/system/$app.service"
ynh_restore_file --origin_path="/etc/nginx/conf.d/$domain.d/$app.conf"
systemctl enable "$app.service"

ynh_script_progression --message="Restoring the RAG refresh cron job..."
ynh_restore_file --origin_path="/etc/cron.weekly/$app-rag-refresh" --not_mandatory
chmod +x "/etc/cron.weekly/$app-rag-refresh" 2>/dev/null || true

ynh_script_progression --message="Starting the application..."
ynh_systemd_action --service_name="$app" --action="start" \
	--log_path="/var/log/$app/$app.log" --line_match="Ready in"

yunohost service add "$app" --description="Assistant Fablab (AdminLova)" --log="/var/log/$app/$app.log"

ynh_script_progression --message="Restore complete" --last
```

(The Postgres database itself is restored automatically by the `database` resource before this script runs, under `packaging_format = 2` — `$db_name`/`$db_user`/`$db_pwd` are already valid by the time `restore` executes, and `$install_dir/.env` restored above already points at them.)

- [ ] **Step 3: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add scripts/backup scripts/restore
git commit -m "$(cat <<'EOF'
feat: add backup and restore scripts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: change_url script

**Files:**
- Create: `<repo>/scripts/change_url`

**Interfaces:**
- Consumes: `admin_lova_build()` and `compute_next_base_path()` from Task 4's `_common.sh`; `$old_path`, `$new_path`, `$new_domain` (YunoHost-provided during a change-url operation), plus the same `$db_*`/session/API-key settings read via `ynh_app_setting_get` as Task 8.
- Produces: nothing further downstream — terminal task.

- [ ] **Step 1: Write scripts/change_url**

Create `<repo>/scripts/change_url`:

```bash
#!/bin/bash

source /usr/share/yunohost/helpers
source scripts/_common.sh

ynh_script_progression --message="Reading settings..."
session_secret=$(ynh_app_setting_get --app=$app --key=session_secret)
mistral_api_key=$(ynh_app_setting_get --app=$app --key=mistral_api_key)
ollama_base_url=$(ynh_app_setting_get --app=$app --key=ollama_base_url)

path="$new_path"
domain="$new_domain"
compute_next_base_path

ynh_script_progression --message="Stopping the application..."
ynh_systemd_action --service_name="$app" --action="stop"

ynh_script_progression --message="Updating environment configuration for the new URL..."
env_path="$install_dir/.env"
ynh_replace_string --match_string="^APP_BASE_URL=.*" --replace_string="APP_BASE_URL=\"https://${domain}${path%/}\"" --target_file="$env_path"
ynh_replace_string --match_string="^NEXT_BASE_PATH=.*" --replace_string="NEXT_BASE_PATH=\"$next_base_path\"" --target_file="$env_path"
ynh_replace_string --match_string="^NEXT_PUBLIC_BASE_PATH=.*" --replace_string="NEXT_PUBLIC_BASE_PATH=\"$next_base_path\"" --target_file="$env_path"

ynh_script_progression --message="Rebuilding the application (basePath is baked in at build time)..."
admin_lova_build

ynh_script_progression --message="Updating nginx configuration..."
ynh_change_url_nginx_config

ynh_script_progression --message="Restarting the application..."
ynh_systemd_action --service_name="$app" --action="start" \
	--log_path="/var/log/$app/$app.log" --line_match="Ready in"

ynh_script_progression --message="Change of URL complete" --last
```

- [ ] **Step 2: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add scripts/change_url
git commit -m "$(cat <<'EOF'
feat: add change_url script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: make all scripts executable and add top-level README

**Files:**
- Modify: file permissions on `<repo>/scripts/install`, `<repo>/scripts/upgrade`, `<repo>/scripts/remove`, `<repo>/scripts/backup`, `<repo>/scripts/restore`, `<repo>/scripts/change_url`, `<repo>/scripts/_common.sh`, `<repo>/conf/cron_rag_refresh`
- Create: `<repo>/README.md`

**Interfaces:**
- Consumes: nothing (finishing/packaging task).
- Produces: nothing — this is the last task in the plan.

- [ ] **Step 1: Set executable permissions**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
chmod +x scripts/install scripts/upgrade scripts/remove scripts/backup scripts/restore scripts/change_url scripts/_common.sh conf/cron_rag_refresh
```

- [ ] **Step 2: Write README.md**

Create `<repo>/README.md`:

```markdown
# admin_lova_ynh

Package YunoHost pour l'Assistant IA Fablab (AdminLova) — voir
[doc/DESCRIPTION.md](doc/DESCRIPTION.md) pour la description fonctionnelle,
et le fichier
[docs/superpowers/specs/2026-09-16-yunohost-package-design.md](https://github.com/nrineau/AdminLova/blob/main/docs/superpowers/specs/2026-09-16-yunohost-package-design.md)
du dépôt AdminLova pour le design complet.

## Installer sur une instance YunoHost de test

```bash
yunohost app install https://github.com/<votre-compte>/admin_lova_ynh --debug
```

## Périmètre

Usage personnel / LOV. Ne vise pas (pour l'instant) le catalogue officiel
YunoHost — pas de CI YunoHost, pas de tests multi-architecture.
```

- [ ] **Step 3: Verify the repo is complete**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
ls -la scripts/ conf/ doc/
git status
```

Expected: working tree clean (everything committed), and the listing shows all files from Tasks 4–11.

- [ ] **Step 4: Commit**

```bash
cd /Users/nrineau/Projects/admin_lova_ynh
git add README.md
git commit -m "$(cat <<'EOF'
docs: add top-level README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Out of scope (per spec)

- Installing/managing an Ollama service from the package.
- YunoHost catalog submission requirements (CI, multi-arch tests, `tests.toml`).
- Migrating the JSON vector store to pgvector.
- Manual validation on a real YunoHost server/VM (install, upgrade, backup/restore round-trip) — this requires an actual YunoHost instance and is a follow-up manual QA pass after this plan's tasks are merged, not an automatable step here.
