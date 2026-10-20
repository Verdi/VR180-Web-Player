import * as THREE from './three.js';
import { resolveFormat } from './formats.js';
import { createVideoScreen, disposeVideoScreen } from './video-screen.js';
import { VRPanel } from './vr-panel.js';
import { DomControls } from './dom-controls.js';
import { FlatMode } from './flat-mode.js';
import { XRMode, isXRSupported } from './xr-mode.js';
import { createSource } from './source.js';

const PLAY_ICON_URL = new URL('../images/play.png', import.meta.url).href;

const DEFAULT_OPTIONS = {
	projection: '180',
	stereo: 'sbs',
	skipSeconds: 15,
	hls: 'auto', // 'auto', 'native', or 'hls.js'. See createSource() in source.js.
	hlsQuality: 'auto', // The first HLS quality: 'auto', 'best' (the highest), or a height such as '2880'.
	debug: false, // Shows the video size and source type in the panel title.
	title: '',
};

// One player for one <video> element.
// When the viewer presses play, the player shows the video in VR if the device can, or in 2D if not.
export class VR180Player {
	constructor(video, options = {}) {
		if (!(video instanceof HTMLVideoElement)) {
			throw new TypeError('VR180Player needs a <video> element.');
		}
		if (video.vr180Player) return video.vr180Player;

		this.video = video;
		this.options = { ...DEFAULT_OPTIONS, ...options };
		this.format = resolveFormat(this.options);
		this.title = this.options.title || video.title || titleFromSource(video) || 'Video';
		this.container = findOrCreateContainer(video);
		this.listeners = new AbortController();
		this.videoListeners = null; // Listeners on the current <video>. See #listenToVideo().
		this.originalSrc = video.getAttribute('src'); // Before a source changes it.
		this.mode = null; // The FlatMode or XRMode showing the video, or null when the poster shows.
		this.xrSupported = null; // null until the browser answers.
		// Three.js objects are made on the first play, so a page with many players
		// does not use a WebGL context for each one.
		this.renderer = null;
		this.source = null; // Set when the video source is ready. See source.js.
		this.sourceError = null;
		this.quality = String(this.options.hlsQuality); // The viewer's choice. See setQuality().

		this.poster = this.#createPoster();
		this.playButton = this.#createPlayButton();
		this.controls = new DomControls(this.container, {
			title: this.title,
			onAction: (action, value) => this.runAction(action, value),
		});
		this.#listenToVideo();
		video.vr180Player = this;
		this.#createSource();

		isXRSupported().then((supported) => {
			this.xrSupported = supported;
			this.#updatePlayButton();
		});
	}

	play() {
		return this.video.play()
			.then(() => {
				if (this.mode === this.flatMode) this.controls.show();
			})
			.catch((err) => console.error('VR180Player: could not play video:', err));
	}

	togglePlay() {
		const { video } = this;
		if (!video.paused && !video.ended) {
			video.pause();
			return;
		}
		if (video.ended) video.currentTime = 0;
		this.play();
	}

	skip(seconds) {
		const { video } = this;
		const end = isFinite(video.duration) ? video.duration : Infinity;
		video.currentTime = THREE.MathUtils.clamp(video.currentTime + seconds, 0, end);
		this.syncUI();
	}

	seekToFraction(fraction) {
		const { video } = this;
		if (!isFinite(video.duration)) return;
		video.currentTime = THREE.MathUtils.clamp(fraction, 0, 1) * video.duration;
		this.syncUI();
	}

	toggleFullscreen() {
		const request = document.fullscreenElement
			? document.exitFullscreen()
			: this.container.requestFullscreen?.();
		request?.catch((err) => console.error('VR180Player: full screen failed:', err));
	}

	// The qualities the viewer can choose, highest first, as [{ id, label }]. Empty if there is no choice.
	get qualities() {
		return this.source?.qualities ?? [];
	}

	// Changes the HLS quality: 'auto', or an id from `qualities`. The video keeps its place.
	setQuality(id) {
		if (!this.source || id === this.source.quality) return;
		if (this.source.setQuality(id)) this.quality = id;
		this.syncUI();
	}

	// Goes to the next quality: Auto, then each quality from highest to lowest, then Auto again.
	nextQuality() {
		const ids = ['auto', ...this.qualities.map((q) => q.id)];
		const current = ids.indexOf(this.source?.quality ?? 'auto');
		this.setQuality(ids[(current + 1) % ids.length]);
	}

	// A short name for the current quality choice, or null if there is no choice.
	qualityLabel() {
		if (!this.qualities.length) return null;
		const quality = this.source.quality;
		return this.qualities.find((q) => q.id === quality)?.label ?? 'Auto';
	}

