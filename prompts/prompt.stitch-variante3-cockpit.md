# Prompt Stitch MCP — Variante 3 : Cockpit Technique & Télémétrie Atelier

## Objectif

Ce document fournit le **prompt maître et la spécification d'IHM** pour concevoir et générer avec le **MCP Stitch** l'interface utilisateur **« Variante 3 : Cockpit Technique & Télémétrie Atelier »** pour l'assistant IA du FabLab (`AdminLova` / Laboratoire Ouvert Villeurbanne).

---

## Métadonnées & Références Stitch

- **Serveur MCP** : `StitchMCP`
- **ID Projet Stitch existant** : `13326532547682155599` (*FabLab LOV Assistant Chat*)
- **ID Écran de référence** : `projects/13326532547682155599/screens/ce5a4355785b48bdab731398eea80809`
- **Titre de la variante** : `Variante 3 : Cockpit Technique & Télémétrie Atelier`
- **Cible technique** : Next.js 15 (App Router), Tailwind CSS (Dark Mode Slate/Industrial), Lucide React & Google Material Symbols, JetBrains Mono / Geist / Inter.

---

# PROMPT OFFICIEL POUR LE MCP STITCH (`generate_screen_from_text` / `edit_screens`)

```text
Design a professional, high-density, dark industrial "Fabmanager Technical Cockpit & Workshop Telemetry" interface (Desktop 2560x1440/1024, responsive) for a FabLab AI Assistant called "Fablab LOV - COCKPIT PRO".

### Visual Identity & Theme
- Color Palette: Deep Slate/Charcoal background (#0B0F17, #0F131C, #111827), Card containers (#1A2234), Border accents (#28354D).
- Accent Colors: High-contrast Fablab Emerald (#10B981) for ready/AI streaming/success states, Machine Cyan (#06B6D4) for busy/cooling/laser telemetry, Warning Amber (#F59E0B) for safety alerts/heating, and Alert Red (#EF4444) for faults/E-stop.
- Typography: Geist for headlines/display, Inter for chat and prose body, JetBrains Mono for metrics, G-code, tokens/s, telemetry, and vector scores.
- Glassmorphism: Subtle backdrop blurs (backdrop-blur-md), 1px razor hairline borders, glowing LED pulse indicators.

### Layout Structure (3-Column HUD + Top Telemetry Bar)

1. TOP BAR (Global Workshop Telemetry & Local Inference Engine):
   - Brand logo "Fablab LOV" with a green badge "COCKPIT PRO" and subtitle "Télémétrie Atelier & Copilote".
   - 4 Live Machine Status Pills in the center:
     * Trotec Laser 300: Active pulsing Cyan dot, "EN DÉCOUPE", "Occupée · 42 min restantes".
     * Prusa XL (5 têtes): Green dot, "68%" with an active progress bar.
     * Shapeoko CNC: Amber dot, "STANDBY", "En attente job #209".
     * Lab Électronique: Green dot, "DISPONIBLE", "Postes fer & scope libres".
   - Dual Inference Engine Status: "Ollama · GPU Metal/CUDA | VRAM 6.4 GB · 28.4 tok/s" and Mistral AI Cloud indicator.
   - Right toggle button "Docs & Logs" and user avatar badge "FM" (Fabmanager).

2. LEFT COLUMN (Sidebar Deck - 260px):
   - "Nouveau diagnostic" primary action button with shortcut hint [^N].
   - Machine telemetry filters (Laser CO₂, FDM 3D, CNC Fraisage, Électronique).
   - Dual Engine Switcher: Segmented toggle between [Ollama Local LAN] (emerald) and [Mistral AI Cloud] (indigo) with dynamic model dropdown.
   - Vector Search History (pgvector): List of recent queries with cosine distance scores (e.g., "PMMA 5mm Trotec 300 · cos_dist: 0.058 · top-1", "G-Code Surfaçage Chêne CNC · cos_dist: 0.112").
   - Wiki Tag Cloud: (#trotec, #laser-sécurité, #pmma-coulé, #gcode, #troflow).
   - Live Database Footer Stats: "Base DokuWiki: 482 pages", "pgvector Chunks: 3,890", "Temps d'exécution RAG: 41 ms".

3. CENTRAL COLUMN (Main Cockpit & Conversational Stream):
   - Sticky Header: Breadcrumb "CONSOLE D'USINAGE #LOV-LSR-300 / PMMA Coulé 5mm · Mode Polissage Laser", "Snapshot JSON" action button, and pulsing "SYNC TEMPS RÉEL" badge.
   - User message bubble (Maker ID #lov-418): "Donne-moi les paramètres optimisés pour découper du plexiglas coulé de 5 mm sur la Trotec Speedy 300, avec une arête transparente polie, sans brûler les contours, et la checklist machine."
   - Assistant Cockpit Response:
     * Model header badge: "Copilote Fablab LOV | MISTRAL-7B-LOV-INSTRUCT | Inférence: 420ms · 28.4 tok/s | ID: #EXEC-8902".
     * Collapsible RAG Inspector Accordion: Expandable block showing retrieved chunks from DokuWiki/YesWiki (e.g., Machines/laser_trotec_speedy300.md lines 140-168 with Cosine Distance 0.058, 94.2% similarity), embedding model info, and HNSW index metrics.
     * Certified Machining Parameter Matrix: 4-metric cards displaying Tube Power (85.0% / ~68W), Translation Speed (0.60%), Pulse Frequency (20,000 Hz), and Lens/Focus (2.0" Cale Noire).
     * Pass Simulator & Sequence Widget: Visual progress bars for Cutting Depth (100%), Air Assist pressure (30%), and Troflow Smoke Extraction (100% / 320 m³/h).
     * Exportable Machine Code Box: Multi-tab preview for Trotec JobControl XML and CNC G-Code with "Copier XML" and "G-Code" one-click copy buttons.
     * Workshop Safety & Fire Alert Callout: Warning banner highlighting PMMA flammability precautions and mandatory honeycomb bed inspection.
     * Action Bar: "Pousser le preset sur la machine via MQTT LOV" and "Consulter la page Wiki".
   - MCP 2-Step Action Confirmation Card (when sensitive write actions are triggered): Diff preview, execution payload, HMAC signature input, and "Valider l'exécution" / "Annuler" buttons.
   - Persistent Bottom Prompt Composer: Rounded command input with active badges "RAG: pgvector activé", "Filtre: Trotec Speedy 300", shortcut hint "Ctrl + Entrée", and "Exécuter" play button.

4. RIGHT COLUMN (Drawer Dock - 320px, Collapsible):
   - Header: "Docs LOV & Checklist" with close button.
   - Interactive Pre-flight Checklist: 4 interactive checkboxes with live counter (e.g., "1. Allumer le filtre Troflow LOV & aspiration", "2. Faire le point focal avec la cale LOV", "3. Vérifier aspiration sous nid d'abeilles", "4. Retirer le film protecteur face supérieure").
   - Live DokuWiki / YesWiki Markdown Preview: Formatted table with exact speeds/powers per thickness (3mm, 5mm, 8mm) and direct deep link "Ouvrir la page wiki".
   - Live Workshop Telemetry Log Stream: Monospaced real-time event logs with colored timestamps for RAG queries, Ollama streaming tokens, bed temperature sensors (23.4°C), and filter depression (180 Pa).
```

