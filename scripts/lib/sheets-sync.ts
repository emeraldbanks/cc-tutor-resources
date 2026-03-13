import { readFileSync } from 'fs';
import { google } from 'googleapis';
import { getVideos, markExported, upsertVideo, upsertChannel } from './db.js';

function getYouTubeId(url: string): string | null {
	const m = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/);
	return m?.[1] ?? null;
}

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === ',') {
				result.push(current);
				current = '';
			} else {
				current += char;
			}
		}
	}
	result.push(current);
	return result;
}

async function getSheetsClient() {
	const keyPath = process.env['GOOGLE_SERVICE_ACCOUNT_JSON'];
	if (!keyPath) {
		throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set in .env');
	}
	const key = JSON.parse(readFileSync(keyPath, 'utf-8'));
	const auth = new google.auth.GoogleAuth({
		credentials: key,
		scopes: ['https://www.googleapis.com/auth/spreadsheets'],
	});
	return google.sheets({ version: 'v4', auth });
}

export async function pushToSheet(cycle: string, week?: string): Promise<void> {
	const sheetId = process.env['SHEET_ID'];
	if (!sheetId) {
		throw new Error('SHEET_ID not set in .env');
	}

	const videos = getVideos({ cycle, week });
	if (videos.length === 0) {
		console.log('No videos to push.');
		return;
	}

	const sheets = await getSheetsClient();

	const header = ['cycle', 'week', 'subject', 'youtube_url', 'title', 'notes', 'description'];
	const rows = videos.map((v) => [
		v.cycle ?? '',
		v.week ?? '',
		v.subject ?? '',
		v.youtube_url,
		v.title,
		v.channel_name ?? '',
		v.description ?? '',
	]);

	// Clear and write
	await sheets.spreadsheets.values.clear({
		spreadsheetId: sheetId,
		range: 'Sheet1',
	});

	await sheets.spreadsheets.values.update({
		spreadsheetId: sheetId,
		range: 'Sheet1!A1',
		valueInputOption: 'RAW',
		requestBody: {
			values: [header, ...rows],
		},
	});

	markExported(videos.map((v) => v.video_id));
	console.log(`Pushed ${videos.length} videos to Google Sheets.`);
}

export async function pullFromSheet(cycle?: string): Promise<void> {
	const csvUrl = process.env['SHEET_CSV_URL'];
	if (!csvUrl) {
		throw new Error('SHEET_CSV_URL not set in .env');
	}

	const res = await fetch(csvUrl);
	if (!res.ok) {
		throw new Error(`Failed to fetch sheet: ${res.status}`);
	}
	const csv = await res.text();

	const lines = csv.trim().split('\n');
	if (lines.length < 2) {
		console.log('No data in sheet.');
		return;
	}

	const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

	// Ensure placeholder channel exists
	const placeholderChannelId = 'unknown';
	upsertChannel(placeholderChannelId, 'unknown', 'Unknown (imported)', false);

	let count = 0;
	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i]);
		const row: Record<string, string> = {};
		headers.forEach((h, idx) => {
			row[h] = (values[idx] ?? '').trim();
		});

		if (!row['cycle'] || !row['week'] || !row['subject']) continue;
		if (cycle && row['cycle'] !== cycle) continue;

		const videoId = getYouTubeId(row['youtube_url'] ?? '');
		if (!videoId) continue;

		upsertVideo({
			videoId,
			title: row['title'] ?? '',
			channelId: placeholderChannelId,
			youtubeUrl: row['youtube_url'] ?? '',
			cycle: row['cycle'],
			week: row['week'],
			subject: row['subject'],
			description: row['description'] || null,
		});
		count++;
	}

	console.log(`Pulled ${count} videos from Google Sheets into local DB.`);
}
