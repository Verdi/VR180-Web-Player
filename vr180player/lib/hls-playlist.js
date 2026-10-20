// Rewrites an HLS multivariant playlist (the playlist that lists the qualities),
// so a browser that plays HLS itself (Safari) cannot choose a lower quality.
// The idea comes from OpenImmersive (github.com/acuteimmersive/openimmersivelib), which filters
// the playlist the same way to choose a quality.

const STREAM_INF = '#EXT-X-STREAM-INF:';

const PLAYLIST_TYPE = 'application/vnd.apple.mpegurl';

// Returns addresses for a playlist that has only the highest resolution in `url`, as
// [{ how, url }]. Browsers accept different kinds of address, so there is a blob: one and a data: one.
// Returns [] if there is nothing to remove (one quality, or not a multivariant playlist).
export async function bestQualityPlaylistUrls(url) {
	const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
	if (!response.ok) throw new Error(`Could not load the playlist (HTTP ${response.status}).`);
	const rewritten = keepBestQuality(await response.text(), response.url || url);
	if (!rewritten) return [];
	return [
		{ how: 'blob', url: URL.createObjectURL(new Blob([rewritten], { type: PLAYLIST_TYPE })) },
		{ how: 'data', url: `data:${PLAYLIST_TYPE},${encodeURIComponent(rewritten)}` },
	];
}

// Returns the playlist with only the variants at the highest resolution (or, with no
// resolutions, the highest bandwidth). Returns null when there is nothing to remove.
export function keepBestQuality(text, baseUrl) {
	const lines = text.split(/\r?\n/);
	const variants = [];
	for (let i = 0; i < lines.length; i++) {
		if (!lines[i].startsWith(STREAM_INF)) continue;
		const uriIndex = lines.findIndex((line, j) => j > i && line.trim() && !line.startsWith('#'));
		if (uriIndex === -1) break;
		const attributes = lines[i].slice(STREAM_INF.length);
		const [, , height] = attributes.match(/RESOLUTION=(\d+)x(\d+)/) ?? [];
		const [, bandwidth] = attributes.match(/(?:^|,)BANDWIDTH=(\d+)/) ?? [];
		variants.push({ infIndex: i, uriIndex, height: Number(height) || 0, bandwidth: Number(bandwidth) || 0 });
	}
	if (variants.length < 2) return null;

	const bestHeight = Math.max(...variants.map((v) => v.height));
	const keep = bestHeight > 0
		? variants.filter((v) => v.height === bestHeight)
		: variants.filter((v) => v.bandwidth === Math.max(...variants.map((x) => x.bandwidth)));
	if (keep.length === variants.length) return null;

	const removed = new Set();
	for (const variant of variants) {
		if (keep.includes(variant)) continue;
		removed.add(variant.infIndex);
		removed.add(variant.uriIndex);
	}

	// The new playlist is a data: address, so every address in it must be absolute.
	const absolute = (uri) => new URL(uri, baseUrl).href;
	return lines
		.filter((_, index) => !removed.has(index))
		.map((line) => {
			if (line.trim() && !line.startsWith('#')) return absolute(line.trim());
			return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${absolute(uri)}"`);
		})
		.join('\n');
}
