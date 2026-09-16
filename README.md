# Assistant IA Fablab (AdminLova) — Phase 1 : Chat Local

Assistant conversationnel auto-hébergé pour le fablab, propulsé par inférence locale Ollama, `assistant-ui` et stockage PostgreSQL.

---

## 🏗️ Architecture (Phase 1)

```text
Navigateur Web (assistant-ui)
       │
       │ HTTPS / Stream SSE
       ▼
Next.js 15 Backend (Frontière de sécurité)
  ├── Authentification & Isolation des sessions
  ├── Gestion des threads & messages
  ├── Provider Ollama local
  └── Observabilité & Sondes de santé
       │
       ├────────► PostgreSQL 16 (persistance relationnelle)
       │
       └────────► Ollama Local (http://host.docker.internal:11434)
```

- **Inférence 100% locale** : communication directe avec l'instance Ollama du fablab, sans recours au cloud.
- **Frontière de sécurité** : le navigateur n'accède jamais directement à Ollama ou aux identifiants.
- **Persistance** : PostgreSQL avec isolation stricte des conversations par utilisateur.
- **Extensibilité** : emplacements prêts pour Phase 2 (RAG & citations wikis) et Phase 3 (outils administratifs MCP).

---

## 📋 Prérequis

1. **Node.js** 20+ ou 22+ & **npm** 10+
2. **Docker** & **Docker Compose** (ou une instance PostgreSQL 16 locale)
3. **Ollama** installé sur la machine hôte avec le modèle configuré (par ex. `qwen2.5:7b-instruct-q4_K_M` ou `qwen2.5:3b`)

---

## 🚀 Démarrage Rapide

### 1. Configuration des variables d'environnement

Copiez le fichier d'exemple `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Vérifiez les paramètres dans `.env` :
- `DATABASE_URL` : chaîne de connexion PostgreSQL.
- `OLLAMA_BASE_URL` : URL de votre instance Ollama locale (ex. `http://127.0.0.1:11434` en local ou `http://host.docker.internal:11434` sous Docker).
- `OLLAMA_MODEL` : nom du modèle installé (ex. `qwen2.5:7b-instruct-q4_K_M`).
- `SESSION_SECRET` : clé secrète pour les sessions utilisateur (min. 16 caractères).

### 2. Télécharger le modèle dans Ollama

Assurez-vous qu'Ollama est démarré et que le modèle est présent :

```bash
ollama pull qwen2.5:7b-instruct-q4_K_M
# ou pour les machines plus légères :
ollama pull qwen2.5:3b
```

### 3. Lancer avec Docker Compose (Recommandé)

Démarre PostgreSQL (avec extension pgvector) et l'application Next.js :

```bash
docker compose up -d --build
```

L'application est disponible sur : **[http://localhost:3000](http://localhost:3000)**.

### 4. Ou Démarrage en Mode Développement Local

Si vous disposez de PostgreSQL en local ou via Docker :

```bash
# Lancer PostgreSQL seul via Docker si besoin
docker compose up -d postgres

# Installer les dépendances
npm install

# Lancer les tests automatisés
npm test

# Lancer le serveur de développement
npm run dev
```

---

## 🩺 Sondes de Santé & Diagnostics

- **Liveness probe** : `GET http://localhost:3000/api/health`
- **Readiness probe** : `GET http://localhost:3000/api/health/ready`
  - Vérifie la connectivité PostgreSQL et la disponibilité du serveur Ollama.

Exemple de réponse saine :
```json
{
  "status": "ok",
  "dependencies": {
    "database": { "status": "healthy", "latencyMs": 3 },
    "ollama": { "status": "healthy", "latencyMs": 11, "models": ["qwen2.5:7b-instruct-q4_K_M"] }
  }
}
```

---

## 🧪 Tests Automatisés

Pour exécuter la suite de tests unitaires et d'intégration :

```bash
npm test
```

Couverture des tests :
- ✅ Validation et fail-fast de la configuration
- ✅ Masquage des données sensibles et journalisation structurée
- ✅ Persistance des conversations, threads et messages dans PostgreSQL
- ✅ Isolation stricte des utilisateurs (rejet 403 des accès inter-utilisateurs)
- ✅ Abstraction du provider Ollama et gestion des pannes / modèles manquants
- ✅ Validation de schéma d'entrée et streaming SSE `/api/chat`
- ✅ Endpoints de gestion de threads `/api/threads`

---

## 🗺️ Feuilles de route suivantes (OpenSpec)

- **Phase 2** : `add-wiki-rag-citations` (Synchronisation wikis distants, recherche hybride FTS + pgvector, citations cliquables).
- **Phase 3** : `add-mcp-administrative-tools` (Client MCP backend, validation des schémas d'outils, confirmation humaine explicite et audit).
