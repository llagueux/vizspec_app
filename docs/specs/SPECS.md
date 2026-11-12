# SPECS — Plan agentique

Spécifications d'implémentation de l'application décrite dans `README.md`. Ce document s'adresse aux agents de développement et à l'humain qui les supervise. En cas d'écart de détail avec le README, **ce document prévaut** (voir la section « Précisions par rapport au README »).

Convention : **DOIT** / **NE DOIT PAS** = exigence ferme ; **DEVRAIT** = recommandation.

---

## 1. Objectif et périmètre

### Objectif

Application **locale** de gestion de plans de développement, destinée à être exécutée par des agents IA via MCP : projets, tickets (features), sous-tickets (étapes), dépendances, vérifications exécutées par l'application, revue humaine au niveau de la feature, export `PLAN.md`.

### Hors périmètre (v1)

- Multi-utilisateur, authentification, accès réseau (l'application écoute **uniquement** sur `127.0.0.1`).
- Hébergement cloud.
- Opérations git d'écriture par l'application (branches, commits, merges). Tout cela est fait par les agents et l'humain.
- Dépendances entre projets, niveaux de hiérarchie supplémentaires.
- Estimations, sprints, pièces jointes.
- Import de `SPECS.md` / `PLAN.md` (après le MVP).

---

## 2. Glossaire

| Terme | Définition |
|---|---|
| Projet | Regroupe tickets, vérifications et conventions d'un dépôt git. Possède une clé courte (`APP`). |
| Ticket | Une feature. Clé : `APP-2`. |
| Étape | Un sous-ticket, unité de travail réclamée par un agent. Clé : `APP-2.1`. |
| Bail (lease) | Réservation temporaire d'une étape par un agent. |
| Vérification (check) | Commande nommée, définie par l'humain au niveau du projet (`test`, `lint`…). |
| Worktree | Répertoire de travail git dédié à une feature. |
| Prête (ready) | Étape `todo` dont toutes les dépendances sont satisfaites. Calculée, jamais stockée. |
| Profil | Sous-ensemble d'outils MCP exposé : `executor` ou `planner`. |

---

## 3. Architecture

### Stack

- TypeScript strict, Node.js LTS.
- Interface : Next.js (App Router), TailwindCSS, shadcn/ui.
- Base : SQLite via `better-sqlite3` et Drizzle ORM (migrations versionnées).
- MCP : SDK MCP officiel pour TypeScript, transport **stdio**.
- Validation : zod. Identifiants : ULID. Tests : Vitest.
- Les versions des dépendances DOIVENT être figées (lockfile) et choisies parmi des versions publiées depuis plus de deux semaines.

### Structure du dépôt

```
.
├─ src/
│  ├─ core/        # noyau métier : états, règles, transactions (aucune dépendance à Next ni MCP)
│  ├─ db/          # schéma Drizzle, migrations, seeds (types de projet)
│  ├─ runner/      # exécution des vérifications, lecture git en lecture seule
│  ├─ export/      # génération de PLAN.md (fonction pure)
│  ├─ mcp/         # serveur MCP (profils executor / planner)
│  └─ app/         # interface Next.js (façade mince sur le noyau)
├─ scripts/        # export-plan, outils de maintenance
├─ drizzle/        # migrations générées
└─ tests/
```

### Principes

- **Toute mutation passe par le noyau**, dans une transaction, et écrit un événement (`events`).
- Les couches UI et MCP sont des façades minces : aucune règle métier dupliquée.
- Validation des entrées avec zod aux frontières (outils MCP, server actions).
- Les agents et l'UI manipulent des **clés** (`APP-2`, `APP-2.1`) ; les ULID restent internes.
- Les dates sont stockées en millisecondes Unix (`integer`, mode `timestamp_ms`). Les colonnes JSON sont du texte JSON validé.
- **Aucune valeur par défaut n'est codée en dur ailleurs que dans le registre de réglages** (section 15) : tout le reste de l'application lit les valeurs effectives.

### SQLite et concurrence

- Emplacement par défaut : `~/.plan-agentique/plan.db` (variable `PLAN_DB_PATH`).
- Pragmas à l'ouverture : `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`.
- Plusieurs processus accèdent à la même base : le serveur Next.js et un ou plusieurs serveurs MCP (un par agent, lancés en stdio).
- Les opérations critiques (réclamation d'étape, création de plan, transitions) DOIVENT utiliser `BEGIN IMMEDIATE` pour éviter les courses.

---

## 4. Modèle de données

Convention : `PK` clé primaire, `FK` clé étrangère, `UQ` unicité. Les énumérations sont des colonnes `text` avec contrainte `CHECK`.

### `project_types`

Gabarits préremplis (seed) : `web-app`, `micro-saas`, `data-pipeline`, `library`, `other`.

| Colonne | Type | Notes |
|---|---|---|
| id | text PK | slug |
| name, description | text | |
| default_checks | json | noms de vérifications proposés à la création d'un projet |
| default_step_titles | json | étapes types proposées au planificateur |

### `projects`

| Colonne | Type | Notes |
|---|---|---|
| id | text PK | ULID |
| key | text UQ | `^[A-Z][A-Z0-9]{1,5}$`, immuable |
| name | text | |
| type_id | text FK | |
| repo_path | text | chemin absolu du dépôt |
| main_branch | text null | null = hérité du réglage `git.main_branch` |
| worktree_roots | json null | racines autorisées pour les worktrees ; null = hérité de `git.worktree_roots` |
| branch_convention | text null | null = hérité de `git.branch_convention` |
| commit_convention | text null | null = hérité de `git.commit_convention` |
| lease_minutes | integer null | null = hérité de `steps.lease_minutes` |
| max_attempts | integer null | null = hérité de `steps.max_attempts` |
| auto_export | boolean null | null = hérité de `export.auto_export` |
| export_dir | text null | null = hérité de `export.dir` |
| next_ticket_number | integer | défaut 1 |
| created_at, updated_at, archived_at | integer | |

Les colonnes marquées « null = hérité » sont des **surcharges** : `null` signifie que le projet suit le réglage global (section 15).

### `checks`

| Colonne | Type | Notes |
|---|---|---|
| id | text PK | |
| project_id | text FK | |
| name | text | `^[a-z][a-z0-9_-]*$`, UQ par projet |
| command | text | exécutée par un shell dans le worktree |
| cwd | text | relatif au worktree, défaut `.` |
| timeout_seconds | integer | valeur initiale tirée du réglage `checks.default_timeout_seconds` à la création |
| expected_exit_code | integer | défaut 0 |
| is_default | boolean | associée automatiquement aux nouvelles étapes |
| position | integer | ordre d'exécution |

### `tickets`

| Colonne | Type | Notes |
|---|---|---|
| id | text PK | |
| project_id | text FK | |
| number | integer | séquentiel par projet, jamais réutilisé ; UQ (project_id, number) |
| key | text UQ | `{project.key}-{number}` |
| title, description | text | |
| status | text | `proposed` \| `open` \| `done` \| `cancelled` |
| origin | text | `human` \| `agent` |
| branch, worktree_path | text null | renseignés par `complete_step` |
| position | integer | ordre d'affichage et de priorité |
| next_step_number | integer | défaut 1 |
| created_at, updated_at, validated_at | integer | |

Contrainte : UQ (id, project_id), pour permettre les clés étrangères composites.

### `steps`

| Colonne | Type | Notes |
|---|---|---|
| id | text PK | |
| ticket_id, project_id | text FK | FK composite (ticket_id, project_id) → tickets(id, project_id) |
| number | integer | séquentiel par ticket, jamais réutilisé |
| key | text UQ | `{ticket.key}.{number}` |
| title, description, acceptance_criteria | text | |
| status | text | voir la machine à états (section 5) |
| origin | text | `human` \| `agent` |
| requires_review | boolean | pause humaine obligatoire avant `done` |
| position | integer | |
| attempts | integer | défaut 0 |
| claimed_by | text null | nom de l'agent |
| lease_expires_at | integer null | |
| commit_sha | text null | |
| created_at, updated_at, completed_at | integer | |

Contrainte : UQ (id, project_id).

### Tables de liaison et d'historique

| Table | Colonnes principales | Notes |
|---|---|---|
| `step_checks` | step_id, check_id | PK composite ; copiée depuis les vérifications `is_default` à la création, sauf si le plan en précise d'autres |
| `ticket_dependencies` | project_id, blocker_ticket_id, blocked_ticket_id, created_at | PK (blocker, blocked) ; FK composites avec project_id ; CHECK blocker ≠ blocked |
| `step_dependencies` | project_id, blocker_step_id, blocked_step_id, created_at | idem ; les deux étapes DOIVENT appartenir au même ticket (vérifié par le noyau) |
| `notes` | id, target_type (`ticket` \| `step`), target_id, kind (`note` \| `question` \| `answer` \| `rejection` \| `system`), author, body, created_at | notes de passation |
| `check_runs` | id, step_id, check_id, commit_sha, attempt, exit_code, timed_out, duration_ms, output_tail, started_at | `output_tail` : plafonné par `checks.stored_output_bytes` (défaut 32 Ko) |
| `events` | id (entier croissant), project_id, entity_type, entity_id, type, actor, payload (json), created_at | `actor` = `human`, `agent:<nom>` ou `system` |
| `app_settings` | key (PK), value (json), updated_at | réglages globaux ; une clé absente = valeur intégrée (section 15) |

L'`id` de `events` sert de **révision** du projet (utilisée par l'export).

---

## 5. Règles métier

### Machine à états d'une étape

| De | Vers | Déclencheur |
|---|---|---|
| `proposed` | `todo` | l'humain accepte |
| `proposed` | `cancelled` | l'humain rejette |
| `todo` | `in_progress` | `claim_step` |
| `todo` | `cancelled` | l'humain annule |
| `in_progress` | `done` | `complete_step` réussi, étape sans `requires_review` |
| `in_progress` | `review` | `complete_step` réussi, étape avec `requires_review` |
| `in_progress` | `in_progress` | `complete_step` en échec (tentatives restantes) : `attempts` +1 |
| `in_progress` | `failed` | `attempts` ≥ `max_attempts` |
| `in_progress` | `todo` | `pause_step(release)` ou bail expiré (le bail expiré incrémente `attempts`) |
| `in_progress` | `needs_input` | `pause_step(question)`, ou `complete_step` sur une étape sans vérification |
| `needs_input` | `todo` | l'humain répond (la réponse devient une note `answer`) |
| `review` | `done` | l'humain valide |
| `review` | `todo` | l'humain rejette (le commentaire devient une note `rejection`) |
| `failed` | `todo` | l'humain relance (`attempts` remis à 0) |
| `done` | `todo` | l'humain rouvre (voir cascade) |

Toute autre transition DOIT être refusée avec l'erreur `INVALID_TRANSITION`.

Actions humaines supplémentaires : annuler, modifier, découper une étape ; **forcer `done`** avec une justification obligatoire (événement `forced`).

### Statut d'un ticket

- Stocké : `proposed`, `open`, `done`, `cancelled`.
- **Phase dérivée** d'un ticket `open`, calculée à la lecture :
  - `needs_attention` : au moins une étape `failed`, `needs_input` ou `review` ;
  - `review` : au moins une étape non annulée, et toutes les étapes non annulées sont `done` ;
  - `in_progress` : au moins une étape `in_progress` ou `done` ;
  - `todo` : sinon.
- Une étape `proposed` compte comme non terminée : elle empêche la phase `review`.
- L'humain valide un ticket (`open` → `done`) **uniquement** depuis la phase `review`.

### Calcul de `ready`

Une étape est prête si, **simultanément** :

1. son statut est `todo` ;
2. son ticket est `open` ;
3. toutes les étapes qui la bloquent sont `done` ;
4. tous les tickets qui bloquent son ticket sont `done`.

L'ordre de priorité est : `tickets.position`, puis `steps.position`.

### Dépendances

- Création refusée si elle forme un cycle (parcours en profondeur à l'intérieur de la transaction) : erreur `CYCLE_DETECTED` avec le chemin du cycle.
- Création refusée si les deux extrémités ne sont pas dans le même projet (et, pour les étapes, dans le même ticket).
- Les clés étrangères composites garantissent l'appartenance au même projet au niveau de la base.

### Réclamation (`claim_step`)

Dans une transaction `BEGIN IMMEDIATE` :

1. Expirer les baux échus (voir ci-dessous).
2. Refuser si l'agent détient déjà une étape `in_progress` (`ALREADY_HOLDING`) : par défaut, un agent = une étape à la fois (réglage `steps.max_holds_per_agent`).
3. Choisir l'étape demandée (si `step` est fourni, elle DOIT être prête, sinon `NOT_READY` avec la raison) ou la première étape prête.
4. Passer l'étape en `in_progress`, renseigner `claimed_by` et `lease_expires_at = now + durée de bail effective` (réglage `steps.lease_minutes`).
5. Écrire l'événement.

### Bail

- Tout appel MCP portant sur une étape détenue par l'agent **renouvelle** le bail.
- Expiration **paresseuse** : évaluée au début de chaque `claim_step` et `get_overview`, et par un minuteur (toutes les `system.lease_sweep_seconds`, défaut 60 s) tant que le serveur Next.js tourne. Aucun processus dédié.
- Une étape expirée est remise à `todo`, `attempts` +1, une note `system` est ajoutée. Si `attempts` ≥ `max_attempts` : `failed`.
- `complete_step` appelé par le détenteur d'une étape dont le bail a expiré **mais qui n'a pas encore été libérée** est accepté.

### Rejet ciblé et réouverture

Quand l'humain rouvre ou rejette des étapes sélectionnées :

1. Les étapes choisies passent à `todo` (`attempts` à 0, `commit_sha` effacé).
2. Cascade : toutes les étapes `done` qui en dépendent (transitivement) repassent à `todo`.
3. Les dépendantes `in_progress` ne sont pas interrompues : un événement et une note `system` les signalent.
4. Le commentaire de l'humain est ajouté en note `rejection` sur chaque étape rouverte.
5. Le ticket sort naturellement de la phase `review` (calcul dérivé).

### Validation d'un plan proposé

- Accepter un ticket `proposed` le passe en `open` et passe ses étapes `proposed` en `todo`.
- L'humain peut aussi accepter, modifier ou rejeter étape par étape.
- Un ticket ou une étape `proposed` n'est **jamais** prêt et n'apparaît pas dans `list`/`ready`.

---

## 6. Exécution des vérifications

Module `src/runner`. Appelé par `complete_step`.

### Entrées et contrôles préalables

1. `worktree_path` DOIT être absolu. Son `realpath` DOIT se situer sous l'une des `worktree_roots` du projet, sinon `INVALID_PATH`.
2. Le répertoire DOIT être un worktree du dépôt du projet : `git -C <worktree> rev-parse --git-common-dir` DOIT désigner le `.git` de `repo_path`.
3. `git -C <worktree> rev-parse HEAD` DOIT être égal à `commit_sha`, sinon `SHA_MISMATCH` (la réponse inclut le SHA réel).
4. Aucune opération git d'écriture n'est autorisée dans le runner. Les appels git utilisent `spawn` avec un tableau d'arguments (jamais d'interpolation dans une chaîne shell).

### Exécution

- Les vérifications de l'étape (`step_checks`) s'exécutent **séquentiellement**, dans l'ordre de `checks.position`, et s'arrêtent à la première en échec.
- Chaque commande s'exécute via un shell, dans `worktree_path/check.cwd`, avec un environnement assaini (`PATH`, `HOME`, `CI=1`, plus les variables listées dans le réglage `checks.env_allowlist`).
- Délai maximal par vérification : `timeout_seconds`. À l'expiration, le groupe de processus entier est tué (`SIGTERM`, puis `SIGKILL` après `checks.kill_grace_seconds`, défaut 5 s) ; `timed_out = true`.
- Réussite si le code de sortie est égal à `expected_exit_code`.
- Un seul run à la fois par worktree (verrou en mémoire par `realpath`, plus un contrôle en base).
- Chaque run écrit une ligne `check_runs` (sortie tronquée aux derniers `checks.stored_output_bytes` octets, défaut 32 Ko).

### Idempotence

Un second appel `complete_step` avec le même `(step, commit_sha)` alors qu'un run est terminé renvoie le résultat stocké sans réexécuter.

### Résultat

| Cas | Effet |
|---|---|
| Aucune vérification associée à l'étape | l'étape passe en `needs_input` avec une note `system` |
| Toutes réussies, sans `requires_review` | étape `done`, `commit_sha` et `completed_at` renseignés |
| Toutes réussies, avec `requires_review` | étape `review` |
| Au moins une en échec | `attempts` +1 ; étape toujours `in_progress`, ou `failed` si `attempts` ≥ `max_attempts` |

### Lecture du diff (revue de feature)

- Commande fixe : `git -C <repo_path> diff --no-ext-diff <main_branch>...<branch>` (et par étape : `<sha_précédent>..<sha>`), en lecture seule.
- Les noms de branche et SHA DOIVENT être validés (`^[A-Za-z0-9._/-]+$`) avant usage.
- Taille de sortie plafonnée par `git.diff_max_bytes` (défaut 2 Mo), avec indication de troncature.

---

## 7. Serveur MCP

### Lancement

```
node dist/mcp/server.js --profile executor|planner
```

| Variable | Rôle |
|---|---|
| `PLAN_DB_PATH` | chemin de la base (défaut `~/.plan-agentique/plan.db`) |
| `PLAN_AGENT_NAME` | identité de l'agent (`claimed_by`, `actor`) ; obligatoire pour le profil `executor` |
| `PLAN_PROJECT` | clé de projet par défaut, utilisée quand l'outil ne reçoit pas `project` |

Exemple de configuration côté client (fichier de config MCP du dépôt cible) :

```json
{
  "mcpServers": {
    "plan": {
      "command": "node",
      "args": ["/chemin/vers/plan-agentique/dist/mcp/server.js", "--profile", "executor"],
      "env": { "PLAN_AGENT_NAME": "agent-1", "PLAN_PROJECT": "APP" }
    }
  }
}
```

### Format des réponses

- Succès : `{ "ok": true, ...données, "next_action": "texte court" }`
- Erreur : `{ "ok": false, "error": { "code": "...", "message": "...", "hint": "quoi faire" } }`
- Les réponses DOIVENT être compactes : pas de champs vides, textes longs tronqués avec indication.

Codes d'erreur : `NOT_FOUND`, `NOT_READY`, `ALREADY_HOLDING`, `NOT_OWNER`, `INVALID_TRANSITION`, `INVALID_PATH`, `SHA_MISMATCH`, `CYCLE_DETECTED`, `VALIDATION`, `LIMIT_EXCEEDED`.

### Outils

Les paramètres désignant un ticket ou une étape acceptent la **clé** (`APP-2`, `APP-2.1`).

#### `get_overview` (planner)

| Entrée | Type | Notes |
|---|---|---|
| project | string? | défaut `PLAN_PROJECT` |
| detail | `summary` \| `full`? | défaut `summary` |

Sortie : projet (clé, nom, type, conventions, noms des vérifications) ; compteurs par statut ; listes compactes : étapes prêtes, en cours (agent, expiration du bail), à traiter (`failed`, `needs_input`, `review`), propositions en attente. `full` ajoute les descriptions et les dépendances.

#### `claim_step` (executor)

| Entrée | Type | Notes |
|---|---|---|
| project | string? | |
| step | string? | clé ; absent = prochaine étape prête |

Sortie, le **paquet complet** :

```json
{
  "ok": true,
  "step": { "key": "APP-2.2", "title": "...", "description": "...",
            "acceptance_criteria": "...", "checks": ["test", "typecheck"],
            "requires_review": false, "attempt": 1 },
  "ticket": { "key": "APP-2", "title": "...", "description": "...",
              "branch": "feature/APP-2-tableau-de-bord" },
  "depends_on": [ { "key": "APP-2.1", "title": "...", "commit_sha": "a1b2c3d" } ],
  "notes": [ { "kind": "rejection", "author": "human", "body": "..." } ],
  "conventions": { "main_branch": "main",
                   "branch": "feature/{ticket_key}-{slug}",
                   "commit": "{step_key}: {title}" },
  "lease_expires_at": "2026-11-10T15:30:00Z",
  "next_action": "Travaille dans le worktree de la feature, commit, puis appelle complete_step."
}
```

#### `complete_step` (executor)

| Entrée | Type | Notes |
|---|---|---|
| step | string | |
| commit_sha | string | SHA complet ou abrégé (≥ 7) |
| worktree_path | string | absolu |
| branch | string? | enregistré sur le ticket |
| summary | string? | ajouté comme note |

Appel **bloquant** pendant les vérifications. Sortie : `result` (`passed` \| `failed` \| `needs_input` \| `review`), `step_status`, `attempts`, `attempts_remaining`, `checks` (nom, réussite, code de sortie, durée, queue de sortie limitée par `checks.agent_output_bytes`, défaut 4 Ko) et `next_action`.

#### `pause_step` (executor)

| Entrée | Type | Notes |
|---|---|---|
| step | string | |
| kind | `release` \| `question` | |
| message | string | obligatoire |

`release` : retour à `todo`, la raison devient une note, `attempts` inchangé. `question` : passage à `needs_input`, note de type `question`.

#### `add_note` (executor, planner)

Entrées : `target` (clé de ticket ou d'étape), `text`. Renouvelle le bail si la cible est l'étape détenue par l'appelant.

#### `propose_plan` (planner)

```json
{
  "project": "APP",
  "ticket": { "key": "APP-2", "title": "…", "description": "…",
              "depends_on": ["APP-1"] },
  "steps": [
    { "ref": "s1", "title": "…", "description": "…",
      "acceptance_criteria": "…", "checks": ["test"], "requires_review": false },
    { "ref": "s2", "title": "…" }
  ],
  "deps": [ { "blocker": "s1", "blocked": "s2" } ]
}
```

- `ticket.key` présent : ajoute des étapes `proposed` à un ticket existant `open` ; absent : crée un nouveau ticket `proposed`.
- `ref` désigne une étape du lot ; `deps` accepte des `ref` ou des clés existantes.
- Tout est créé **en une transaction**, tout ou rien. Cycle ou référence inconnue : aucune écriture.
- Limites (réglages `plan.*`) : par défaut 30 étapes par appel, titre ≤ 120 caractères, description ≤ 4 000.
- Les vérifications omises prennent les vérifications `is_default` du projet. Un nom inconnu est une erreur `VALIDATION`.
- Sortie : clés créées, dépendances créées, `next_action` (« en attente de validation humaine »).

### Intégrité

- Les profils DOIVENT être appliqués à l'enregistrement des outils : un serveur `executor` n'expose pas `propose_plan`, un serveur `planner` n'expose pas `claim_step`.
- Un agent ne peut agir que sur les étapes qu'il détient (`NOT_OWNER` sinon).
- Aucun outil ne permet de créer ou modifier une vérification.

---

## 8. Export `PLAN.md`

Module `src/export`. Format et options : voir le README.

- `renderPlan(snapshot, options): string` est une **fonction pure** : mêmes données, même sortie. Aucune horloge, aucun accès disque.
- Tri : tickets par numéro, étapes par numéro, dépendances par clé.
- L'en-tête contient la **révision** (id du dernier événement du projet), pas une date.
- Marqueurs : `[x]` pour `done`, `[ ]` sinon ; statut, commit, dépendances, vérifications et « revue obligatoire » sur la ligne de l'étape.
- Option `graph` : diagramme Mermaid (identifiants de nœuds `APP_2`, libellés entre guillemets).
- Portée : projet entier ou un seul ticket. Filtre par statuts. Option `notes`.
- Écriture : par défaut dans `export_dir` (écriture atomique : fichier temporaire puis renommage). Écrire dans le dépôt exige un chemin explicite et configuré.
- Déclencheurs : bouton UI, script `npm run export-plan -- <KEY> [--ticket APP-2] [--graph] [--notes]`, et ré-export automatique si `auto_export` (après chaque événement qui change un statut, avec anti-rebond `export.debounce_seconds`, défaut 2 s).

---

## 9. Interface (Next.js)

Écoute sur `127.0.0.1`. Mises à jour par interrogation périodique en v1 (réglage `ui.poll_interval_seconds`, défaut 3 s).

| Écran | Contenu |
|---|---|
| Projets | Liste, création (type, chemin du dépôt, conventions) |
| Réglages du projet | Vérifications (CRUD) et surcharges des réglages (bail, tentatives, conventions git, export…) avec valeur effective et état « hérité » / « surchargé » |
| Réglages globaux | Page de configuration de toutes les valeurs par défaut, par groupes (section 15) |
| Vue projet | Arbre tickets → étapes, filtres par statut, phase des tickets, boîte « à traiter » (`proposed`, `needs_input`, `failed`, `review`) |
| Détail ticket / étape | Description, critères, dépendances (ajout/retrait avec refus des cycles), notes, historique d'événements, `check_runs` |
| Revue du plan proposé | Accepter / modifier / rejeter par étape, par ticket ou en bloc ; dépendances suggérées en pointillé |
| Revue de feature | Résumé, résultats des vérifications par étape, diff lecture seule (global et par étape), journal ; actions : valider, rejeter de façon ciblée (sélection des étapes à rouvrir + commentaire), rejeter en bloc |
| Export | Aperçu de `PLAN.md` et bouton d'export |

Exigences :
- Saisie manuelle rapide : création d'un ticket et de ses étapes au clavier, description en Markdown.
- Réordonnancement par glisser-déposer (`position`).
- Vue graphe des dépendances et chemin critique : **après le MVP**.

---

## 10. Sécurité

- L'application NE DOIT écouter que sur `127.0.0.1`.
- Les commandes exécutées proviennent **uniquement** de la table `checks`, modifiée par l'humain via l'UI. Aucun outil MCP ne peut créer ni modifier une commande.
- Chemins : confinement par `realpath` aux `worktree_roots`, vérification du dépôt d'appartenance (section 6).
- Les appels git utilisent des tableaux d'arguments, jamais une chaîne shell. Seules les commandes de `checks` passent par un shell.
- Variables d'environnement des vérifications : liste d'autorisation.
- Les sorties de commandes sont affichées comme du texte (échappées), jamais interprétées comme HTML.
- Le contenu écrit par des agents (descriptions, notes) est affiché de façon sûre (Markdown assaini).
- Les réglages ne sont modifiables que par l'humain via l'UI ; les réglages sensibles demandent une confirmation (section 15).

---

## 11. Plan de livraison

Chaque jalon est une feature ; les étapes sont les sous-tickets. Une fois le jalon M3 livré, ce plan pourra être saisi dans l'application elle-même (l'application planifie la suite de son propre développement).

Vérifications du projet lui-même : `typecheck`, `lint`, `test`, `build`.

### M0 — Fondations

- Initialiser le dépôt, TypeScript strict, ESLint, Vitest, scripts `typecheck` / `lint` / `test` / `build`.
- Schéma Drizzle complet (section 4), première migration, seed des types de projet.
- Ouverture de la base avec les pragmas (section 3), utilitaire de transaction `BEGIN IMMEDIATE`.

**Critères** : migrations appliquées sur une base vide ; clés étrangères composites rejetant une dépendance entre deux projets ; tests verts.

### M1 — Noyau métier

- Projets, vérifications, tickets, étapes, numérotation et clés.
- Dépendances avec détection de cycles.
- Machine à états des étapes, phase dérivée des tickets, calcul de `ready`.
- Événements et notes.
- Registre de réglages, table `app_settings`, résolution surcharge projet → réglage global → valeur intégrée (section 15).
- Rejet ciblé avec cascade, validation de plan proposé.

**Critères** : toutes les transitions de la section 5 testées (valides et invalides) ; `ready` correct sur des graphes de test (diamant, chaîne, dépendances de tickets) ; cycle refusé avec le chemin ; résolution des réglages (surcharge > global > intégré) et bornes testées.

### M2 — Exécuteur de vérifications

- Contrôles de chemin et de SHA, exécution séquentielle avec délai et arrêt du groupe de processus.
- Persistance de `check_runs`, idempotence, verrou par worktree.

**Critères** : tests d'intégration sur un dépôt git temporaire (réussite, échec, délai dépassé, SHA différent, chemin hors racines, sortie tronquée).

### M3 — Serveur MCP

- Squelette stdio, profils, variables d'environnement.
- Les 6 outils avec schémas zod, format de réponse et codes d'erreur.
- Bail implicite, expiration paresseuse.

**Critères** : test avec un client MCP du SDK (liste d'outils par profil, parcours complet réclamer → compléter) ; deux `claim_step` concurrents ne prennent jamais la même étape.

### M4 — Interface : saisie et suivi

- Projets, réglages du projet (vérifications, surcharges), page de réglages globaux (section 15), vue arbre, détail ticket / étape, boîte « à traiter ».
- Revue du plan proposé.

**Critères** : créer un projet, un ticket et ses étapes au clavier ; accepter un plan proposé par un agent ; un cycle est refusé dans l'UI avec le chemin affiché ; modifier un réglage global change le comportement du prochain appel MCP sans redémarrage.

### M5 — Revue de feature

- Écran de revue, diff en lecture seule, valider, rejet ciblé et en bloc.

**Critères** : un rejet ciblé rouvre les étapes choisies et leurs dépendantes `done`, avec le commentaire en note ; la phase du ticket repasse hors `review`.

### M6 — Export `PLAN.md`

- `renderPlan` pur, script, bouton UI, ré-export automatique.

**Critères** : sortie identique à l'octet pour des données identiques (test d'instantané) ; diagramme Mermaid valide ; écriture atomique.

### M7 — Durcissement

- Minuteur d'expiration des baux, anti-rebond de l'export, limites de taille, messages d'erreur avec `hint`.
- Sauvegarde simple de la base (copie horodatée), documentation d'installation.

**Critères** : scénarios de la section 12 tous verts.

---

## 12. Scénarios d'acceptation

1. **Parcours nominal** : l'humain crée un ticket avec 3 étapes chaînées ; un agent réclame, complète (vérifications réussies), enchaîne ; à la fin le ticket est en phase `review` ; l'humain valide.
2. **Réclamations concurrentes** : deux agents appellent `claim_step` simultanément pour la seule étape prête ; un seul réussit, l'autre reçoit `NOT_READY` ou une autre étape.
3. **Un agent, une étape** : un agent détenant une étape reçoit `ALREADY_HOLDING` à sa seconde réclamation.
4. **Bail expiré** : un agent disparaît ; après expiration l'étape est `todo`, `attempts` +1, note système ; un autre agent la réclame et reçoit la note.
5. **Boucle d'échecs** : trois `complete_step` en échec consécutifs mènent à `failed` ; l'étape n'est plus proposée.
6. **Vérification en échec** : l'agent reçoit la queue de sortie ; l'étape reste `in_progress`.
7. **Étape sans vérification** : `complete_step` la passe en `needs_input` avec note ; l'humain ajoute une vérification ou force `done` avec justification.
8. **Question** : `pause_step(question)` ; l'humain répond ; l'étape redevient `todo` avec la réponse en note.
9. **Plan proposé** : un planificateur appelle `propose_plan` ; rien n'est prêt avant validation ; après acceptation, les étapes sans blocage deviennent prêtes.
10. **Cycle** : un `propose_plan` formant un cycle n'écrit rien et renvoie `CYCLE_DETECTED`.
11. **Dépendance de ticket** : les étapes de B ne sont prêtes que lorsque le ticket A est `done` (validé).
12. **Rejet ciblé** : l'humain rouvre l'étape 2 sur 4 ; les étapes 3 et 4 (`done`, dépendantes) repassent à `todo` ; l'agent reçoit le commentaire.
13. **Étape à revue obligatoire** : après des vérifications réussies elle passe en `review` et ses dépendantes restent bloquées jusqu'à validation humaine.
14. **SHA incohérent / chemin hors racines** : `complete_step` renvoie `SHA_MISMATCH` / `INVALID_PATH` sans exécuter de commande.
15. **Export déterministe** : deux exports successifs sans changement donnent des fichiers identiques.
16. **Profils** : le serveur `executor` ne liste pas `propose_plan` ; le serveur `planner` ne liste pas `claim_step`.
17. **Réglages et héritage** : l'humain passe `steps.lease_minutes` global à 10 ; le prochain `claim_step` reçoit un bail de 10 minutes (sans redémarrer le serveur MCP). Un projet qui surcharge à 45 obtient 45. La réinitialisation du projet le fait revenir à l'héritage.
18. **Réglages invalides et sensibles** : une valeur hors bornes (ex. bail de 0) est refusée avec un message par champ ; la modification d'un réglage sensible exige une confirmation et écrit un événement `settings.changed` (avant / après).

---

## 13. Précisions par rapport au README

Détails ajoutés ou tranchés ici ; le README a été aligné sur les points 1, 2, 4 et 10.

1. **Statut d'étape `review`** : sert aux étapes `requires_review`. L'étape passe en `review` après des vérifications réussies et ne débloque ses dépendantes qu'une fois validée (`done`).
2. **Dépendance entre tickets** : satisfaite quand le ticket bloquant est `done`, c'est-à-dire **validé par l'humain** (confirmé).
3. **Paramètres MCP** : les `*_id` du README sont des **clés** lisibles ; ils sont nommés `step`, `ticket`, `target`.
4. **En-tête de `PLAN.md`** : une **révision** remplace la date, pour garder une sortie déterministe.
5. **Identité de l'agent** : fournie par `PLAN_AGENT_NAME` ; un agent détient une seule étape à la fois.
6. **Projet par défaut** : `PLAN_PROJECT` évite de répéter `project` à chaque appel.
7. **Étape sans vérification** : `needs_input` ; l'humain peut forcer `done` avec justification.
8. **`release`** n'incrémente pas `attempts` ; l'expiration du bail et l'échec des vérifications l'incrémentent.
9. **Ordre de priorité des étapes prêtes** : position du ticket, puis position de l'étape.
10. **Réglages** : toutes les valeurs par défaut sont configurables depuis une page de réglages ; surcharge par projet pour les réglages concernés (section 15).

---

## 14. Hypothèses et décisions ouvertes

À confirmer avant ou pendant l'implémentation, sans bloquer M0 à M2 :

- Valeurs **intégrées** (toutes modifiables dans la page de réglages, section 15) : bail de 30 minutes, 3 tentatives, sortie de vérification tronquée à 4 Ko côté agent et 32 Ko en base.
- Mise à jour de l'UI par interrogation (3 s) plutôt que flux d'événements serveur.
- Commandes de vérification : exécutées par un shell (nécessaire pour `npm test && ...`) ; l'humain en est l'unique auteur.
- Racines de worktrees par défaut (`repo_path` et `repo_path-worktrees`).
- Sauvegarde de la base : simple copie horodatée au démarrage, pas de réplication.
- Nom d'un éventuel CLI mince (`plan`) et son périmètre : après M7.

---

## 15. Réglages configurables

### Principe

- Toutes les valeurs par défaut vivent dans un **registre de réglages** (`src/core/settings.ts`). Pour chaque clé : schéma zod, valeur intégrée, bornes, portée, libellé, description, drapeau `sensitive`. La page de réglages est **générée à partir du registre**.
- Deux portées :
  - `global` : une seule valeur pour toute l'application ;
  - `both` : valeur globale **et** surcharge possible par projet.
- **Résolution** : surcharge du projet (colonne non nulle) → valeur globale (`app_settings`) → valeur intégrée du registre. Une colonne de projet à `null` signifie « hérité ».
- Stockage global : table `app_settings` (`key`, `value` JSON, `updated_at`). Une clé absente = valeur intégrée.
- Un nouveau projet n'a **aucune surcharge**. Seule exception : le délai des vérifications d'un gabarit est copié dans chaque nouvelle vérification (`timeout_seconds`) à sa création.

### Application des changements

- Les valeurs sont lues **au moment de l'usage**, dans la transaction concernée. Les serveurs MCP ne mettent rien en cache : un changement est visible au prochain appel, **sans redémarrage**.
- **Pas de rétroactivité** :
  - un bail déjà accordé garde son `lease_expires_at` ;
  - `max_attempts` est évalué au moment où `attempts` est incrémenté ; une étape déjà `failed` le reste ;
  - une vérification existante garde son `timeout_seconds`.

### Registre initial

| Clé | Portée | Valeur intégrée | Bornes | Rôle |
|---|---|---|---|---|
| `steps.lease_minutes` | both | 30 | 1 – 480 | Durée du bail d'une étape |
| `steps.max_attempts` | both | 3 | 1 – 20 | Tentatives avant `failed` |
| `steps.max_holds_per_agent` | global | 1 | 1 – 10 | Étapes `in_progress` simultanées par agent |
| `checks.default_timeout_seconds` | global | 300 | 10 – 7 200 | Délai initial des nouvelles vérifications |
| `checks.kill_grace_seconds` | global | 5 | 1 – 60 | Délai entre `SIGTERM` et `SIGKILL` |
| `checks.fail_fast` | global | vrai | — | S'arrêter à la première vérification en échec |
| `checks.agent_output_bytes` | global | 4 096 | 512 – 65 536 | Sortie renvoyée à l'agent |
| `checks.stored_output_bytes` | global | 32 768 | 4 096 – 1 048 576 | Sortie conservée en base |
| `checks.env_allowlist` | global | `[]` | noms de variables | Variables d'environnement transmises aux vérifications (**sensible**) |
| `git.main_branch` | both | `main` | — | Branche principale |
| `git.branch_convention` | both | `feature/{ticket_key}-{slug}` | placeholders valides | Nom des branches |
| `git.commit_convention` | both | `{step_key}: {title}` | placeholders valides | Messages de commit |
| `git.worktree_roots` | both | `["{repo_path}", "{repo_path}-worktrees"]` | chemins | Racines autorisées pour les worktrees (**sensible**) |
| `git.diff_max_bytes` | global | 2 097 152 | 64 Ko – 32 Mo | Taille maximale du diff affiché |
| `plan.max_steps_per_call` | global | 30 | 1 – 100 | Étapes par `propose_plan` |
| `plan.max_title_length` | global | 120 | 20 – 300 | Longueur d'un titre |
| `plan.max_description_length` | global | 4 000 | 500 – 20 000 | Longueur d'une description |
| `export.auto_export` | both | faux | — | Ré-export automatique de `PLAN.md` |
| `export.dir` | both | `~/.plan-agentique/exports/{project_key}/` | chemin | Dossier d'export (**sensible**) |
| `export.debounce_seconds` | global | 2 | 0 – 60 | Anti-rebond du ré-export |
| `ui.poll_interval_seconds` | global | 3 | 1 – 60 | Rafraîchissement de l'interface |
| `system.lease_sweep_seconds` | global | 60 | 10 – 600 | Fréquence du minuteur d'expiration des baux |
| `system.backup_on_start` | global | vrai | — | Copie horodatée de la base au démarrage |
| `system.backup_keep` | global | 10 | 1 – 100 | Nombre de sauvegardes conservées |

Placeholders valides : `{ticket_key}`, `{step_key}`, `{slug}`, `{title}`, `{repo_path}`, `{project_key}`. Un placeholder inconnu est refusé à l'enregistrement.

### Non configurable (fixé par conception)

- L'adresse d'écoute (`127.0.0.1`) et le chemin de la base (`PLAN_DB_PATH`, variable d'environnement de démarrage).
- Les profils et la liste des outils MCP ; l'interdiction pour un outil MCP de modifier réglages ou vérifications.
- Le format des clés, la liste des statuts et la machine à états.

### Page « Réglages » (global)

- Groupes : *Exécution des étapes*, *Vérifications*, *Git et conventions*, *Plans proposés*, *Export*, *Interface et système*.
- Pour chaque réglage : libellé, description, champ validé, **valeur intégrée** affichée, badge « modifié » si elle diffère, bouton « Réinitialiser ».
- Enregistrement par groupe ; erreurs affichées par champ ; « Tout réinitialiser » par groupe, avec confirmation.
- Réglages `sensitive` : confirmation explicite avant l'enregistrement, avec rappel de l'impact.

### Réglages d'un projet

- Pour chaque réglage de portée `both` : état **« Hérité (valeur : X) »** ou **« Surchargé »**, interrupteur pour surcharger, retour à l'héritage en un clic, et affichage de la **valeur effective**.

### Audit

Chaque changement écrit un événement `settings.changed` : clé, portée (`global` ou clé de projet), valeur avant, valeur après, acteur `human`.

### Sécurité

- Seul l'humain modifie les réglages, via l'UI. Aucun outil MCP ne lit ni n'écrit un réglage ; les valeurs effectives nécessaires (par exemple les conventions dans `claim_step`) sont simplement incluses dans les réponses.
- La validation est faite **côté serveur** avec le schéma du registre, jamais seulement côté client.
- Réglages sensibles : `checks.env_allowlist`, `git.worktree_roots`, `export.dir`.

### Tests

- Ordre de résolution (surcharge > global > intégré), bornes, placeholders invalides.
- Un changement de réglage global est visible, au prochain appel, par un serveur MCP déjà lancé.
- Absence de rétroactivité (bail et vérification existants).
- Aucun outil MCP n'expose ni ne modifie de réglage.
