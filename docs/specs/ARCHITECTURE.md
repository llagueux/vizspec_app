# Architecture — Plan agentique

Document d'architecture de l'application décrite dans `README.md` et spécifiée dans `SPECS.md`. Les diagrammes sont en **PlantUML** (blocs ```` ```plantuml ````) et ont été validés par compilation.

Les noms de tables, d'outils MCP et de réglages sont ceux de `SPECS.md`, qui reste la référence pour les détails.

## Sommaire

1. Vue d'ensemble et contraintes
2. Décisions d'architecture
3. Contexte système
4. Déploiement local
5. Modules et dépendances
6. Modèle de données
7. États : étape et ticket
8. Scénarios dynamiques (séquences)
9. Règles de calcul (activités)
10. Concurrence et cohérence
11. Frontières de confiance et sécurité
12. Qualités visées et stratégie de test
13. Risques et évolutions
14. Générer les diagrammes

---

## 1. Vue d'ensemble et contraintes

Application **locale**, mono-utilisateur, qui sert de carnet de commandes à des agents de développement : l'humain décrit ou valide des plans (projet → feature → étapes), les agents réclament des étapes via MCP, l'application **exécute elle-même** les vérifications, et l'humain valide la feature complète.

| Contrainte | Conséquence architecturale |
|---|---|
| Exécution locale uniquement | Écoute sur `127.0.0.1`, SQLite, aucune authentification |
| Plusieurs agents en parallèle | Plusieurs processus MCP sur la même base : transactions courtes, `BEGIN IMMEDIATE` |
| Les agents ne sont pas de confiance | Profils d'outils, vérifications nommées, confinement des chemins |
| L'humain valide à la feature | Phase dérivée du ticket, revue centralisée, rejet ciblé avec cascade |
| Plan versionnable | Export `PLAN.md` déterministe, fonction pure |
| Valeurs par défaut modifiables | Registre de réglages, résolution surcharge → global → intégré |

---

## 2. Décisions d'architecture

| # | Décision | Raison | Compromis |
|---|---|---|---|
| D1 | **Noyau partagé** (`src/core`) sans dépendance à Next.js ni à MCP | Une seule source de règles ; UI, MCP et scripts sont des façades minces ; testable sans serveur | Discipline nécessaire pour ne pas dupliquer de règle dans les façades |
| D2 | **SQLite en mode WAL**, un fichier partagé par tous les processus | Zéro infrastructure, transactions ACID, lecteurs non bloquants | Un seul écrivain à la fois ; d'où des transactions très courtes |
| D3 | **MCP en stdio**, un processus par agent, deux profils (`executor`, `planner`) | Intégration native des clients d'agents ; l'agent ne charge que ses outils | Plusieurs processus à coordonner via la base |
| D4 | **6 outils** seulement | Limiter le coût de contexte des schémas d'outils | Réponses riches (paquet de contexte) plutôt que beaucoup d'appels |
| D5 | **Vérifications nommées**, définies par l'humain et **exécutées par l'application** | L'agent ne peut ni injecter une commande ni embellir un résultat | L'application exécute du code local : confinement strict nécessaire |
| D6 | **Git piloté par l'agent**, lecture seule côté application | L'application reste simple et sans risque d'écriture sur le dépôt | L'application dépend des conventions respectées par l'agent (SHA vérifié) |
| D7 | **Validation humaine à la feature** ; phase du ticket **dérivée** des étapes | Flux fluide pour les agents ; statut stocké minimal (`proposed`, `open`, `done`, `cancelled`) | Garde-fous : vérifications obligatoires, `requires_review`, commits par étape |
| D8 | **Jamais de transaction d'écriture ouverte pendant une vérification** | Une commande de plusieurs minutes bloquerait tous les écrivains SQLite | Séquence en trois temps (enregistrer, exécuter, conclure) avec reprise sûre |
| D9 | **Export `PLAN.md` = fonction pure**, écriture atomique | Sortie déterministe, diffs git propres, testable par instantané | Export à sens unique (pas d'import en v1) |
| D10 | **Registre de réglages** unique, lu à chaque usage | Valeurs configurables sans redémarrage, page générée automatiquement | Pas de rétroactivité : à documenter pour l'utilisateur |
| D11 | **Clés lisibles** (`APP-2.1`) pour les agents et l'UI, ULID en interne | Références stables dans branches, commits et exports | Numérotation à gérer par projet et par ticket, sans réutilisation |

---

## 3. Contexte système

Qui interagit avec l'application, et avec quoi elle échange.

```plantuml
@startuml contexte
title Contexte système — Plan agentique
left to right direction
skinparam shadowing false

actor "Humain\n(développeur)" as H
actor "Agent planificateur\n(client MCP)" as AP
actor "Agent exécuteur\n(client MCP)" as AE

rectangle "Plan agentique\n(application locale)" as APP

database "Dépôt git du projet\n+ worktrees" as GIT
folder "Dossier d'exports\n(PLAN.md)" as EXP

H --> APP : navigateur\n127.0.0.1
AP --> APP : MCP stdio\nprofil planner
AE --> APP : MCP stdio\nprofil executor
APP --> GIT : exécute les vérifications\nlit les diffs (lecture seule)
AE --> GIT : worktree, branche,\ncommits
H --> GIT : fusionne la branche\naprès validation
APP --> EXP : écrit PLAN.md
@enduml
```

---

## 4. Déploiement local

Tout tourne sur le poste du développeur. Les serveurs MCP sont lancés **à la demande par les clients d'agents** (un processus par agent) ; le serveur Next.js est lancé par l'humain.

```plantuml
@startuml deploiement
title Déploiement local
skinparam shadowing false

node "Client d'agent\n(IDE / CLI, un par agent)" as CLIENT

node "Poste du développeur" {
  component "Navigateur" as BROW

  node "Processus Next.js\n127.0.0.1" as NEXT {
    component "UI + server actions" as UI
    component "Minuteur d'expiration\ndes baux" as TIMER
    component "Export automatique\n(anti-rebond)" as AUTOEXP
  }

  node "Processus MCP (stdio)\nun par agent" as MCP {
    component "Serveur MCP\nprofil executor | planner" as MCPS
  }

  database "plan.db\nSQLite, mode WAL" as DB

  node "Sous-processus" as SUB {
    component "Shell des vérifications" as SH
    component "git (lecture seule)" as GITR
  }

  folder "Dépôt + worktrees" as REPO
  folder "Exports\n~/.plan-agentique/exports" as EXP
  folder "Sauvegardes\n~/.plan-agentique/backups" as BKP
}

BROW --> UI : HTTP
CLIENT --> MCPS : stdio\n(lancement + JSON-RPC)

UI --> DB : better-sqlite3
MCPS --> DB : better-sqlite3
TIMER --> DB : balayage des baux
AUTOEXP --> DB : surveille le dernier\nid d'événement

MCPS --> SH : vérifications\n(complete_step)
MCPS --> GITR : rev-parse
UI --> GITR : diff
SH --> REPO : cwd = worktree
GITR --> REPO

AUTOEXP --> EXP : écriture atomique
DB ..> BKP : copie horodatée\nau démarrage
@enduml
```

**Points à retenir**

- Aucun processus ne communique directement avec un autre : **la base est le seul point de coordination**.
- Le minuteur d'expiration et l'export automatique vivent dans le processus Next.js. Comme les événements sont écrits par d'autres processus, l'export automatique détecte les changements en **interrogeant le dernier `events.id`** plutôt que par notification en mémoire.
- L'expiration des baux est aussi **paresseuse** : évaluée à chaque `claim_step` et `get_overview`, donc correcte même si Next.js n'est pas lancé.

---

## 5. Modules et dépendances

Règle de dépendance : **les façades dépendent du noyau, le noyau ne dépend d'aucune façade**. Le noyau n'appelle l'extérieur (exécution de commandes, git, horloge, transactions) que par des **ports**, implémentés par des adaptateurs.

```plantuml
@startuml modules
title Modules et dépendances
skinparam shadowing false
skinparam componentStyle rectangle

package "Façades" {
  component "app (Next.js)\npages, server actions,\ninterrogation périodique" as APP
  component "mcp\nserveur stdio, profils,\n6 outils" as MCP
  component "scripts\nexport-plan, maintenance" as SCR
}

package "Noyau — src/core" {
  component "CoreApi\n(façade applicative)" as CORE
  component "ProjectService\n(projets, vérifications)" as PS
  component "TicketService" as TS
  component "StepService\n(machine à états, bail)" as SS
  component "DependencyService\n(cycles)" as DS
  component "ReadyCalculator" as RC
  component "PlanProposalService\n(propose_plan, acceptation)" as PPS
  component "ReviewService\n(valider, rejet ciblé)" as RS
  component "SettingsService\n(registre, résolution)" as SET
  component "EventLog + Notes" as EV

  interface "UnitOfWork\n(BEGIN IMMEDIATE)" as UOW
  interface "CheckRunnerPort" as CRP
  interface "GitReaderPort" as GRP
  interface "Clock" as CLK
}

package "Adaptateurs" {
  component "db\nschéma Drizzle, migrations,\nUnitOfWork SQLite" as DB
  component "runner\nCheckRunner, GitReader" as RUN
  component "export\nrenderPlan (pur),\nExportWriter" as EXP
}

database "SQLite (WAL)" as SQL

APP --> CORE
MCP --> CORE
SCR --> CORE

CORE --> PS
CORE --> TS
CORE --> SS
CORE --> PPS
CORE --> RS
CORE --> SET
CORE --> EXP : snapshot -> PLAN.md

SS --> RC
SS --> DS
PPS --> DS
RS --> SS
PS --> SET
SS --> SET
SS --> EV
TS --> EV
RS --> EV
PPS --> EV

SS ..> UOW
SS ..> CRP
RS ..> GRP
SS ..> CLK

DB ..|> UOW
RUN ..|> CRP
RUN ..|> GRP
DB --> SQL

note bottom of CORE
  Aucune dépendance vers app, mcp ou scripts.
  Toute mutation : transaction + événement.
end note
@enduml
```

### Responsabilités

| Module | Responsabilité | Ne fait pas |
|---|---|---|
| `core/StepService` | Transitions d'étape, bail, tentatives, réclamation, clôture | Exécuter une commande (passe par `CheckRunnerPort`) |
| `core/ReadyCalculator` | Étapes prêtes (statut, ticket ouvert, dépendances satisfaites) | Écrire en base |
| `core/DependencyService` | Création de dépendances, détection de cycles, cohérence de projet | |
| `core/PlanProposalService` | `propose_plan` atomique, acceptation / rejet des propositions | Créer des vérifications |
| `core/ReviewService` | Valider un ticket, rejet ciblé avec cascade | Fusionner une branche git |
| `core/SettingsService` | Registre, validation, résolution des valeurs effectives | Exposer des réglages aux agents |
| `runner` | Exécuter les vérifications (délai, groupe de processus), lire git | Écrire dans git |
| `export` | `renderPlan` (pur) et écriture atomique | Accéder à la base |
| `mcp` | Profils, schémas zod, format de réponse, traduction d'erreurs | Règles métier |
| `app` | Écrans, server actions, interrogation périodique | Règles métier |

---

## 6. Modèle de données

Vue relationnelle simplifiée (colonnes principales). Détails complets : `SPECS.md`, section 4.

```plantuml
@startuml donnees
title Modèle de données
hide circle
skinparam shadowing false

entity "project_types" as project_types {
  *id : text <<PK>>
  --
  name
  default_checks : json
  default_step_titles : json
}

entity "projects" as projects {
  *id : text <<PK>>
  --
  key : text <<UQ>>
  name
  type_id <<FK>>
  repo_path
  next_ticket_number
  surcharges nullables :
  lease_minutes, max_attempts,
  main_branch, conventions git,
  worktree_roots, auto_export, export_dir
}

entity "checks" as checks {
  *id : text <<PK>>
  --
  project_id <<FK>>
  name : UQ par projet
  command, cwd
  timeout_seconds
  expected_exit_code
  is_default, position
}

entity "tickets" as tickets {
  *id : text <<PK>>
  --
  project_id <<FK>>
  number, key : UQ
  title, description
  status : proposed | open | done | cancelled
  origin : human | agent
  branch, worktree_path
  position, next_step_number
}

entity "steps" as steps {
  *id : text <<PK>>
  --
  ticket_id, project_id <<FK>>
  number, key : UQ
  status
  requires_review
  attempts
  claimed_by, lease_expires_at
  commit_sha
  position
}

entity "step_checks" as step_checks {
  *step_id <<FK>>
  *check_id <<FK>>
}

entity "ticket_dependencies" as ticket_deps {
  *blocker_ticket_id <<FK>>
  *blocked_ticket_id <<FK>>
  --
  project_id
}

entity "step_dependencies" as step_deps {
  *blocker_step_id <<FK>>
  *blocked_step_id <<FK>>
  --
  project_id
}

entity "check_runs" as check_runs {
  *id : text <<PK>>
  --
  step_id, check_id <<FK>>
  commit_sha, attempt
  exit_code, timed_out
  duration_ms, output_tail
}

entity "notes" as notes {
  *id : text <<PK>>
  --
  target_type, target_id
  kind : note | question | answer |
  rejection | system
  author, body
}

entity "events" as events {
  *id : integer <<PK>>
  --
  project_id <<FK>>
  entity_type, entity_id
  type, actor, payload
}

entity "app_settings" as app_settings {
  *key : text <<PK>>
  --
  value : json
}

project_types ||--o{ projects
projects ||--o{ checks
projects ||--o{ tickets
projects ||--o{ events
tickets ||--o{ steps
steps ||--o{ step_checks
checks ||--o{ step_checks
tickets ||--o{ ticket_deps : bloque
tickets ||--o{ ticket_deps : est bloqué
steps ||--o{ step_deps : bloque
steps ||--o{ step_deps : est bloqué
steps ||--o{ check_runs
checks ||--o{ check_runs
tickets ||..o{ notes : cible
steps ||..o{ notes : cible

note right of events
  events.id sert de
  « révision » du projet
  (en-tête de PLAN.md).
end note

note bottom of ticket_deps
  Clés étrangères composites
  (id, project_id) : les deux
  extrémités sont dans le même projet.
end note
@enduml
```

---

## 7. États : étape et ticket

### Machine à états d'une étape

```plantuml
@startuml etats_etape
title Machine à états — étape
skinparam shadowing false

[*] --> proposed : créée par un agent
[*] --> todo : créée par l'humain

proposed --> todo : l'humain accepte
proposed --> cancelled : l'humain rejette

todo --> in_progress : claim_step
todo --> cancelled : l'humain annule

in_progress --> done : complete_step réussi\n(sans requires_review)
in_progress --> review : complete_step réussi\n(requires_review)
in_progress --> in_progress : vérifications en échec\n(attempts +1)
in_progress --> failed : attempts >= max_attempts
in_progress --> todo : pause_step(release)\nou bail expiré (attempts +1)
in_progress --> needs_input : pause_step(question)\nou aucune vérification

needs_input --> todo : l'humain répond
review --> done : l'humain valide
review --> todo : l'humain rejette
failed --> todo : l'humain relance
done --> todo : l'humain rouvre\n(cascade aux dépendantes)

done --> [*]
cancelled --> [*]
@enduml
```

### Phase d'un ticket

Le statut stocké d'un ticket est `proposed`, `open`, `done` ou `cancelled`. Pour un ticket `open`, la **phase** est **calculée** à partir de ses étapes ; elle n'est jamais stockée.

```plantuml
@startuml etats_ticket
title Ticket — statut stocké et phase dérivée
skinparam shadowing false

[*] --> proposed : propose_plan
[*] --> open : créé par l'humain
proposed --> open : l'humain accepte
proposed --> cancelled : l'humain rejette

state open {
  state "todo" as P_todo
  state "in_progress" as P_prog
  state "needs_attention" as P_attn
  state "review" as P_rev

  [*] --> P_todo
  P_todo --> P_prog : une étape est\nin_progress ou done
  P_prog --> P_attn : une étape est failed,\nneeds_input ou review
  P_attn --> P_prog : résolu
  P_prog --> P_rev : toutes les étapes non\nannulées sont done
  P_rev --> P_prog : une étape est rouverte
  P_rev --> P_attn : une étape échoue\nou demande une revue
}

P_rev --> done : l'humain valide
open --> cancelled : l'humain annule
done --> [*]
cancelled --> [*]

note right of open
  Phase dérivée, calculée à la lecture.
  Une étape proposed compte comme non terminée.
end note
@enduml
```

---

## 8. Scénarios dynamiques (séquences)

### 8.1 Réclamation d'une étape

Une seule transaction courte, démarrée avec `BEGIN IMMEDIATE` : deux agents concurrents ne peuvent pas obtenir la même étape.

```plantuml
@startuml seq_claim
title Réclamation d'une étape — claim_step
skinparam shadowing false
skinparam responseMessageBelowArrow true

actor "Agent exécuteur" as AG
participant "Serveur MCP\n(profil executor)" as MCP
participant "CoreApi /\nStepService" as CORE
database "SQLite" as DB

AG -> MCP : claim_step({ project?, step? })
MCP -> MCP : valide l'entrée (zod)\nrésout le projet (PLAN_PROJECT)
MCP -> CORE : claimStep(agent, project, step?)
CORE -> DB : BEGIN IMMEDIATE
CORE -> DB : expire les baux échus\n(attempts +1, note système)

alt l'agent détient déjà le maximum d'étapes
  CORE -> DB : ROLLBACK
  CORE --> MCP : ALREADY_HOLDING
else
  CORE -> DB : sélectionne l'étape\n(demandée, ou première prête\npar ticket.position puis step.position)
  alt étape demandée non prête
    CORE -> DB : ROLLBACK
    CORE --> MCP : NOT_READY + raison
  else aucune étape prête
    CORE -> DB : ROLLBACK
    CORE --> MCP : aucune étape prête + next_action
  else étape trouvée
    CORE -> DB : UPDATE in_progress, claimed_by,\nlease_expires_at (bail effectif)
    CORE -> DB : INSERT événement
    CORE -> DB : COMMIT
    CORE --> MCP : paquet complet\n(étape, ticket, dépendances,\nnotes, conventions)
  end
end

MCP --> AG : réponse compacte { ok, ..., next_action }
@enduml
```

### 8.2 Clôture d'une étape et exécution des vérifications

Décision D8 : la commande s'exécute **hors de toute transaction d'écriture**. L'opération est découpée en trois temps.

```plantuml
@startuml seq_complete
title Clôture d'une étape — complete_step
skinparam shadowing false

actor "Agent exécuteur" as AG
participant "Serveur MCP" as MCP
participant "StepService" as SS
participant "GitReader" as GIT
participant "CheckRunner" as RUN
participant "Shell\n(worktree)" as SH
database "SQLite" as DB

AG -> MCP : complete_step({ step, commit_sha,\nworktree_path, branch? })
MCP -> SS : completeStep(...)

== Temps 1 — contrôles et enregistrement (transaction courte) ==
SS -> DB : BEGIN IMMEDIATE
SS -> DB : étape in_progress et détenue par l'appelant ?
SS -> DB : un résultat existe déjà pour (étape, SHA) ?
alt résultat déjà stocké (rejeu)
  SS -> DB : ROLLBACK
  SS --> MCP : résultat stocké (idempotence)
else
  SS -> GIT : chemin sous les racines autorisées ?\nworktree du dépôt ? HEAD == SHA ?
  alt chemin ou SHA invalide
    SS -> DB : ROLLBACK
    SS --> MCP : INVALID_PATH / SHA_MISMATCH
  else
    SS -> DB : COMMIT (bail renouvelé, branche\net worktree enregistrés sur le ticket)
  end
end

== Temps 2 — exécution (aucune transaction ouverte) ==
loop pour chaque vérification de l'étape, dans l'ordre
  SS -> RUN : run(check, worktree, délai)
  RUN -> SH : spawn (shell, cwd, env assaini)
  SH --> RUN : code de sortie, sortie, durée
  RUN --> SS : résultat (ou délai dépassé : kill du groupe)
  note right of SS : arrêt à la première\nvérification en échec (fail_fast)
end

== Temps 3 — conclusion (transaction courte) ==
SS -> DB : BEGIN IMMEDIATE
SS -> DB : INSERT check_runs
alt aucune vérification associée
  SS -> DB : étape -> needs_input + note système
else toutes réussies
  SS -> DB : étape -> done\n(ou review si requires_review)
else au moins une en échec
  SS -> DB : attempts +1\nétape -> in_progress\n(ou failed si attempts >= max)
end
SS -> DB : INSERT événement ; COMMIT
SS --> MCP : result, checks (queues de sortie), attempts restantes
MCP --> AG : réponse compacte + next_action
@enduml
```

### 8.3 Planification, proposition et acceptation

```plantuml
@startuml seq_plan
title Planification — propose_plan puis validation humaine
skinparam shadowing false

actor "Agent planificateur" as AP
participant "Serveur MCP\n(profil planner)" as MCP
participant "PlanProposalService" as PPS
participant "DependencyService" as DS
database "SQLite" as DB
actor "Humain" as H
participant "UI Next.js" as UI

AP -> MCP : get_overview({ project })
MCP --> AP : état du projet, conventions,\nvérifications disponibles

AP -> MCP : propose_plan({ ticket, steps[], deps[] })
MCP -> PPS : proposePlan(...)
PPS -> PPS : limites (réglages plan.*),\nvérifications nommées existantes ?
PPS -> DS : refs résolues, cycle ?
alt cycle ou référence inconnue
  PPS --> MCP : CYCLE_DETECTED / VALIDATION\n(aucune écriture)
else
  PPS -> DB : BEGIN IMMEDIATE
  PPS -> DB : INSERT ticket, étapes, dépendances\n(statut proposed, origin = agent)
  PPS -> DB : INSERT événements ; COMMIT
  PPS --> MCP : clés créées
end
MCP --> AP : clés + « en attente de validation humaine »

...

H -> UI : ouvre « Revue du plan proposé »
UI -> DB : lit les éléments proposed
UI --> H : plan + dépendances suggérées
alt accepte (en bloc ou par élément)
  H -> UI : accepter
  UI -> PPS : acceptProposal(ticket)
  PPS -> DB : ticket -> open ; étapes -> todo ; événement
  note over DB : les étapes sans blocage\ndeviennent « prêtes »
else modifie
  H -> UI : édite titres, étapes, dépendances
else rejette
  H -> UI : rejeter
  UI -> PPS : rejectProposal(ticket)
  PPS -> DB : -> cancelled
end
@enduml
```

### 8.4 Revue de feature : valider ou rejeter

```plantuml
@startuml seq_review
title Revue de feature — validation ou rejet ciblé
skinparam shadowing false

actor "Humain" as H
participant "UI Next.js" as UI
participant "ReviewService" as RS
participant "GitReader" as GIT
database "SQLite" as DB

H -> UI : ouvre la revue du ticket
UI -> RS : getReview(ticket)
RS -> DB : étapes, check_runs, événements
RS -> GIT : diff main...branche\n(lecture seule, taille plafonnée)
GIT --> RS : diff global et par étape
RS --> UI : résumé, résultats, diff, journal
UI --> H : écran de revue

alt valider
  H -> UI : valider
  UI -> RS : validateTicket(ticket)
  RS -> DB : phase = review ?
  RS -> DB : ticket -> done, validated_at ; événement
  note over H : l'humain fusionne la branche\nhors de l'application
else rejet ciblé
  H -> UI : sélectionne les étapes à rouvrir\n+ commentaire
  UI -> RS : rejectSteps(ticket, étapes, commentaire)
  RS -> DB : BEGIN IMMEDIATE
  RS -> DB : étapes choisies -> todo\n(attempts = 0, commit_sha effacé)
  RS -> DB : dépendantes done (transitives) -> todo
  RS -> DB : dépendantes in_progress :\nnote système + événement (non interrompues)
  RS -> DB : note « rejection » sur chaque étape rouverte
  RS -> DB : COMMIT
  RS --> UI : ticket hors de la phase review
else rejet en bloc
  H -> UI : tout rouvrir + commentaire
  UI -> RS : rejectAll(ticket, commentaire)
end
@enduml
```

### 8.5 Export `PLAN.md`

```plantuml
@startuml seq_export
title Export PLAN.md
skinparam shadowing false

actor "Humain" as H
participant "UI / script" as FA
participant "AutoExport\n(processus Next.js)" as AUTO
participant "CoreApi" as CORE
participant "renderPlan\n(fonction pure)" as RP
participant "ExportWriter" as W
database "SQLite" as DB
collections "export_dir" as DIR

alt export manuel
  H -> FA : bouton « Exporter » ou\nnpm run export-plan -- APP
  FA -> CORE : exportPlan(project, options)
else export automatique (si auto_export)
  loop toutes les ui.poll_interval_seconds
    AUTO -> DB : MAX(events.id) a changé ?
  end
  AUTO -> AUTO : anti-rebond\n(export.debounce_seconds)
  AUTO -> CORE : exportPlan(project, options)
end

CORE -> DB : lecture cohérente (une transaction de lecture)\nprojet, tickets, étapes, dépendances, vérifications
CORE -> RP : renderPlan(snapshot, options)
RP --> CORE : texte Markdown\n(tri stable, révision = dernier events.id)
CORE -> W : write(export_dir effectif, texte)
W -> DIR : fichier temporaire puis renommage atomique
W --> CORE : chemin écrit
@enduml
```

---

## 9. Règles de calcul (activités)

### 9.1 Une étape est-elle « prête » ?

`ready` n'est jamais stocké : il est calculé à chaque lecture.

```plantuml
@startuml activite_ready
title Calcul de « ready » pour une étape
skinparam shadowing false

start
if (statut de l'étape = todo ?) then (non)
  :non prête;
  stop
endif
if (statut du ticket = open ?) then (non)
  :non prête\n(ticket proposed, done ou cancelled);
  stop
endif
if (toutes les étapes bloquantes sont done ?) then (non)
  :non prête\n(bloquée par une étape);
  stop
endif
if (tous les tickets bloquants sont done ?) then (non)
  :non prête\n(bloquée par un ticket non validé);
  stop
endif
:prête;
:tri de priorité :\nticket.position, puis step.position;
stop
@enduml
```

### 9.2 Résolution d'un réglage

```plantuml
@startuml activite_reglage
title Résolution de la valeur effective d'un réglage
skinparam shadowing false

start
:lire la définition dans le registre\n(portée, schéma, valeur intégrée);
if (portée = both ET surcharge du projet non nulle ?) then (oui)
  :valeur = surcharge du projet;
elseif (clé présente dans app_settings ?) then (oui)
  :valeur = valeur globale;
else (non)
  :valeur = valeur intégrée du registre;
endif
:valider avec le schéma zod du registre;
:retourner la valeur effective;
stop
@enduml
```

### 9.3 Création d'une dépendance

```plantuml
@startuml activite_dependance
title Création d'une dépendance
skinparam shadowing false

start
:recevoir (bloquant, bloqué);
if (même projet ?\n(étapes : même ticket)) then (non)
  :refuser : VALIDATION;
  stop
endif
if (bloquant = bloqué ?) then (oui)
  :refuser : CYCLE_DETECTED;
  stop
endif
:parcours en profondeur depuis le bloqué\nvers ses propres dépendants;
if (le bloquant est atteint ?) then (oui)
  :refuser : CYCLE_DETECTED\n(avec le chemin);
  stop
endif
:insérer la dépendance\n+ événement;
stop
@enduml
```

---

## 10. Concurrence et cohérence

| Sujet | Mécanisme |
|---|---|
| Accès concurrents à la base | SQLite en mode WAL, `busy_timeout`, `foreign_keys=ON` |
| Courses sur les écritures critiques | `BEGIN IMMEDIATE` pour réclamation, création de plan, transitions, rejet |
| Longues opérations | **Aucune transaction d'écriture pendant une vérification** (D8) : trois temps (enregistrer, exécuter, conclure) |
| Un seul run par worktree | Verrou en mémoire (par `realpath`) dans le processus + contrôle en base entre processus |
| Rejeu d'un appel | Idempotence de `complete_step` sur `(étape, SHA)` : le résultat stocké est renvoyé |
| Détenteur d'étape disparu | Bail avec expiration paresseuse (à chaque `claim_step` / `get_overview`) et minuteur dans Next.js |
| Intégrité des dépendances | Clés étrangères composites `(id, project_id)` ; détection de cycle dans la transaction de création |
| Cohérence de l'export | Lecture dans une seule transaction de lecture ; écriture atomique du fichier |
| Réglages modifiés en cours de route | Lus à chaque usage, pas de cache ; pas de rétroactivité sur baux et vérifications existants |
| Traçabilité | Toute mutation écrit un événement dans la même transaction |

Cas limites à couvrir par des tests : deux agents qui réclament simultanément, un serveur MCP tué pendant une vérification (le bail expire, la reprise est sûre car l'état n'a pas été modifié avant la conclusion), appels `complete_step` répétés après un délai client dépassé.

---

## 11. Frontières de confiance et sécurité

```plantuml
@startuml confiance
title Frontières de confiance
skinparam shadowing false
left to right direction

rectangle "Zone de confiance : humain" as ZH {
  actor "Humain" as H
  component "UI Next.js\n(127.0.0.1)" as UI
  component "Réglages\n+ vérifications nommées" as CFG
}

rectangle "Zone non fiable : agents" as ZA {
  actor "Agents\n(executor / planner)" as AG
  component "Serveur MCP\n(profil restreint)" as MCP
}

rectangle "Noyau + base" as CORE

H --> UI
UI --> CFG : seul point d'écriture\ndes commandes et réglages
UI --> CORE
AG --> MCP : appels d'outils\n(entrées non fiables)
MCP --> CORE : validées (zod)\n+ règles métier

note bottom of MCP
  Aucun outil ne crée ou modifie une vérification
  ni un réglage. Un exécuteur ne peut pas créer
  de plan ; un planificateur ne peut pas réclamer
  d'étape. Un agent n'agit que sur ses étapes.
end note
@enduml
```

| Menace | Parade |
|---|---|
| Un agent injecte une commande arbitraire | Les tickets et étapes ne référencent que des **noms** de vérifications définies par l'humain |
| Un agent déclare des résultats faux | L'application exécute elle-même les vérifications |
| `worktree_path` malveillant | `realpath` sous les `worktree_roots`, worktree du bon dépôt, HEAD = SHA fourni |
| Injection via les noms de branche / SHA | Validation par expression régulière ; appels git par tableau d'arguments, jamais par chaîne shell |
| Fuite de secrets vers les vérifications | Environnement assaini + liste d'autorisation (`checks.env_allowlist`, réglage sensible) |
| Contenu d'agent affiché dans l'UI | Texte échappé, Markdown assaini |
| Accès réseau à l'application | Écoute sur `127.0.0.1` uniquement, non configurable |
| Un agent modifie les réglages | Aucun outil MCP n'y a accès ; modification par l'humain, confirmation pour les réglages sensibles |

---

## 12. Qualités visées et stratégie de test

| Qualité | Visée | Moyen |
|---|---|---|
| Fiabilité | Aucune étape perdue ni doublement réclamée | Transactions courtes, baux, idempotence |
| Sécurité | Aucune exécution de commande non définie par l'humain | Vérifications nommées, confinement des chemins |
| Testabilité | Règles testables sans serveur ni git réel | Noyau pur, ports remplaçables (`Clock`, `CheckRunnerPort`, `GitReaderPort`) |
| Déterminisme | Exports identiques à données identiques | `renderPlan` pur, tri stable, révision au lieu de la date |
| Observabilité | Comprendre l'historique d'une étape | Journal d'événements, `check_runs`, notes |
| Sobriété | Faible coût de contexte côté agent | 6 outils, profils, réponses compactes |
| Évolutivité | Ajouter un CLI ou un import sans toucher aux règles | Façades minces sur `CoreApi` |

**Pyramide de tests**

- *Unitaires* : machine à états, `ReadyCalculator`, détection de cycles, résolution des réglages, `renderPlan` (instantanés).
- *Intégration* : SQLite temporaire (concurrence de réclamations) ; dépôt git temporaire (runner : réussite, échec, délai, SHA différent, chemin hors racines).
- *Contrat MCP* : client MCP du SDK, liste d'outils par profil, parcours réclamer → compléter.
- *Scénarios d'acceptation* : les 18 scénarios de `SPECS.md`, section 12.

---

## 13. Risques et évolutions

| Risque | Probabilité | Atténuation |
|---|---|---|
| Contention d'écriture SQLite avec beaucoup d'agents | Faible à moyenne | Transactions très courtes, `busy_timeout`, mesure en M7 ; migration possible vers PostgreSQL derrière `UnitOfWork` |
| Dérive entre README, SPECS et code | Moyenne | SPECS comme référence, noyau unique, tests d'acceptation |
| Un agent contourne les conventions git | Moyenne | SHA vérifié, commits par étape, revue de feature avec diff |
| Vérifications trop lentes pour un appel bloquant | Moyenne | Délai configurable ; évolution possible vers un mode asynchrone (`get_step_status`) |
| Contamination d'étapes enchaînées avant la revue | Moyenne | Vérifications obligatoires, `requires_review`, rejet ciblé avec cascade |

**Évolutions prévues** (sans casser l'architecture) : CLI mince partageant `CoreApi`, import de `SPECS.md` / `PLAN.md`, vue graphe et chemin critique, mode asynchrone pour `complete_step`, sauvegarde et restauration plus complètes.

---

## 14. Générer les diagrammes

Chaque bloc ```` ```plantuml ```` est un diagramme autonome, nommé dans son `@startuml`.

- **VS Code** : extension PlantUML (aperçu `Alt+D`), ou tout éditeur compatible.
- **Ligne de commande** : Java et Graphviz installés, puis

```bash
java -jar plantuml.jar -tsvg ARCHITECTURE.md
```

PlantUML extrait les blocs `@startuml` … `@enduml` du fichier et produit un fichier par diagramme (`contexte.svg`, `deploiement.svg`, `modules.svg`, `donnees.svg`, `etats_etape.svg`, `etats_ticket.svg`, `seq_claim.svg`, `seq_complete.svg`, `seq_plan.svg`, `seq_review.svg`, `seq_export.svg`, `activite_ready.svg`, `activite_reglage.svg`, `activite_dependance.svg`, `confiance.svg`).

- **Documentation en ligne** : les rendus SVG peuvent être commités à côté du fichier et référencés depuis le README.
