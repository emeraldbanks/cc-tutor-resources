# CC Tutor Resources - Project Memory

## Stack
- SvelteKit + TypeScript + Tailwind CSS v4
- Vercel adapter (nodejs22.x runtime)
- Google Sheets CSV as data source

## Architecture
- `src/lib/sheets.server.ts` — server-only CSV fetch/parse (uses `$env/static/private`)
- `src/lib/types.ts` — shared types/constants (Resource, SUBJECTS)
- `src/lib/utils.ts` — client-safe utilities (getYouTubeId)
- Routes: `/` → `/cycle/[cycle]` → `/cycle/[cycle]/week/[week]`
- Components: VideoEmbed, SubjectTabs, Breadcrumb, WeekNav, CycleCard, WeekCard

## Key Decisions
- Separated server-only code (`sheets.server.ts`) from client-safe code (`types.ts`, `utils.ts`) to avoid `$env/static/private` leaking to browser
- 10 subjects: History, Science, Hands-on Science, Math, Latin, Geography, English, Timeline, Fine Arts, Review
- Review tab is a placeholder for future AI game generator
- Design: warm stone palette, terracotta/sage accents, serif headings

## Environment
- `SHEET_CSV_URL` in `.env` — Google Sheets published CSV URL
- Node v25 locally, configured adapter for nodejs22.x for Vercel compatibility
