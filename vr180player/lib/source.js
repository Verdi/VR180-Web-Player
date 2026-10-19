// Where the video comes from: a normal file (such as MP4) or an HLS stream (.m3u8).
//
// HLS can play in two ways:
// - hls.js: a script that streams the video into the page (Media Source Extensions).
//   It works in Chrome, the Quest browser, and Safari, including on Vision Pro.
// - native: the browser streams the video itself. Only Apple browsers do this well.
// hls.js is loaded from the CDN only when a page has an HLS video.

// hls.js is locked to one version, so a new hls.js release cannot break the player.
const HLS_JS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.mjs';
const HLS_TYPES = ['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'audio/mpegurl'];
const MAX_NETWORK_RETRIES = 3;
const MAX_MEDIA_RECOVERIES = 2;

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

function hasMediaSource() {
	return Boolean(window.ManagedMediaSource || window.MediaSource);
}

// Makes the right source for a video.
// `hlsMode` is 'auto' (hls.js first, then native) or 'native' (native first, then hls.js).
export async function createSource(video, hlsMode = 'auto') {
	const url = findHlsUrl(video);
	if (!url) return new FileSource(video);

	const tryNative = () => (video.canPlayType('application/vnd.apple.mpegurl') ? new NativeHlsSource(video, url) : null);
	const tryHlsJs = async () => {
		if (!hasMediaSource()) return null;
		try {
			const { default: Hls } = await import(HLS_JS_URL);
			return Hls.isSupported() ? new HlsJsSource(Hls, video, url) : null;
		} catch (err) {
			console.error('VR180Player: could not load hls.js:', err);
			return null;
		}
	};

	const source = hlsMode === 'native'
		? tryNative() ?? (await tryHlsJs())
		: (await tryHlsJs()) ?? tryNative();
	if (!source) throw new Error('This browser cannot play HLS streams.');
	return source;
}

// Every source has the same methods:
// - startLoad(): called when playback starts.
// - reset(): goes back to the start and shows the poster again.
// - destroy(): stops all loading.
// - onFatalError: set by the player. Called when the video cannot play.

// A normal video file. The browser does all the work.
class FileSource {
	constructor(video) {
		this.kind = 'file';
		this.video = video;
		this.onFatalError = null;
	}

	startLoad() {}

	reset() {
		this.video.load();
	}

	destroy() {}
}

// HLS played by the browser itself (Safari).
class NativeHlsSource extends FileSource {
	constructor(video, url) {
		super(video);
		this.kind = 'native-hls';
		if (video.getAttribute('src') !== url) {
			video.src = url;
		}
	}
}

// HLS played with hls.js.
class HlsJsSource {
	constructor(Hls, video, url) {
		this.kind = 'hls.js';
		this.Hls = Hls;
		this.video = video;
		this.url = url;
		this.onFatalError = null;
		this.#create();
	}

	startLoad() {
		if (this.loadStarted) return;
		this.loadStarted = true;
		this.hls.startLoad();
	}

	// hls.js cannot go back to the poster, so the player makes a new one.
	reset() {
		this.hls.destroy();
		this.video.removeAttribute('src');
		this.video.load();
		this.#create();
	}

	destroy() {
		this.hls.destroy();
	}

	#create() {
		const { Hls, video } = this;
		// Like a normal video: load the stream only when it plays, unless the page asks for preload="auto".
		const autoStartLoad = video.getAttribute('preload') === 'auto';
		const hls = new Hls({ autoStartLoad });
		this.hls = hls;
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
