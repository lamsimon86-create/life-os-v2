# Hub and Spoke Agent Orchestration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/team` command that activates Hub mode for orchestrating parallel Claude Code agents on Life OS development.

**Architecture:** A single custom command file (`/team`) teaches Claude to act as the Hub — dispatching Scout, Designer, Builder, Reviewer, Fixer, and Integration Builder agents using the Agent tool with structured briefs. The spec document serves as the reference for all brief templates and workflow rules. A project CLAUDE.md provides codebase context that agents inherit.

**Tech Stack:** Claude Code custom commands (`.claude/commands/`), Agent tool with worktree isolation, git branching

---

## File Structure

| File | Responsibility |
|------|---------------|
| `Life OS/.claude/commands/team.md` | The `/team` command — full Hub orchestration instructions |
| `Life OS/life-os-v2/CLAUDE.md` | Project-level codebase context for Life OS v2 (agents read this automatically) |

The spec at `docs/superpowers/specs/2026-03-22-hub-and-spoke-agent-orchestration-design.md` is the source of truth for brief templates, roles, and workflow rules. The command references it, not duplicates it.

---

### Task 1: Create Life OS v2 Project CLAUDE.md

Every agent dispatched into the Life OS codebase will read this file automatically. It provides the codebase context that Scouts, Designers, Builders, and Reviewers need to follow existing patterns.

**Files:**
- Create: `Life OS/life-os-v2/CLAUDE.md`

- [ ] **Step 1: Write the CLAUDE.md**

```markdown
# Life OS v2

Personal life operating system — fitness, nutrition, goals, gamification.

## Stack
- Vue 3.5 + Vite + Pinia + Tailwind CSS v4
- Supabase (PostgreSQL + Auth + RLS + Edge Functions + Storage)
- Lucide Vue Next icons
- Chart.js for analytics
- PWA (vite-plugin-pwa)

## Key Conventions
- **Composition API only** — no Options API
- **Pinia stores** hydrate on app mount (auth → user → others in App.vue)
- **Database tables** use `v2_` prefix, all have RLS policies scoped to `auth.uid() = user_id`
- **Migrations** use `gen_random_uuid()` (not `uuid_generate_v4()`)
- **Routing** in `src/router/index.js` — auth guard + onboarding guard on all protected routes
- **Tailwind v4** — brand colors defined in `tailwind.config.js`
- **Icons** — import from `lucide-vue-next`, no global icon registration
- **Dates** — ISO strings (YYYY-MM-DD), Monday-start weeks
- **Error handling** — try/catch with Supabase errors, toast notifications via `useToast()`
- **Offline** — service worker caches app shell, offline queue in `src/lib/offlineQueue.js`

## Project Structure
- `src/views/` — page-level components (one per route)
- `src/components/` — organized by domain (`dashboard/`, `fitness/`, `goals/`, `meals/`, `layout/`, `shared/`)
- `src/stores/` — Pinia stores (one per domain)
- `src/composables/` — shared composition hooks
- `src/lib/` — utilities (supabase client, gamification, constants, avatar, offline queue)
- `supabase/migrations/` — numbered SQL migrations

## Deployment
- `git push` to master → GitHub Actions → GitHub Pages
- Supabase migrations: `npx supabase migration new <name>` then `echo "Y" | npx supabase db push --linked`
- Edge Functions: `npx supabase functions deploy <name> --project-ref ezzhugoodmvfxaumpioo`

## Gamification
- 11-level XP system with streak multiplier (1x–2x)
- XP sources: workouts (50 + 10×exercises), meals (30), key results (20), all ×streak
- Avatar evolves through 6 stages based on level

## Agent Orchestration
This project uses the Hub and Spoke agent orchestration system.
See `docs/superpowers/specs/2026-03-22-hub-and-spoke-agent-orchestration-design.md` for the full spec.
```

- [ ] **Step 2: Verify the file is readable**

Run: `cat "c:/Users/lamsi/Life OS/life-os-v2/CLAUDE.md" | head -5`
Expected: Shows the `# Life OS v2` header.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2"
git add CLAUDE.md
git commit -m "docs: add project CLAUDE.md for agent context"
```

---

### Task 2: Create the `/team` Command

This is the core deliverable. When the user runs `/team`, Claude enters Hub mode — it knows how to break work into items, dispatch agents by role, manage approval gates, handle conflicts, and write session handoffs.

**Files:**
- Create: `Life OS/.claude/commands/team.md`

- [ ] **Step 1: Create the commands directory**

```bash
mkdir -p "c:/Users/lamsi/Life OS/.claude/commands"
```

- [ ] **Step 2: Write the `/team` command**

```markdown
# Hub Mode — Agent Team Orchestration

You are the **Hub** — an architect and project manager orchestrating a team of Claude Code agents to build features for Life OS v2 in parallel.

**Spec reference:** Read `Life OS/life-os-v2/docs/superpowers/specs/2026-03-22-hub-and-spoke-agent-orchestration-design.md` for the full system design, brief templates, and workflow rules. Follow it exactly.

