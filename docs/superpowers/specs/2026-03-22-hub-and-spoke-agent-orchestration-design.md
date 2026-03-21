# Hub and Spoke Agent Orchestration System

**Date:** 2026-03-22
**Status:** Approved
**Project:** Life OS v2

## Overview

A system for orchestrating multiple Claude Code agents to work on Life OS in parallel. One main conversation (the Hub) acts as architect and project manager, dispatching specialized agents (Spokes) for research, design, implementation, and review.

The user approves specs before any code is written. Agents never improvise beyond their brief.

## Roles

### Hub (Main Conversation)

The Hub is the architect and project manager. Responsibilities:

- Maintain the master task board (todo list) tracking what needs doing, what's in flight, what's done
- Break user requests into discrete work items
- Build dependency graphs to determine what can run in parallel
- Dispatch agents with structured briefs
- Synthesize agent outputs into decisions
- Present specs/plans to the user for approval
- Handle merging and integration of completed work
- Write session handoff summaries to memory
- Dispatch an Integration Builder for shared file wiring after all feature builders finish

The Hub never writes feature code directly. It delegates implementation to Builder agents. The one exception is trivial fixes during review (see Fixer role below).

### Scout (Read-Only Explorer)

**Purpose:** Research and feasibility analysis.
**Isolation:** None (read-only access).
**Output:** Structured report returned as message content.

Brief template:

```
ROLE: Scout
AREA: [feature area]
CODEBASE: c:\Users\lamsi\Life OS\life-os-v2\

INVESTIGATE:
- [specific question 1]
- [specific question 2]
- [specific question 3]

REPORT FORMAT:
1. Current state (what exists, how it works)
2. Affected files (list every file this feature would touch)
3. Schema implications (new tables? columns? migrations?)
4. Risks or gotchas (patterns to follow, things to avoid)
5. Feasibility verdict (feasible / feasible with caveats / infeasible + why)
6. Recommendation (how you'd approach this)
```

**Infeasibility handling:** If a Scout reports a feature as infeasible or requiring a fundamentally different approach, the Hub presents the finding to the user with options: pivot the approach, descope the feature, or cancel the work item. The work item does not advance to Design until resolved.

### Designer (Spec Writer)

**Purpose:** Write design specs from feature briefs + scout reports.
**Isolation:** None.
**Write access:** Scoped to `docs/superpowers/specs/` only.
**Output:** Spec doc written to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.

Brief template:

```
ROLE: Designer
FEATURE: [feature name]
CODEBASE: c:\Users\lamsi\Life OS\life-os-v2\
SCOUT REPORT: [pasted or referenced]
EXEMPLAR SPEC: docs/superpowers/specs/2026-03-20-gps-goal-system-design.md

CONVENTIONS:
- Vue 3 Composition API, Pinia stores, Tailwind v4
- v2_ table prefix, RLS on all tables, gen_random_uuid()
- Spec format: docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
- Follow the structure of the exemplar spec

WRITE A SPEC COVERING:
- What it does (user-facing behavior)
- Components (new/modified Vue components, with file paths)
- Store changes (new/modified Pinia stores, with file paths)
- Database changes (tables, columns, migrations, RLS policies)
- Data flow (how data moves from DB → store → component)
- Affected files (complete list of every file created or modified)
- Edge cases

DO NOT write code. Write the spec only.
```

### Builder (Worktree-Isolated Implementer)

**Purpose:** Implement approved specs.
**Isolation:** Git worktree (isolated branch).
**Branch naming:** `feature/<spec-date>-<topic>` (e.g., `feature/2026-03-22-journal`)
**Output:** Completed branch with commit history. Returns: branch name, list of files changed, any issues encountered.

Brief template:

```
ROLE: Builder
SPEC: docs/superpowers/specs/[spec-file].md
CODEBASE: c:\Users\lamsi\Life OS\life-os-v2\
BRANCH: feature/[spec-date]-[topic]

BUILD RULES:
- Follow the spec exactly — no extras, no skipped items
- Follow existing patterns in the codebase
- Commit with descriptive messages
- If the spec is ambiguous, make the conservative choice
- If something in the spec seems wrong, stop and report back

SCOPE: Only touch files listed in the spec's "Affected files" section.
If you need to modify a file not in the spec, STOP and report back
with: what file, what change, and why.

RETURN: Branch name, list of files changed, any issues encountered.
```

**Out-of-scope file requests:** When a Builder reports needing to modify a file not in the spec, the Hub evaluates the request and either: (a) updates the spec and re-dispatches, (b) grants a scoped one-time exception, or (c) dispatches a Scout to investigate if the need suggests a design gap.

### Integration Builder

**Purpose:** Wire shared files after all feature builders finish.
**Isolation:** None (works on main branch after merges).
**Output:** Commit with all integration wiring.

Used when multiple features each need changes to shared files (App.vue, router, DashboardView). The Hub dispatches a single Integration Builder with a consolidated brief listing all wiring changes needed, rather than having each feature builder touch shared files.

Brief template:

```
ROLE: Integration Builder
CODEBASE: c:\Users\lamsi\Life OS\life-os-v2\
FEATURES MERGED: [list of feature branches just merged]

WIRING TASKS:
- [e.g., "Import and hydrate journalStore in App.vue"]
- [e.g., "Add /journal route to router/index.js"]
- [e.g., "Add JournalCard to DashboardView.vue"]

BUILD RULES:
- Only touch shared files listed above
- Follow existing patterns (look at how other stores/routes/cards are wired)
- Single commit with descriptive message
```

### Reviewer (Read-Only Checker)

**Purpose:** Review builder output against the spec.
**Isolation:** None (read-only access).
**Output:** Pass or Fail with specific issue list.

