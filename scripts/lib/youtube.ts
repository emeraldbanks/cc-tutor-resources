import { upsertChannel, getCachedChannelId, upsertVideo, getVideoCount, updateDescription, getVideoIdsMissingDescriptions } from './db.js';
import { classifySubject, extractWeeks, extractCycle, decodeHTMLEntities, isNotRelevant } from './classify.js';

// --- Types ---

interface YouTubeSearchItem {
	id: { videoId: string };
	snippet: {
		title: string;
		description?: string;
		channelTitle: string;
		channelId: string;
	};
}

interface YouTubeSearchResponse {
	items?: YouTubeSearchItem[];
	nextPageToken?: string;
	error?: { message: string };
}

interface YouTubePlaylistItem {
	snippet: {
		title: string;
		resourceId: { videoId: string };
		videoOwnerChannelId: string;
		videoOwnerChannelTitle: string;
	};
}

interface YouTubePlaylistsResponse {
	items?: { id: string; snippet: { title: string } }[];
	nextPageToken?: string;
	error?: { message: string };
}

interface YouTubePlaylistItemsResponse {
	items?: YouTubePlaylistItem[];
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
    'Driven By Grace': '@driven-by-grace',
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
				const weeks = extractWeeks(title);
				const videoCycle = extractCycle(title) ?? cycle;
				const subject = classifySubject(title);
				const subjectVal = subject !== 'Unknown' ? subject : null;

				if (weeks.length === 0) {
					upsertVideo({
						videoId: item.id.videoId,
						title,
						channelId: item.snippet.channelId,
						youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
						cycle: videoCycle,
						week: null,
						subject: subjectVal,
					});
				} else {
					for (const week of weeks) {
						upsertVideo({
							videoId: item.id.videoId,
							title,
							channelId: item.snippet.channelId,
							youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
							cycle: videoCycle,
							week,
							subject: subjectVal,
						});
					}
				}

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
		const extractedWeeks = extractWeeks(title);

		// Use the cycle from the title if present; skip videos for a different cycle
		const videoCycle = extractCycle(title) ?? cycle;
		if (videoCycle !== cycle) continue;

		const subject = classifySubject(title);
		const subjectVal = subject !== 'Unknown' ? subject : null;

		upsertChannel(item.snippet.channelId, '', item.snippet.channelTitle, false);

		if (extractedWeeks.length === 0) {
			upsertVideo({
				videoId: item.id.videoId,
				title,
				channelId: item.snippet.channelId,
				youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
				cycle: videoCycle,
				week,
				subject: subjectVal,
			});
			stored++;
		} else {
			// Filter: only keep if at least one extracted week matches the search week
			if (!extractedWeeks.some((w) => parseInt(w, 10) === weekNum)) continue;

			for (const w of extractedWeeks) {
				upsertVideo({
					videoId: item.id.videoId,
					title,
					channelId: item.snippet.channelId,
					youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
					cycle: videoCycle,
					week: w,
					subject: subjectVal,
				});
			}
			stored++;
		}
	}

	console.log(`  Stored ${stored} videos (filtered from ${result.items.length} results)`);
	return stored;
}

// --- Fetch full descriptions via videos.list API ---

export async function fetchDescriptions(cycle: string, apiKey: string): Promise<number> {
	const videoIds = getVideoIdsMissingDescriptions(cycle);
	if (videoIds.length === 0) {
		console.log('\nAll videos already have full descriptions.');
		return 0;
	}

	console.log(`\nFetching full descriptions for ${videoIds.length} videos...`);
	let updated = 0;

	for (let i = 0; i < videoIds.length; i += 50) {
		const batch = videoIds.slice(i, i + 50);
		const params = new URLSearchParams({
			part: 'snippet',
			id: batch.join(','),
			key: apiKey,
		});

		const resp = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
		const data = await resp.json();

		if (data.error) {
			console.error(`YouTube API error: ${data.error.message}`);
			break;
		}

		for (const item of data.items ?? []) {
			const description: string = item.snippet?.description ?? '';
			if (description) {
				updateDescription(item.id, description);
				updated++;
			}
		}

		process.stdout.write(`  ${Math.min(i + 50, videoIds.length)}/${videoIds.length}\n`);
		if (i + 50 < videoIds.length) await sleep(200);
	}

	console.log(`Updated ${updated} descriptions.`);
	return updated;
}