	// Runs a control action. The 2D controls and the VR panel both use this.
	runAction(action, value) {
		const skipSeconds = this.options.skipSeconds;
		switch (action) {
			case 'playPause': this.togglePlay(); break;
			case 'back': this.skip(-skipSeconds); break;
			case 'forward': this.skip(skipSeconds); break;
			case 'mute': this.video.muted = !this.video.muted; break;
			case 'seek': this.seekToFraction(value); break;
			case 'fullscreen': this.toggleFullscreen(); break;
			case 'exit': this.stop(); break;
			case 'quality': value === undefined ? this.nextQuality() : this.setQuality(value); break;
			default: console.warn(`VR180Player: unknown action "${action}".`);
		}
	}

	// Leaves VR or 2D mode and goes back to the poster.
	stop() {
		if (this.mode === this.xrMode) {
			this.xrMode.exit(); // The session end calls reset().
		} else {
			this.reset();
		}
	}

	// Goes back to the start state: poster frame and play button.
	reset() {
		if (this.mode === this.flatMode) this.flatMode.stop();
		this.mode = null;
		this.controls.hide();

		const { video } = this;
		video.pause();
		video.currentTime = 0;
		video.controls = false;
		this.showVideo();
		// Show the poster image again. The player does not reload the video for this, so the
		// stream stays loaded. (After a reload, Safari on Vision Pro restarted HLS in low quality.)
		this.poster?.classList.remove('hidden');
		this.source?.stopLoad();

		if (this.source?.needsNewVideoEachPlay) this.#replaceVideo();
		this.playButton.classList.remove('hidden');
		this.#updatePlayButton();
	}

	// While the video plays in VR or 2D, the <video> element is not shown. The canvas or headset shows it.
	hideVideo() {
		this.video.style.display = 'none';
	}

	showVideo() {
		this.video.style.display = '';
	}

	// The panel title in debug mode, for example "HLS player · 3840×1920 · native-hls (best, data) · 2x".
	debugTitle() {
		const { video } = this;
		const parts = [this.title, `${video.videoWidth}×${video.videoHeight}`, this.source?.kind ?? '?', `${window.devicePixelRatio}x`];
		return parts.join(' · ');
	}

	syncUI() {
		this.controls.setQualities(this.qualities, this.source?.quality ?? 'auto');
		this.vrPanel?.setQualityLabel(this.qualityLabel());
		this.controls.update(this.video);
		if (this.options.debug) this.controls.setTitle(this.debugTitle());
		this.vrPanel?.update(this.video);
	}

	// Removes the player and frees its WebGL resources. The <video> element stays.
	destroy() {
		if (this.mode) this.stop();
		this.listeners.abort();
		this.videoListeners.abort();
		this.controls.destroy();
		this.playButton.remove();
		this.poster?.remove();
		this.source?.destroy();
		if (this.renderer) {
			this.renderer.setAnimationLoop(null);
			this.texture.dispose();
			disposeVideoScreen(this.screen);
			this.vrPanel.dispose();
			this.renderer.dispose();
			this.renderer.domElement.remove();
			this.renderer = null;
		}
		delete this.video.vr180Player;
	}

