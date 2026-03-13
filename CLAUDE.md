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
- 11 subjects: History, Science, Hands-on Science, Math, Latin, Geography, English, Timeline, Fine Arts, General, Review
- Review tab is a placeholder for future AI game generator
- Design: warm stone palette, terracotta/sage accents, serif headings

## Collect Pipeline (`scripts/collect.ts`)
CLI tool for sourcing and managing YouTube video resources. Run via `npm run collect -- <command> [options]`.

**Commands:** search, descriptions, filter, reclassify, transcripts, export, push, pull, list

**Modules** (`scripts/lib/`):
- `db.ts` — SQLite database for storing video metadata
- `youtube.ts` — YouTube API search (targeted channel + broad global)
- `transcripts.ts` — Fetch video transcripts
- `filter.ts` — Auto-approve/reject + Claude LLM filtering
- `classify.ts` — Extract cycle/week/subject from video titles
- `sheets-sync.ts` — Push/pull videos to/from Google Sheets
- `export.ts` — Export to CSV/JSON

## Environment
- `SHEET_CSV_URL` — Google Sheets published CSV URL (used by SvelteKit app)
- `YOUTUBE_API_KEY` — YouTube Data API key (used by collect pipeline)
- `GOOGLE_SERVICE_ACCOUNT_JSON` — Service account credentials (used by sheets-sync)
- `SHEET_ID` — Google Sheets spreadsheet ID (used by sheets-sync)
- Node v25 locally, configured adapter for nodejs22.x for Vercel compatibility