// --- Fetch all videos from channel playlists ---

export async function fetchPlaylists(cycle: string, apiKey: string, channelFilter?: string): Promise<number> {
	const channels: [string, string][] = channelFilter
		? Object.entries(TARGET_CHANNELS).filter(([, handle]) => handle === channelFilter)
		: Object.entries(TARGET_CHANNELS);

	if (channels.length === 0 && channelFilter) {
		// channelFilter might be a handle not in TARGET_CHANNELS — use it directly
		channels.push([channelFilter, channelFilter]);
	}

	let totalNew = 0;

	console.log(`\nPlaylist ingest for Cycle ${cycle}\n`);

	for (const [name, handle] of channels) {
		process.stdout.write(`  ${name}... `);

		const channelId = await resolveChannelId(handle, name, apiKey, handle in Object.values(TARGET_CHANNELS));
		if (!channelId) {
			console.log('(channel not found)');
			continue;
		}

		// Fetch all playlists for this channel
		let playlistPageToken: string | undefined;
		let playlists: { id: string; title: string }[] = [];

		do {
			const params = new URLSearchParams({
				part: 'snippet',
				channelId,
				maxResults: '50',
				key: apiKey,
			});
			if (playlistPageToken) params.set('pageToken', playlistPageToken);

			const resp = await fetch(`https://www.googleapis.com/youtube/v3/playlists?${params}`);
			const data: YouTubePlaylistsResponse = await resp.json();

			if (data.error) {
				console.error(`YouTube API error: ${data.error.message}`);
				break;
			}

			for (const item of data.items ?? []) {
				playlists.push({ id: item.id, title: item.snippet.title });
			}

			playlistPageToken = data.nextPageToken;
			if (playlistPageToken) await sleep(200);
		} while (playlistPageToken);

		console.log(`${playlists.length} playlists found`);

		let channelNew = 0;

		for (const playlist of playlists) {
			process.stdout.write(`    "${playlist.title}"... `);
			let itemPageToken: string | undefined;
			let playlistVideos = 0;

			do {
				const params = new URLSearchParams({
					part: 'snippet',
					playlistId: playlist.id,
					maxResults: '50',
					key: apiKey,
				});
				if (itemPageToken) params.set('pageToken', itemPageToken);

				const resp = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);
				const data: YouTubePlaylistItemsResponse = await resp.json();

				if (data.error) {
					console.error(`API error: ${data.error.message}`);
					break;
				}

				for (const item of data.items ?? []) {
					const title = decodeHTMLEntities(item.snippet.title);
					const videoId = item.snippet.resourceId.videoId;
					const ownerChannelId = item.snippet.videoOwnerChannelId;
					const ownerChannelTitle = item.snippet.videoOwnerChannelTitle ?? name;

					// Skip deleted/private videos with no channel info
					if (!ownerChannelId || !videoId) continue;

					const weeks = extractWeeks(title);
					const videoCycle = extractCycle(title) ?? cycle;
					const subject = classifySubject(title);
					const subjectVal = subject !== 'Unknown' ? subject : null;

					upsertChannel(ownerChannelId, '', ownerChannelTitle, ownerChannelId === channelId);

					if (weeks.length === 0) {
						upsertVideo({
							videoId,
							title,
							channelId: ownerChannelId,
							youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
							cycle: videoCycle,
							week: null,
							subject: subjectVal,
						});
					} else {
						for (const week of weeks) {
							upsertVideo({
								videoId,
								title,
								channelId: ownerChannelId,
								youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
								cycle: videoCycle,
								week,
								subject: subjectVal,
							});
						}
					}

					playlistVideos++;
				}

				itemPageToken = data.nextPageToken;
				if (itemPageToken) await sleep(200);
			} while (itemPageToken);

			console.log(`${playlistVideos} videos`);
			channelNew += playlistVideos;
		}

		totalNew += channelNew;
		console.log(`  ${name} total: ${channelNew} videos\n`);
		await sleep(200);
	}

	console.log(`\nTotal: ${totalNew} videos stored from playlists`);
	return totalNew;
}
