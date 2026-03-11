import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

const DB_PATH = join(import.meta.dirname!, '..', 'data', 'cc-resources.db');

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
	if (_db) return _db;
	mkdirSync(join(import.meta.dirname!, '..', 'data'), { recursive: true });
	_db = new Database(DB_PATH);
	_db.pragma('journal_mode = WAL');
	_db.pragma('foreign_keys = ON');
	migrate(_db);
	return _db;
}

function migrate(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS channels (
			channel_id TEXT PRIMARY KEY,
			handle TEXT NOT NULL,
			name TEXT NOT NULL,
			is_target INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS videos (
			video_id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			channel_id TEXT NOT NULL,
			youtube_url TEXT NOT NULL,
			cycle TEXT,
			week TEXT,
			subject TEXT,
			transcript TEXT,
			transcript_fetched INTEGER NOT NULL DEFAULT 0,
			exported INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (channel_id) REFERENCES channels(channel_id)
		);

		CREATE INDEX IF NOT EXISTS idx_videos_cycle_week ON videos(cycle, week);
		CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
	`);
}

// --- Channel helpers ---

export function upsertChannel(channelId: string, handle: string, name: string, isTarget: boolean): void {
	const db = getDB();
	db.prepare(`
		INSERT INTO channels (channel_id, handle, name, is_target)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(channel_id) DO UPDATE SET
			handle = excluded.handle,
			name = excluded.name,
			is_target = MAX(channels.is_target, excluded.is_target)
	`).run(channelId, handle, name, isTarget ? 1 : 0);
}

export function getCachedChannelId(handle: string): string | null {
	const db = getDB();
	const row = db.prepare('SELECT channel_id FROM channels WHERE handle = ?').get(handle) as
		| { channel_id: string }
		| undefined;
	return row?.channel_id ?? null;
}

// --- Video helpers ---

export interface VideoRow {
	video_id: string;
	title: string;
	channel_id: string;
	youtube_url: string;
	cycle: string | null;
	week: string | null;
	subject: string | null;
	transcript: string | null;
	transcript_fetched: number;
	exported: number;
	created_at: string;
	// joined fields
	channel_name?: string;
	channel_handle?: string;
	is_target?: number;
}

export function upsertVideo(v: {
	videoId: string;
	title: string;
	channelId: string;
	youtubeUrl: string;
	cycle: string | null;
	week: string | null;
	subject: string | null;
}): void {
	const db = getDB();
	db.prepare(`
		INSERT INTO videos (video_id, title, channel_id, youtube_url, cycle, week, subject)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(video_id) DO UPDATE SET
			title = excluded.title,
			cycle = COALESCE(excluded.cycle, videos.cycle),
			week = COALESCE(excluded.week, videos.week),
			subject = COALESCE(excluded.subject, videos.subject)
	`).run(v.videoId, v.title, v.channelId, v.youtubeUrl, v.cycle, v.week, v.subject);
}

export function getVideos(opts: {
	cycle?: string;
	week?: string;
	subject?: string;
	transcriptNeeded?: boolean;
}): VideoRow[] {
	const db = getDB();
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (opts.cycle) {
		conditions.push('v.cycle = ?');
		params.push(opts.cycle);
	}
	if (opts.week) {
		conditions.push('v.week = ?');
		params.push(opts.week);
	}
	if (opts.subject) {
		conditions.push('v.subject = ?');
		params.push(opts.subject);
	}
	if (opts.transcriptNeeded) {
		conditions.push('v.transcript_fetched = 0');
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

	return db
		.prepare(
			`SELECT v.*, c.name as channel_name, c.handle as channel_handle, c.is_target
			 FROM videos v
			 LEFT JOIN channels c ON v.channel_id = c.channel_id
			 ${where}
			 ORDER BY CAST(v.week AS INTEGER), v.subject, v.title`
		)
		.all(...params) as VideoRow[];
}

export function setTranscript(videoId: string, transcript: string | null): void {
	const db = getDB();
	db.prepare(`
		UPDATE videos SET transcript = ?, transcript_fetched = ?
		WHERE video_id = ?
	`).run(transcript, transcript ? 1 : -1, videoId);
}

export function markExported(videoIds: string[]): void {
	const db = getDB();
	const stmt = db.prepare('UPDATE videos SET exported = 1 WHERE video_id = ?');
	const tx = db.transaction(() => {
		for (const id of videoIds) stmt.run(id);
	});
	tx();
}

export function getVideoCount(channelId: string, cycle: string): number {
	const db = getDB();
	const row = db
		.prepare('SELECT COUNT(*) as cnt FROM videos WHERE channel_id = ? AND cycle = ?')
		.get(channelId, cycle) as { cnt: number };
	return row.cnt;
}
