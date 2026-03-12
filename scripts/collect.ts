import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDB, getVideos } from './lib/db.js';
import { searchTargeted, searchBroad } from './lib/youtube.js';
import { fetchTranscripts } from './lib/transcripts.js';
import { exportCSV } from './lib/export.js';
import { autoApproveWithWeek, filterWithLLM } from './lib/filter.js';
import { reclassifyVideos } from './lib/classify.js';
import { pushToSheet, pullFromSheet } from './lib/sheets-sync.js';

// --- Env Loading ---

function loadEnv(): Record<string, string> {
	const envPath = join(import.meta.dirname!, '..', '.env');
	if (!existsSync(envPath)) {
		console.error('Error: .env file not found. Copy .env.example to .env and fill in values.');
		process.exit(1);
	}
	const env: Record<string, string> = {};
	for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const val = trimmed.slice(eq + 1).trim();
		env[key] = val;
		process.env[key] = val;
	}
	return env;
}

// --- CLI ---

function printUsage(): void {
	console.log(`
Usage: npm run collect -- <command> [options]

Commands:
  search        Search YouTube and store results in SQLite
  filter        Auto-approve videos with week numbers, send the rest to Claude
  reclassify    Re-extract cycle/week/subject from titles for existing videos
  transcripts   Fetch transcripts for videos missing them
  export        Export videos to CSV/JSON
  push          Push videos from local DB to Google Sheets
  pull          Pull videos from Google Sheets into local DB
  list          List videos in the database

Options:
  --cycle <N>   Cycle number (required)
  --week <N>    Week number (optional for some commands)
  --subject <S> Filter by subject (for list)
  --broad       Use broad global search instead of targeted channel search

Examples:
  npm run collect -- search --cycle 2
  npm run collect -- search --cycle 2 --week 18 --broad
  npm run collect -- filter --cycle 2
  npm run collect -- reclassify --cycle 2
  npm run collect -- transcripts --cycle 2
  npm run collect -- export --cycle 2 --week 18
  npm run collect -- push --cycle 2
  npm run collect -- push --cycle 2 --week 18
  npm run collect -- pull
  npm run collect -- pull --cycle 2
  npm run collect -- list --cycle 2 --week 18 --subject History
`);
}

interface CLIArgs {
	command: string;
	cycle: string;
	week?: string;
	subject?: string;
	broad: boolean;
}

function parseArgs(): CLIArgs {
	const args = process.argv.slice(2);
	let command = '';
	let cycle = '';
	let week: string | undefined;
	let subject: string | undefined;
	let broad = false;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--cycle' && args[i + 1]) cycle = args[++i];
		else if (args[i] === '--week' && args[i + 1]) week = args[++i];
		else if (args[i] === '--subject' && args[i + 1]) subject = args[++i];
		else if (args[i] === '--broad') broad = true;
		else if (!args[i].startsWith('-') && !command) command = args[i];
	}

	if (!command || (!cycle && command !== 'pull')) {
		printUsage();
		process.exit(1);
	}

	return { command, cycle, week, subject, broad };
}

// --- List command ---

function listVideos(cycle: string, week?: string, subject?: string): void {
	const videos = getVideos({ cycle, week, subject });

	if (videos.length === 0) {
		console.log('No videos found.');
		return;
	}

	// Group by week
	const byWeek = new Map<string, typeof videos>();
	for (const v of videos) {
		const w = v.week ?? '?';
		const list = byWeek.get(w) ?? [];
		list.push(v);
		byWeek.set(w, list);
	}

	const weekKeys = [...byWeek.keys()].sort((a, b) => {
		const na = parseInt(a, 10);
		const nb = parseInt(b, 10);
		if (isNaN(na) && isNaN(nb)) return a.localeCompare(b);
		if (isNaN(na)) return 1;
		if (isNaN(nb)) return -1;
		return na - nb;
	});

	console.log(`\n${videos.length} videos for Cycle ${cycle}${week ? ` Week ${week}` : ''}${subject ? ` [${subject}]` : ''}\n`);

	for (const w of weekKeys) {
		const vids = byWeek.get(w)!;
		console.log(`--- Week ${w} (${vids.length} videos) ---`);
		for (const v of vids) {
			const target = v.is_target ? '★' : ' ';
			const transcript = v.transcript_fetched === 1 ? 'T' : v.transcript_fetched === -1 ? '✗' : ' ';
			const subj = (v.subject ?? '?').padEnd(18);
			const title = v.title.slice(0, 55).padEnd(55);
			const channel = (v.channel_name ?? '').slice(0, 25);
			console.log(`  ${target} [${transcript}] ${subj} ${title} ${channel}`);
		}
		console.log();
	}

	console.log('Legend: ★ = target channel, T = transcript fetched, ✗ = transcript unavailable');
}

// --- Main ---

async function main() {
	const { command, cycle, week, subject, broad } = parseArgs();
	const env = loadEnv();

	// Initialize DB on any command
	getDB();

	switch (command) {
		case 'search': {
			const apiKey = env['YOUTUBE_API_KEY'];
			if (!apiKey) {
				console.error('Error: YOUTUBE_API_KEY not set in .env');
				process.exit(1);
			}

			if (broad) {
				if (!week) {
					console.error('Error: --week is required for broad search');
					process.exit(1);
				}
				await searchBroad(cycle, week, apiKey);
			} else {
				await searchTargeted(cycle, apiKey);
			}

			// Auto-approve videos that have a week number in the title
			const approved = autoApproveWithWeek(cycle);
			if (approved > 0) {
				console.log(`\nAuto-approved ${approved} videos with week numbers in title.`);
			}
			break;
		}

		case 'filter': {
			const approved = autoApproveWithWeek(cycle);
			console.log(`Auto-approved ${approved} videos with week numbers in title.`);
			await filterWithLLM(cycle);
			break;
		}

		case 'reclassify': {
			reclassifyVideos(cycle);
			break;
		}

		case 'transcripts':
			await fetchTranscripts(cycle, week);
			break;

		case 'export':
			exportCSV(cycle, week);
			break;

		case 'push':
			await pushToSheet(cycle, week);
			break;

		case 'pull':
			await pullFromSheet(cycle || undefined);
			break;

		case 'list':
			listVideos(cycle, week, subject);
			break;

		default:
			console.error(`Unknown command: ${command}`);
			printUsage();
			process.exit(1);
	}
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
