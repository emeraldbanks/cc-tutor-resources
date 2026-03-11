import { upsertChannel, getCachedChannelId, upsertVideo, getVideoCount } from './db.js';
import { classifySubject, extractWeek, extractCycle, decodeHTMLEntities } from './classify.js';

// --- Types ---

interface YouTubeSearchItem {
	id: { videoId: string };
	snippet: {
		title: string;
		channelTitle: string;
		channelId: string;
	};
}

interface YouTubeSearchResponse {
	items?: YouTubeSearchItem[];
	nextPageToken?: string;
	error?: { message: string };
}

// --- Config ---

export const TARGET_CHANNELS: Record<string, string> = {
	'Professor Latimer': '@professorlatimer',
	'The Homeschool Helper': '@TheHomeschoolHelper',
	'Home Video Variety Show': '@HomeVideoVarietyShow',
	'Postmodern Mom': '@PostmodernMom',
	'Devoted to Littles': '@Devotedtolittles',
};

// --- YouTube API ---

async function youtubeSearch(
	query: string,
	apiKey: string,
	opts: { maxResults?: number; order?: string; channelId?: string; pageToken?: string } = {}
): Promise<{ items: YouTubeSearchItem[]; nextPageToken?: string }> {
	const params = new URLSearchParams({
		part: 'snippet',
		q: query,
		type: 'video',
		maxResults: String(opts.maxResults ?? 50),
		key: apiKey,
	});
	if (opts.order) params.set('order', opts.order);
	if (opts.channelId) params.set('channelId', opts.channelId);
	if (opts.pageToken) params.set('pageToken', opts.pageToken);

	const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
	const data: YouTubeSearchResponse = await resp.json();
	if (data.error) {
		console.error(`YouTube API error: ${data.error.message}`);
		return { items: [] };
	}
	return { items: data.items ?? [], nextPageToken: data.nextPageToken };
}

export async function resolveChannelId(handle: string, name: string, apiKey: string, isTarget: boolean): Promise<string | null> {
	// Check cache first
	const cached = getCachedChannelId(handle);
	if (cached) return cached;

	const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
	const params = new URLSearchParams({
		part: 'snippet',
		q: cleanHandle,
		type: 'channel',
		maxResults: '1',
		key: apiKey,
	});
	const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
	const data = await resp.json();
	const channelId: string | undefined = data.items?.[0]?.snippet?.channelId;
	if (!channelId) return null;

	upsertChannel(channelId, handle, name, isTarget);
	return channelId;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Targeted search: entire cycle from target channels ---

export async function searchTargeted(cycle: string, apiKey: string): Promise<number> {
	const query = `classical conversations cycle ${cycle}`;
	let totalNew = 0;

	console.log(`\nTargeted search: "${query}" across target channels\n`);

	for (const [name, handle] of Object.entries(TARGET_CHANNELS)) {
		process.stdout.write(`  ${name}... `);

		const channelId = await resolveChannelId(handle, name, apiKey, true);
		if (!channelId) {
			console.log('(channel not found)');
			continue;
		}

		// Check if we already have videos from this channel for this cycle
		const existing = getVideoCount(channelId, cycle);
		if (existing > 0) {
			console.log(`(${existing} videos already in DB, searching for new...)`);
		}

		let pageToken: string | undefined;
		let channelNew = 0;
		let pages = 0;

		do {
			const result = await youtubeSearch(`cycle ${cycle}`, apiKey, {
				maxResults: 50,
				channelId,
				pageToken,
			});

			for (const item of result.items) {
				const title = decodeHTMLEntities(item.snippet.title);
				const week = extractWeek(title);
				const videoCycle = extractCycle(title) ?? cycle;
				const subject = classifySubject(title);

				upsertVideo({
					videoId: item.id.videoId,
					title,
					channelId: item.snippet.channelId,
					youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
					cycle: videoCycle,
					week,
					subject: subject !== 'Unknown' ? subject : null,
				});

				// Also ensure channel record exists (for non-target channels that appear)
				if (item.snippet.channelId !== channelId) {
					upsertChannel(item.snippet.channelId, '', item.snippet.channelTitle, false);
				}

				channelNew++;
			}

			pageToken = result.nextPageToken;
			pages++;

			if (pageToken) await sleep(200);
		} while (pageToken && pages < 5); // Cap at 5 pages (250 results) per channel

		console.log(`${channelNew} videos (${pages} page${pages > 1 ? 's' : ''})`);
		totalNew += channelNew;

		await sleep(200);
	}

	console.log(`\nTotal: ${totalNew} videos stored`);
	return totalNew;
}

// --- Broad search: global search for a specific week ---

export async function searchBroad(cycle: string, week: string, apiKey: string): Promise<number> {
	const query = `classical conversations cycle ${cycle} week ${week}`;
	console.log(`\nBroad search: "${query}" (sorted by views)\n`);

	const result = await youtubeSearch(query, apiKey, {
		maxResults: 50,
		order: 'viewCount',
	});

	let stored = 0;
	const weekNum = parseInt(week, 10);

	for (const item of result.items) {
		const title = decodeHTMLEntities(item.snippet.title);
		const extractedWeek = extractWeek(title);

		// Filter: only keep if title mentions the correct week
		if (extractedWeek && parseInt(extractedWeek, 10) !== weekNum) continue;

		upsertChannel(item.snippet.channelId, '', item.snippet.channelTitle, false);

		upsertVideo({
			videoId: item.id.videoId,
			title,
			channelId: item.snippet.channelId,
			youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
			cycle,
			week: extractedWeek ?? week,
			subject: classifySubject(title) !== 'Unknown' ? classifySubject(title) : null,
		});

		stored++;
	}

	console.log(`  Stored ${stored} videos (filtered from ${result.items.length} results)`);
	return stored;
}