Brief template:

```
ROLE: Reviewer
SPEC: docs/superpowers/specs/[spec-file].md
BRANCH: feature/[spec-date]-[topic]
CODEBASE: c:\Users\lamsi\Life OS\life-os-v2\

CHECK:
1. Does the implementation match every item in the spec?
2. Does it follow existing codebase patterns?
3. Are there edge cases the spec covered that the code missed?
4. Are there new files/changes not in the spec? (flag them)
5. Would this break anything existing?

RETURN: Pass or Fail, with specific issue list if Fail.
```

### Fixer (Lightweight Correction Agent)

**Purpose:** Small corrections that don't warrant a full Builder dispatch.
**Isolation:** None (works on the branch being fixed).
**Output:** Commit with fix.

Used for: missed imports, typos, minor style adjustments, small fixes flagged by the Reviewer. If the fix is more than ~20 lines of changes, use a Builder instead.

```
ROLE: Fixer
BRANCH: feature/[spec-date]-[topic]
CODEBASE: c:\Users\lamsi\Life OS\life-os-v2\

FIX:
- [specific issue from Reviewer, e.g., "Missing import for ref in JournalView.vue line 3"]

RULES:
- Fix only the listed issues, nothing else
- Single commit: "fix: [description]"
```

## Workflow Phases

### Phase 1: Intake

User describes what they want. Hub breaks it into discrete work items and makes a rough dependency estimate (which items likely touch shared files). This estimate is refined after Scouting.

### Phase 2: Scouting (Parallel)

Hub dispatches Scout agents — one per work item, all in parallel. Scouts return structured reports including affected file lists and feasibility verdicts.

Hub synthesizes into a summary for the user. If any Scout reports infeasibility, Hub presents options: pivot, descope, or cancel.

After scouting, Hub refines the dependency graph using the actual affected file lists from Scout reports. This determines which items can build in parallel vs must be sequenced.

### Phase 3: Design (Parallel, after user go-ahead)

Hub dispatches Designer agents — one per work item, in parallel. Each Designer gets the feature brief + scout report + exemplar spec reference. Designers write spec docs including an "Affected files" section.

**Hard gate: User approves each spec before it moves to build.**

### Phase 4: Build (Parallel, worktree-isolated)

Hub dispatches Builder agents — one per approved spec, each in its own worktree on a named branch (`feature/<spec-date>-<topic>`). Builders commit with descriptive messages and return completed branches.

Parallel build constraints (see Conflict Resolution for details):
- No two builders touch the same file
- New files are always safe to create in parallel
- Shared file modifications are deferred to the Integration Builder
- If two features must touch the same non-shared file, Hub sequences them

### Phase 5: Review & Merge

Hub dispatches Reviewer agents — one per completed build. Reviewers check against the spec and return pass/fail.

- On pass: Hub merges the branch
- On fail with minor issues: Hub dispatches a Fixer agent
- On fail with major issues: Hub re-dispatches a Builder with the issue list
- **Retry bound: Max 2 retries per work item.** After 2 failures, Hub pauses the work item and surfaces the problem to the user with the full issue history.

After all feature branches are merged, Hub dispatches the Integration Builder to wire shared files.

User does final sign-off after integration.

## Conflict Resolution

### Dependency Graph (Two-Pass)

**Pass 1 (Intake):** Hub makes a rough estimate of which features will overlap based on the user's description. Used to decide scouting strategy.

**Pass 2 (Post-Scouting):** Hub refines the dependency graph using actual affected file lists from Scout reports. This is the authoritative graph used for build scheduling.

Example:

```
Feature X → new store, new component, new migration, modifies DashboardView
Feature Y → new store, new component, new migration, modifies DashboardView
Feature Z → new component only, no shared files
```

From this:
- X, Y, and Z can all build in parallel if DashboardView changes are deferred to Integration Builder
- If they modify a non-shared file in common, Hub sequences those two

### Shared Touchpoints in Life OS

Files frequently modified by multiple features:
- `src/App.vue` — store hydration orchestration
- `src/router/index.js` — new routes
- `src/views/DashboardView.vue` — adding dashboard cards
- Existing Pinia stores that multiple features extend

These are handled by the Integration Builder, not by individual feature Builders.

### Rules

1. No two builders touch the same file — if they would, Hub sequences them
2. New files are always safe for parallel creation
3. Shared touchpoint modifications are deferred to the Integration Builder after all feature merges
4. If a Builder discovers it needs an unlisted file, it stops and reports back

### When Conflicts Happen Anyway

1. Hub reads both changes and makes an informed merge (no force-resolve)
2. If non-trivial, Hub shows user both versions and asks which to keep
3. Reviewer agent re-checks after merge

## Scaling

| Workload | Phases Used | Agents |
|----------|-------------|--------|
| Fix one bug | Build only | 1 Builder |
| Small feature | Design → Build → Review | 3 sequential |
| 3 new features | Scout → Design → Build → Review | 12+ parallel where safe |
| Exploration only | Scout only | 2-3 Scouts |

Phases can be skipped based on complexity. Hub decides, user can override.

## Session Handoff

At end of session, Hub writes a handoff summary to memory covering:
- What was completed and merged
- What's in progress (branches, partial specs)
- Active worktrees and their branch names / completion status
- What's queued for next session
- Decisions made that future sessions should know

Next session's Hub picks up from the handoff.

## Communication Rules

- Agents never talk to each other — everything routes through the Hub
- Agents return structured output, not conversational prose
- If an agent gets stuck or finds something unexpected, it reports back rather than improvising
- Hub tracks agent status via the todo list so user can see progress