	async #start() {
		this.playButton.classList.add('hidden');
		this.poster?.classList.add('hidden');
		this.#createScene();
		if (this.xrSupported) {
			this.mode = this.xrMode;
			await this.xrMode.enter();
		} else {
			this.mode = this.flatMode;
			this.flatMode.start();
		}
	}

	#createScene() {
		if (this.renderer) return;

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.xr.enabled = true;
		renderer.domElement.classList.add('vr180-canvas');
		renderer.domElement.style.display = 'none';
		renderer.domElement.addEventListener('webglcontextlost', (event) => {
			event.preventDefault();
			console.error('VR180Player: WebGL context lost.');
			this.stop();
		}, { signal: this.listeners.signal });
		this.video.after(renderer.domElement);
		this.renderer = renderer;

		this.texture = this.#createTexture();

		this.scene = new THREE.Scene();
		this.screen = createVideoScreen(this.format, this.texture);
		this.scene.add(this.screen);
		this.vrPanel = new VRPanel(this.title);
		this.scene.add(this.vrPanel.group);

		this.flatMode = new FlatMode(this);
		this.xrMode = new XRMode(this);
		this.syncUI();
	}

	// The poster image, shown over the video when it is not playing.
	// The <video> shows its own poster before the first play. This one is for after a play.
	#createPoster() {
		if (!this.video.poster) return null;
		const poster = document.createElement('img');
		poster.className = 'vr180-poster hidden';
		poster.src = this.video.poster;
		poster.alt = '';
		this.video.after(poster);
		return poster;
	}

	#createTexture() {
		const texture = new THREE.VideoTexture(this.video);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.colorSpace = THREE.SRGBColorSpace;
		return texture;
	}

	#createPlayButton() {
		const playButton = document.createElement('button');
		playButton.type = 'button';
		playButton.className = 'vr180-play';
		playButton.setAttribute('aria-label', 'Play video');
		playButton.disabled = true;
		const img = document.createElement('img');
		img.src = PLAY_ICON_URL;
		img.alt = '';
		playButton.append(img);
		playButton.addEventListener('click', () => this.#start(), { signal: this.listeners.signal });
		this.container.append(playButton);
		return playButton;
	}

	// The play button works when the browser has said if it can do VR, the source is ready,
	// and there is no error.
	#updatePlayButton() {
		this.playButton.disabled = this.xrSupported === null || !this.source
			|| Boolean(this.sourceError) || Boolean(this.video.error);
	}

	#createSource() {
		const { video } = this;
		this.source = null;
		this.sourceError = null;
		createSource(video, this.options.hls, { quality: this.quality })
			.then((source) => {
				if (video !== this.video) return source.destroy(); // The video was replaced.
				this.source = source;
				source.onFatalError = (err) => {
					this.sourceError = err;
					this.#updatePlayButton();
				};
				source.onQualitiesChanged = () => this.syncUI();
				this.syncUI();
			})
			.catch((err) => {
				console.error('VR180Player:', err);
				this.sourceError = err;
			})
			.finally(() => this.#updatePlayButton());
	}

	// Puts a new copy of the <video> in the page, with a new source. Safari's own HLS needs this:
	// on Vision Pro, a second play on the same element chose a low quality. A new element did not.
	// Only use it before a play that the viewer starts: Safari lets a new element play with sound
	// only after the viewer presses play.
	#replaceVideo() {
		const old = this.video;
		const fresh = old.cloneNode(true);
		if (this.originalSrc === null) fresh.removeAttribute('src');
		else fresh.setAttribute('src', this.originalSrc);
		fresh.style.display = '';
		fresh.muted = old.muted;
		fresh.volume = old.volume;

		this.source?.destroy();
		this.videoListeners.abort();
		delete old.vr180Player;
		old.replaceWith(fresh);
		old.removeAttribute('src');
		old.load(); // Frees the old stream.

		this.video = fresh;
		fresh.vr180Player = this;
		this.#listenToVideo();
		this.#createSource();
		if (this.texture) {
			this.texture.dispose();
			this.texture = this.#createTexture();
			this.screen.traverse((object) => {
				if (object.isMesh) object.material.map = this.texture;
			});
		}
		this.syncUI();
	}

	#listenToVideo() {
		const { video } = this;
		this.videoListeners = new AbortController();
		const options = { signal: this.videoListeners.signal };
		const syncUI = () => this.syncUI();
		for (const type of ['loadedmetadata', 'timeupdate', 'play', 'pause', 'volumechange']) {
			video.addEventListener(type, syncUI, options);
		}
		video.addEventListener('play', () => this.source?.startLoad(), options);
		// A new source clears an old error, so the play button can work again.
		video.addEventListener('emptied', () => this.#updatePlayButton(), options);
		video.addEventListener('ended', () => this.#onEnded(), options);
		video.addEventListener('error', () => {
			// The error can be from an old source that is already replaced (for example, by hls.js).
			if (!video.error) return;
			console.error('VR180Player: video error:', `code ${video.error.code}: ${video.error.message}`);
			this.#updatePlayButton();
		}, options);
	}

	#onEnded() {
		if (this.mode === this.xrMode) {
			this.xrMode.exit();
		} else if (this.mode === this.flatMode) {
			// Stay on the last frame, with the controls shown.
			this.controls.pin();
			this.syncUI();
		} else {
			this.reset();
		}
	}
}

// Uses the video's parent if it is a player container. If not, wraps the video in a new one.
function findOrCreateContainer(video) {
	const parent = video.parentElement;
	if (parent && (parent.id === 'vr-container' || parent.classList.contains('vr180-container'))) {
		parent.classList.add('vr180-container');
		return parent;
	}
	const wrapper = document.createElement('div');
	wrapper.className = 'vr180-container';
	video.before(wrapper);
	wrapper.append(video);
	return wrapper;
}

const GENERIC_FILE_NAMES = new Set(['master', 'main', 'index', 'playlist', 'manifest', 'stream', 'video']);

// Makes a title from the file name, for example "my-trip.mp4" becomes "my trip".
function titleFromSource(video) {
	const src = video.currentSrc || video.src || video.querySelector('source')?.src;
	if (!src) return '';
	const parts = new URL(src, document.baseURI).pathname.split('/').filter(Boolean);
	let name = (parts.pop() ?? '').replace(/\.[^.]+$/, '');
	// HLS files often have a general name, such as "master.m3u8". Then the folder name is better.
	if (GENERIC_FILE_NAMES.has(name.toLowerCase()) && parts.length) name = parts.pop();
	return decodeURIComponent(name).replace(/[-_]+/g, ' ');
}
