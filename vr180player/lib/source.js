// Where the video comes from: a normal file (such as MP4) or an HLS stream (.m3u8).
//
// HLS can play in two ways:
// - native: the browser streams the video itself. Safari does this well, so the player uses it there.
//   (In Safari on Vision Pro, hls.js stopped when it changed quality. Native HLS did not.)
//   Safari chooses the quality itself. On Vision Pro it chose a low quality when the same <video>
//   played a second time, so the player uses a new <video> for each play (needsNewVideoEachPlay).
//   To choose a quality, the player gives it a playlist with only that quality (hls-playlist.js).
// - hls.js: a script that streams the video into the page (Media Source Extensions).
//   The player uses it in all other browsers, such as Chrome and the Quest browser.
// hls.js is loaded from the CDN only when the player uses it.

import { loadPlaylist, qualitiesInPlaylist, qualitiesFromVariants, playlistWithOnlyHeight, playlistUrls } from './hls-playlist.js';

// hls.js is locked to one version, so a new hls.js release cannot break the player.
const HLS_JS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.mjs';
const HLS_TYPES = ['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'audio/mpegurl'];
const MAX_NETWORK_RETRIES = 3;
const MAX_MEDIA_RECOVERIES = 2;
const START_BANDWIDTH_ESTIMATE = 20_000_000; // bits per second

// Finds the HLS address in the <video src> or in a <source> element. Returns null for a normal file.
export function findHlsUrl(video) {
	const candidates = [
		{ url: video.getAttribute('src'), type: null },
		...[...video.querySelectorAll('source')].map((s) => ({ url: s.getAttribute('src'), type: s.getAttribute('type') })),
	];
	const match = candidates.find(({ url, type }) => url && isHls(url, type));
	return match ? new URL(match.url, document.baseURI).href : null;
}

function isHls(url, type) {
	return HLS_TYPES.includes(type?.toLowerCase()) || /\.m3u8($|[?#])/i.test(url);
}

// Safari on Mac, Vision Pro, iPhone, and iPad. (Chrome on iPhone is Safari inside, too.)
function isAppleBrowser() {
	return /^Apple/.test(navigator.vendor ?? '');
}

function hasMediaSource() {
	return Boolean(window.ManagedMediaSource || window.MediaSource);
}

// Makes the right source for a video.
// `hlsMode` picks how HLS plays. If the first way cannot work, the player tries the other one.
// - 'auto': native HLS in Safari, hls.js in other browsers.
// - 'native': native HLS first.
// - 'hls.js': hls.js first.
// `quality` is the quality to play: 'auto' (the player or browser chooses), 'best' (the highest),
// or the id of a quality (its height, for example '2880').
export async function createSource(video, hlsMode = 'auto', { quality = 'auto' } = {}) {
	const url = findHlsUrl(video);
	if (!url) return new FileSource(video);

	const tryNative = async () => {
		if (!video.canPlayType('application/vnd.apple.mpegurl')) return null;
		let playlist = null;
		try {
			playlist = await loadPlaylist(url);
		} catch (err) {
			console.warn('VR180Player: could not read the HLS playlist, so the browser chooses the quality:', err);
		}
		return new NativeHlsSource(video, url, playlist, quality);
	};
	const tryHlsJs = async () => {
		if (!hasMediaSource()) return null;
		try {
			const { default: Hls } = await import(HLS_JS_URL);
			return Hls.isSupported() ? new HlsJsSource(Hls, video, url, quality) : null;
		} catch (err) {
			console.error('VR180Player: could not load hls.js:', err);
			return null;
		}
	};

	const nativeFirst = hlsMode === 'native' || (hlsMode !== 'hls.js' && isAppleBrowser());
	const source = nativeFirst
		? (await tryNative()) ?? (await tryHlsJs())
		: (await tryHlsJs()) ?? (await tryNative());
	if (!source) throw new Error('This browser cannot play HLS streams.');
	return source;
}

// Every source has the same methods:
// - startLoad(): called when playback starts.
// - stopLoad(): called when the player goes back to the poster. The stream stays ready to play.
// - destroy(): stops all loading.
// - onFatalError: set by the player. Called when the video cannot play.
// - needsNewVideoEachPlay: true if the player must use a new <video> for each play.
// - qualities: the qualities to choose from, highest first, as [{ id, label }]. Empty if there is no choice.
// - quality: the chosen quality: 'auto' or an id from `qualities`.
// - onQualitiesChanged: set by the player. Called when `qualities` or `quality` changes.
// - setQuality(id): changes the quality and returns true. Returns false if there is no choice.
//   The video keeps its place, and plays on if it was playing.

// A normal video file. The browser does all the work.
class FileSource {
	constructor(video) {
		this.kind = 'file';
		this.video = video;
		this.onFatalError = null;
		this.needsNewVideoEachPlay = false;
		this.qualities = [];
		this.quality = 'auto';
		this.onQualitiesChanged = null;
	}

	setQuality() {
		return false;
	}

	startLoad() {}

	stopLoad() {}

	destroy() {}
}

// HLS played by the browser itself (Safari).
// For a fixed quality, it plays a playlist with only that quality. It tries each address for that
// playlist in turn (see playlistUrls()). If the browser refuses all of them, it plays the original.
// `playlist` is { text, baseUrl } from loadPlaylist(), or null if it could not be read.
class NativeHlsSource extends FileSource {
	constructor(video, url, playlist, quality) {
		super(video);
		this.needsNewVideoEachPlay = true;
		this.url = url;
		this.playlist = playlist;
		this.qualities = playlist ? qualitiesInPlaylist(playlist.text) : [];
		this.onError = () => this.#tryNext();
		this.#usePlaylistFor(quality);
		this.#tryNext(true);
	}

	// Changes the playlist on the same <video>. Safari lets this element play, because the viewer
	// started it. A new element would need a new tap before it can play with sound.
	setQuality(id) {
		if (!this.qualities.length) return false;
		const { video } = this;
		const time = video.currentTime;
		const play = !video.paused && !video.ended;
		// Load the new playlist now, also when paused, so the video can go back to `time`.
		video.preload = 'auto';
		this.#usePlaylistFor(id);
		video.addEventListener('loadedmetadata', () => {
			video.currentTime = time;
		}, { once: true });
		this.playRequested = play;
		this.#tryNext(true);
		if (play) video.play().catch((err) => console.error('VR180Player: could not play after the quality change:', err));
		this.onQualitiesChanged?.();
		return true;
	}

	// Sets the playlists to try for a quality: 'auto', 'best', or a quality id.
	#usePlaylistFor(quality) {
		const target = quality === 'best' ? this.qualities[0] : this.qualities.find((q) => q.id === quality);
		const rewritten = target && playlistWithOnlyHeight(this.playlist.text, this.playlist.baseUrl, target.height);
		this.fixedQuality = rewritten ? target : null;
		this.tries = [...(rewritten ? playlistUrls(rewritten) : []), { how: null, url: this.url }];
		this.video.removeEventListener('error', this.onError);
		if (rewritten) this.video.addEventListener('error', this.onError);
	}

	startLoad() {
		this.playRequested = true;
	}

	stopLoad() {
		this.playRequested = false;
	}

	destroy() {
		this.video.removeEventListener('error', this.onError);
	}

	#tryNext(first = false) {
		const next = this.tries.shift();
		if (!next) return;
		if (!first) console.warn('VR180Player: the browser refused the playlist. Trying the next one.');
		if (!next.how) this.video.removeEventListener('error', this.onError);
		this.quality = next.how ? this.fixedQuality.id : 'auto';
		this.kind = next.how ? `native-hls (${this.fixedQuality.label}, ${next.how})`
			: first ? 'native-hls' : 'native-hls (quality failed)';
		if (!first) this.onQualitiesChanged?.();
		if (this.video.getAttribute('src') === next.url) return;
		this.video.src = next.url;
		// The refused playlist also stopped playback. Start it again with the next playlist.
		if (!first && this.playRequested) {
			this.video.play().catch((err) => console.error('VR180Player: could not play video:', err));
		}
	}
}

// HLS played with hls.js.
class HlsJsSource {
	constructor(Hls, video, url, quality) {
		this.kind = 'hls.js';
		this.needsNewVideoEachPlay = false;
		this.Hls = Hls;
		this.video = video;
		this.url = url;
		this.onFatalError = null;
		this.qualities = []; // Known when hls.js has read the playlist.
		this.quality = 'auto';
		this.requestedQuality = quality;
		this.onQualitiesChanged = null;
		this.#create();
	}

	setQuality(id) {
		this.#applyQuality(id, false);
		this.onQualitiesChanged?.();
		return true;
	}

	// `starting`: true before the first piece loads.
	#applyQuality(id, starting) {
		const { hls } = this;
		const levels = hls.levels;
		const height = id === 'best' ? Math.max(...levels.map((l) => l.height)) : Number(id);
		// The level at that height with the highest bitrate. hls.js sorts levels from lowest to highest.
		const index = levels.findLastIndex((l) => l.height === height);
		if (id === 'auto' || index === -1) {
			this.quality = 'auto';
			// Start with the best quality. Low quality looks very bad in a headset.
			if (starting) hls.startLevel = levels.length - 1;
			else hls.currentLevel = -1; // Let hls.js choose again.
		} else {
			this.quality = String(height);
			if (starting) {
				hls.startLevel = index;
				hls.loadLevel = index; // A fixed level: hls.js does not change it.
			} else {
				hls.currentLevel = index; // Change now, and drop what was loaded in the old quality.
			}
		}
	}

	startLoad() {
		if (this.loadStarted) return;
		this.loadStarted = true;
		// The first time, hls.js picks the start (the live edge, for a live stream).
		// After stopLoad(), start where the video is.
		this.hls.startLoad(this.wasStopped ? this.video.currentTime : -1);
	}

	stopLoad() {
		this.loadStarted = false;
		this.wasStopped = true;
		this.hls.stopLoad();
	}

	destroy() {
		this.hls.destroy();
	}

	#create() {
		const { Hls, video } = this;
		// Like a normal video: load the stream only when it plays, unless the page asks for preload="auto".
		const autoStartLoad = video.getAttribute('preload') === 'auto';
		const hls = new Hls({
			autoStartLoad,
			// hls.js guesses a slow connection (0.5 Mbps) until it measures one. Immersive video
			// needs a fast one, so guess fast. hls.js moves down if the connection is slower.
			abrEwmaDefaultEstimate: START_BANDWIDTH_ESTIMATE,
			// hls.js skips any quality that the browser says is not "smooth". Browsers often say this
			// about large immersive video that they play well, so hls.js falls to the lowest quality.
			// Formats that the browser cannot play at all are still skipped.
			useMediaCapabilities: false,
		});
		this.hls = hls;
		hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
			this.qualities = qualitiesFromVariants(data.levels);
			this.#applyQuality(this.requestedQuality, true);
			this.onQualitiesChanged?.();
		});
		this.loadStarted = autoStartLoad;
		this.networkRetries = 0;
		this.mediaRecoveries = 0;
		hls.on(Hls.Events.FRAG_LOADED, () => {
			this.networkRetries = 0;
		});
		hls.on(Hls.Events.ERROR, (_event, data) => this.#onError(data));
		hls.loadSource(this.url);
		hls.attachMedia(video);
	}

	// Tries to recover from a stream error. If it cannot, tells the player.
	#onError(data) {
		if (!data.fatal) return;
		const { ErrorTypes } = this.Hls;
		const isManifestError = /^manifest/i.test(data.details ?? '');
		if (data.type === ErrorTypes.NETWORK_ERROR && !isManifestError && this.networkRetries < MAX_NETWORK_RETRIES) {
			this.networkRetries++;
			console.warn('VR180Player: HLS network error, trying again:', data.details);
			this.hls.startLoad();
		} else if (data.type === ErrorTypes.MEDIA_ERROR && this.mediaRecoveries < MAX_MEDIA_RECOVERIES) {
			this.mediaRecoveries++;
			console.warn('VR180Player: HLS media error, trying to recover:', data.details);
			this.hls.recoverMediaError();
		} else {
			console.error('VR180Player: HLS stream failed:', data.details, data);
			this.hls.destroy();
			this.onFatalError?.(new Error(`HLS stream failed: ${data.details}`));
		}
	}
}