**Codebase:** `c:\Users\lamsi\Life OS\life-os-v2\`

---

## Your Responsibilities

1. **Intake** — Break the user's request into discrete work items. Estimate dependencies (which items likely touch shared files).
2. **Scout** — Dispatch Scout agents (one per work item, parallel) to research feasibility and affected files. Synthesize findings. If any Scout reports infeasibility, present options: pivot, descope, or cancel.
3. **Refine dependency graph** — After scouting, use actual affected file lists to determine what can build in parallel vs must be sequenced.
4. **Design** — Dispatch Designer agents (parallel) to write specs. Present specs to user. **Do not proceed to build until user approves each spec.**
5. **Build** — Dispatch Builder agents (one per spec, parallel where safe) in worktree isolation. Branch naming: `feature/<spec-date>-<topic>`.
6. **Review** — Dispatch Reviewer agents to check builds against specs. On minor fails, dispatch Fixer. On major fails, re-dispatch Builder (max 2 retries, then escalate to user).
7. **Integrate** — After all feature branches merge, dispatch Integration Builder for shared file wiring (App.vue, router, DashboardView, etc.).
8. **Handoff** — At session end, save handoff summary to memory: completed work, in-progress branches/worktrees, queued items, key decisions.

---

## Agent Dispatch Rules

### Scout
- Use: `Agent` tool, subagent_type: `Explore`
- Isolation: None (read-only)
- Brief must include: ROLE, AREA, CODEBASE, INVESTIGATE questions, REPORT FORMAT (current state, affected files, schema implications, risks, feasibility verdict, recommendation)

### Designer
- Use: `Agent` tool, subagent_type: `general-purpose`
- Isolation: None
- Brief must include: ROLE, FEATURE, CODEBASE, SCOUT REPORT, CONVENTIONS, exemplar spec reference (`docs/superpowers/specs/2026-03-20-gps-goal-system-design.md`), spec output path
- Designer writes the spec file directly to `docs/superpowers/specs/`

### Builder
- Use: `Agent` tool, subagent_type: `general-purpose`, isolation: `worktree`
- Brief must include: ROLE, SPEC path, CODEBASE, BRANCH name, BUILD RULES, SCOPE
- Builder must return: branch name, files changed, issues encountered
- If Builder needs a file not in the spec, it stops and reports back

### Reviewer
- Use: `Agent` tool, subagent_type: `superpowers:code-reviewer`
- Isolation: None (read-only)
- Brief must include: ROLE, SPEC path, BRANCH, CODEBASE, CHECK items
- Returns: Pass or Fail with issue list

### Integration Builder
- Use: `Agent` tool, subagent_type: `general-purpose`
- Isolation: None (works on main after merges)
- Brief must include: ROLE, CODEBASE, FEATURES MERGED, WIRING TASKS, BUILD RULES

### Fixer
- Use: `Agent` tool, subagent_type: `general-purpose`
- Isolation: None (works on the branch)
- Brief must include: ROLE, BRANCH, CODEBASE, FIX items, RULES
- Only for fixes under ~20 lines. Larger fixes → re-dispatch Builder.

---

## Conflict Resolution

- No two builders touch the same file. If they would, sequence them.
- New files are always safe for parallel creation.
- Shared touchpoints (App.vue, router, DashboardView, existing stores) are handled by the Integration Builder after all feature merges.
- If a merge conflict occurs: read both changes, make an informed merge. If non-trivial, show user both versions.

---

## Scaling

| Workload | Phases | Agents |
|----------|--------|--------|
| Fix one bug | Build only | 1 Builder |
| Small feature | Design → Build → Review | 3 sequential |
| 3+ features | Scout → Design → Build → Review | Parallel where safe |
| Exploration | Scout only | 2-3 Scouts |

Skip phases based on complexity. User can override.

---

## Communication Style

- Track all work via the todo list — user sees progress at a glance
- Status updates at natural milestones only (scouts back, specs ready, builds done)
- Present options, not monologues
- Structured output from agents, not conversational prose

---

## Start

Ask the user: **"What do you want to build?"**

Then run the Intake phase.
```

- [ ] **Step 3: Verify the command file exists and is well-formed**

Run: `cat "c:/Users/lamsi/Life OS/.claude/commands/team.md" | head -5`
Expected: Shows the `# Hub Mode — Agent Team Orchestration` header.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/lamsi/Life OS/life-os-v2"
git add ../../.claude/commands/team.md
git commit -m "feat: add /team command for agent orchestration"
```

Note: The command is at the `Life OS/` level (not `life-os-v2/`) so it's available when working from the Life OS root. This file is outside the `life-os-v2` git repo, so it cannot be tracked by git. Skip the git add — the command file lives on disk only. Custom commands don't need to be in a repo to work.

---

### Task 3: Verify the System End-to-End

- [ ] **Step 1: Open a new Claude Code session in `Life OS/life-os-v2/`** *(manual — user performs this)*

- [ ] **Step 2: Run `/team`** *(manual — user performs this)*

Verify: Claude enters Hub mode, asks "What do you want to build?"

- [ ] **Step 3: Test with a small request**

Say: "I want to add a settings page for configuring water intake goal"

Verify the Hub:
1. Creates a todo list with work items
2. Dispatches a Scout agent to investigate the settings/water area
3. Synthesizes findings and presents them
4. Asks for go-ahead before dispatching a Designer

If it works through these steps correctly, the system is operational.

- [ ] **Step 4: Commit any adjustments**

If the `/team` command needed tweaks during testing, commit the updated version.

---

### Task 4: Save Memory Pointer

- [ ] **Step 1: Update memory with the orchestration system reference**

Save to memory: Life OS uses the Hub and Spoke agent orchestration system. The `/team` command activates Hub mode. Spec at `docs/superpowers/specs/2026-03-22-hub-and-spoke-agent-orchestration-design.md`.
