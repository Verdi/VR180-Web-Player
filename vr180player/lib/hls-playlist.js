// Reads an HLS multivariant playlist (the playlist that lists the qualities), and makes
// rewritten copies that list only one quality. The browser's own HLS (Safari) cannot be told
// which quality to play, but it plays only what the playlist lists.
// The idea comes from OpenImmersive (github.com/acuteimmersive/openimmersivelib), which filters
// the playlist the same way to choose a quality.

const STREAM_INF = '#EXT-X-STREAM-INF:';
const PLAYLIST_TYPE = 'application/vnd.apple.mpegurl';

// Each playlist is loaded once per page, so a quality change does not wait for the network.
const loaded = new Map();

// Loads a playlist. Returns { text, baseUrl }.
export function loadPlaylist(url) {
	if (!loaded.has(url)) {
		const request = fetch(url, { mode: 'cors', credentials: 'omit' }).then(async (response) => {
			if (!response.ok) throw new Error(`Could not load the playlist (HTTP ${response.status}).`);
			return { text: await response.text(), baseUrl: response.url || url };
		});
		request.catch(() => loaded.delete(url)); // Try again next time.
		loaded.set(url, request);
	}
	return loaded.get(url);
}

// Finds each variant (quality) in a multivariant playlist.
function parseVariants(lines) {
	const variants = [];
	for (let i = 0; i < lines.length; i++) {
		if (!lines[i].startsWith(STREAM_INF)) continue;
		const uriIndex = lines.findIndex((line, j) => j > i && line.trim() && !line.startsWith('#'));
		if (uriIndex === -1) break;
		const attributes = lines[i].slice(STREAM_INF.length);
		const [, width, height] = attributes.match(/RESOLUTION=(\d+)x(\d+)/) ?? [];
		const [, bandwidth] = attributes.match(/(?:^|,)BANDWIDTH=(\d+)/) ?? [];
		variants.push({
			infIndex: i,
			uriIndex,
			width: Number(width) || 0,
			height: Number(height) || 0,
			bandwidth: Number(bandwidth) || 0,
		});
	}
	return variants;
}

// A short name for a quality, from the width of the frame. For example 8192 is "8K".
export function qualityLabel(width, height) {
	if (width >= 1500) return `${Math.round(width / 1000)}K`;
	return `${height}p`;
}

// The qualities, one for each resolution, highest first, as [{ id, label, width, height }].
// The id is the height, as a string. `variants` is a list of { width, height }.
// Returns [] when there is only one resolution, because then there is nothing to choose.
export function qualitiesFromVariants(variants) {
	const byHeight = new Map();
	for (const { width, height } of variants) {
		if (height && !byHeight.has(height)) byHeight.set(height, { width, height });
	}
	const qualities = [...byHeight.values()]
		.sort((a, b) => b.height - a.height)
		.map(({ width, height }) => ({ id: String(height), label: qualityLabel(width, height), width, height }));
	// Two resolutions can get the same label. Then add the height, so the labels differ.
	for (const quality of qualities) {
		if (qualities.filter((q) => q.label === quality.label).length > 1) quality.label += ` (${quality.height}p)`;
	}
	return qualities.length > 1 ? qualities : [];
}

export function qualitiesInPlaylist(text) {
	return qualitiesFromVariants(parseVariants(text.split(/\r?\n/)));
}

// Returns the playlist with only the variants at `height`, or null if nothing changes.
export function playlistWithOnlyHeight(text, baseUrl, height) {
	const lines = text.split(/\r?\n/);
	const variants = parseVariants(lines);
	const keep = variants.filter((v) => v.height === height);
	if (!keep.length || keep.length === variants.length) return null;

	const removed = new Set();
	for (const variant of variants) {
		if (keep.includes(variant)) continue;
		removed.add(variant.infIndex);
		removed.add(variant.uriIndex);
	}

	// The new playlist gets a data: or blob: address, so every address in it must be absolute.
	const absolute = (uri) => new URL(uri, baseUrl).href;
	return lines
		.filter((_, index) => !removed.has(index))
		.map((line) => {
			if (line.trim() && !line.startsWith('#')) return absolute(line.trim());
			return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${absolute(uri)}"`);
		})
		.join('\n');
}

// Addresses for a rewritten playlist, as [{ how, url }]. Browsers accept different kinds of
// address. Safari on Vision Pro accepts data: and refuses blob:, so data: comes first.
export function playlistUrls(text) {
	return [
		{ how: 'data', url: `data:${PLAYLIST_TYPE},${encodeURIComponent(text)}` },
		{ how: 'blob', url: URL.createObjectURL(new Blob([text], { type: PLAYLIST_TYPE })) },
	];
}
