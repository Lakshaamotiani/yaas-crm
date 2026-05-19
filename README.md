# YAAS Sales CRM

YAAS Sales CRM — sales pipeline + onboarding for content production services.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase · dnd-kit · Recharts

---

## What's in the box

### Screens
- **Dashboard** — date range selector (today / 7d / 30d / 90d / YTD / custom), 6 stat cards (leads, contacted, calls held, closed, pipeline value, closed MRR), area chart of new leads + closes over time, pipeline funnel by stage, today's tasks panel.
- **Pipeline** — Kanban board with drag-and-drop between 8 stages, list view, search, owner / source / open-only filters. Each card shows fit-score sparkle, MRR, YouTube badge, tags, contact completeness, last-updated.
- **Lead Detail** — three-column layout:
  - **Left:** inline-editable contact + company + qualification + deal fields, owner, source, tags.
  - **Center:** collapsible sales-script panel, notes composer, full activity timeline (note / call / email / meeting / task / stage_change / system).
  - **Right:** quick actions (log call, send email, schedule follow-up, send proposal, advance stage, won/lost).
- **Call Logger** — modal with the sales script as a multi-section checklist with progress bar; outcome, duration, summary.
- **Tasks** — pending activities across all leads.
- **Settings** — profile, workspace, API & integrations, notifications.

### App shell
- Collapsible left sidebar (persists in `localStorage`); when collapsed it shows just icons with tooltips.
- Account block pinned to the bottom-left with profile, workspace, integrations, theme switcher, sign out.
- Dark / light / system theme via `next-themes`.
- Monochrome Linear/Notion/Vercel aesthetic — no gradients, no glassmorphism.

---

## Getting started

### 1. Install
```bash
npm install
```

### 2. (Optional) Wire up Supabase
The app ships with an in-memory fixture so you can demo it without a database. To use real Supabase storage:

1. Create a Supabase project.
2. Run the SQL in [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql) in the Supabase SQL editor. It creates:
   - `profiles`, `leads`, `deals`, `qualifications`, `activities`
   - Enums for stages, sources, activity types
   - Auto-bootstrap trigger (creating a lead also creates the matching deal + qualification row)
   - `pipeline_summary` and `lead_overview` views
   - Stage-change activity logging trigger
   - RLS policies (auth'd users have full access — swap for tenant-scoped policies before going multi-org)
3. Copy `.env.local.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Replace the bodies of `useOverview`, `useLead`, and the mutators in [`src/lib/store.tsx`](src/lib/store.tsx) with Supabase calls (the function signatures already match the row shapes returned by the migration).

### 3. Run
```bash
npm run dev
```

Open http://localhost:3000 — you'll land on the dashboard.

---

## Data model

```
leads
  ├── deals            (1:1, auto-created by trigger)
  ├── qualifications   (1:1, auto-created by trigger)
  └── activities       (1:N)

deals.stage ∈ new | contacted | call_booked | call_held |
              proposal_sent | negotiating | closed_won | closed_lost
```

Lead fields mirror the YAAS submission form:
`name, email, phone, company, company_website, role, has_youtube_channel,
youtube_channel_link, service_interest, additional_info, source`.

---

## File map

```
src/
├── app/
│   ├── (app)/
│   │   ├── dashboard/page.tsx
│   │   ├── pipeline/page.tsx
│   │   ├── leads/page.tsx
│   │   ├── leads/new/page.tsx
│   │   ├── leads/[id]/page.tsx       ← lead detail
│   │   ├── tasks/page.tsx
│   │   ├── settings/…
│   │   └── layout.tsx                ← app shell with sidebar
│   ├── layout.tsx                    ← theme + store providers
│   ├── globals.css                   ← design tokens
│   └── page.tsx                      ← → /dashboard
├── components/
│   ├── app-sidebar.tsx               ← collapsible sidebar + account block
│   ├── stage-chip.tsx
│   ├── page-header.tsx
│   ├── pipeline/{kanban-board,list-view,lead-card}.tsx
│   ├── lead-detail/{lead-sidebar,sales-script,activity-timeline,
│   │                 notes-composer,quick-actions,call-logger}.tsx
│   ├── dashboard/{date-range,stats-cards,funnel,
│   │              timeline-chart,todays-tasks}.tsx
│   ├── theme-provider.tsx · theme-toggle.tsx
│   └── ui/…                          ← shadcn primitives
├── lib/
│   ├── constants.ts                  ← stages, sales script
│   ├── types.ts                      ← row shapes
│   ├── utils.ts
│   ├── mock-data.ts                  ← in-memory fixtures
│   ├── store.tsx                     ← client store + selectors + actions
│   └── supabase/{client,server}.ts
└── supabase/migrations/0001_initial_schema.sql
```

---

## Notes for live wiring

- The store layer (`src/lib/store.tsx`) is intentionally thin and isolated. Every mutation (`updateLead`, `moveDeal`, `logActivity`, etc.) returns the same shape Supabase would return, so swapping in real queries doesn't ripple through the UI.
- Drag-and-drop is implemented with `@dnd-kit/sortable`. The board commits the new `stage` + `position` to the store, which (when wired to Supabase) needs a single `update deals set stage=$1, position=$2 where id=$3`.
- Stage changes write a `stage_change` activity, mirroring the SQL trigger so the timeline stays consistent whether the move happened client-side or via direct DB write.