---

## Spécification Détaillée des Composants

### 1. Palette de Couleurs & Tokens CSS

| Token | Valeur Hex / RGBA | Rôle & Usage |
| :--- | :--- | :--- |
| `surface-deep` | `#0B0F17` | Arrière-plan global (fond sombre terminal) |
| `surface-canvas` | `#111827` | Fond des colonnes et barres d'outils |
| `surface-card` | `#1A2234` | Conteneurs des fiches d'usinage et messages |
| `surface-elevated`| `#1F293D` | Overlays, popovers, drawers et modales |
| `border-subtle` | `#28354D` | Bordures fines structurelles 1px |
| `primary` | `#10B981` | Vert émeraude FabLab (Ollama, succès, RAG OK, validé) |
| `secondary` | `#06B6D4` | Cyan machine (Trotec Laser, flux air assist, streaming) |
| `machine-warning`| `#F59E0B` | Ambre de sécurité (alertes feu, CNC standby, maintenance) |
| `machine-error` | `#EF4444` | Rouge d'urgence (arrêt d'urgence, erreurs moteur) |
| `text-primary` | `#F9FAFB` | Texte principal à fort contraste |
| `text-secondary` | `#9CA3AF` | Sous-titres et métadonnées |
| `text-muted` | `#64748B` | Valeurs de télémétrie tertiaires, horodatages |

---

### 2. Typographie & Polices

- **Titres & Display** : `Geist`, `sans-serif` (poids 600/700, letter-spacing `-0.02em`)
- **Corps de texte & Chat** : `Inter`, `sans-serif` (poids 400/500, line-height `24px`)
- **Télémétrie & Code** : `JetBrains Mono`, `monospace` (poids 500/700 pour les valeurs numériques, scores cosinus, G-code et XML)

---

### 3. Matrice Technique des Paramètres d'Usinage

```text
┌───────────────────────────┬───────────────────────────┬───────────────────────────┬───────────────────────────┐
│ PUISSANCE TUBE            │ VITESSE TRANSLATION       │ FRÉQUENCE IMPULSIONS      │ LENTILLE / FOCUS          │
│ 85.0 % (~68W continus)    │ 0.60 % (Avance lente)     │ 20 000 Hz (Polissage th.) │ 2.0" Cale Noire (Focal 0) │
└───────────────────────────┴───────────────────────────┴───────────────────────────┴───────────────────────────┘
```

---

### 4. Checklist Avant Lancement Machine (Pre-flight)

1. `[x]` **Allumer le filtre Troflow LOV & aspiration** (Dépression > 180 Pa)
2. `[x]` **Faire le point focal avec la cale LOV** (Suspension mécanique 2.0")
3. `[x]` **Vérifier l'aspiration sous le nid d'abeilles** (Plaquage du matériau)
4. `[x]` **Retirer le film protecteur sur la face supérieure du PMMA**

---

### 5. Intégration RAG Vectoriel (DokuWiki & YesWiki)

- **Score Cosinus affiché** : `Distance = 0.058` (Similarité `94.2%`)
- **Chunks cités** :
  - `Machines/laser_trotec_speedy300.md` (lignes 140-168)
  - `Securite/consignes_laser.md` (lignes 12-30)
- **Index Technique** : `pgvector HNSW (m=16, ef_construction=64)`, dimension 1024.

---

### 6. Guide d'Exécution avec le MCP Stitch

Pour générer ou mettre à jour un écran dans Stitch :

```typescript
// Exemple d'appel MCP Stitch : generate_screen_from_text
await call_mcp_tool({
  ServerName: "StitchMCP",
  ToolName: "generate_screen_from_text",
  Arguments: {
    projectId: "13326532547682155599",
    prompt: "Variante 3 : Cockpit Technique & Télémétrie Atelier pour Fablab LOV. Dark industrial UI with 3-column layout, real-time machine telemetry bar at the top, pgvector RAG inspector accordion, certified machining parameter matrix, interactive pre-flight checklist, and live MQTT log stream.",
    deviceType: "DESKTOP"
  }
});
```
