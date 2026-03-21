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
- **Pinia stores** — auth.init() runs in main.js before app mount; other stores hydrate in App.vue onMounted (user → fitness → meals → goals)
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
