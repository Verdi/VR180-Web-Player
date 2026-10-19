import * as THREE from './three.js';
import { resolveFormat } from './formats.js';
import { createVideoScreen, disposeVideoScreen } from './video-screen.js';
import { VRPanel } from './vr-panel.js';
import { DomControls } from './dom-controls.js';
import { FlatMode } from './flat-mode.js';
import { XRMode, isXRSupported } from './xr-mode.js';

const PLAY_ICON_URL = new URL('../images/play.png', import.meta.url).href;

const DEFAULT_OPTIONS = {
	projection: '180',
	stereo: 'sbs',
	skipSeconds: 15,
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
		this.mode = null; // The FlatMode or XRMode showing the video, or null when the poster shows.
		this.xrSupported = null; // null until the browser answers.
		// Three.js objects are made on the first play, so a page with many players
		// does not use a WebGL context for each one.
		this.renderer = null;

		this.playButton = this.#createPlayButton();
		this.controls = new DomControls(this.container, {
			title: this.title,
			onAction: (action, value) => this.runAction(action, value),
		});
		this.#listenToVideo();
		video.vr180Player = this;

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
		video.style.display = '';
		video.load(); // Shows the poster frame again.

		this.playButton.classList.remove('hidden');
		this.#updatePlayButton();
	}

	syncUI() {
		this.controls.update(this.video);
		this.vrPanel?.update(this.video);
	}

	// Removes the player and frees its WebGL resources. The <video> element stays.
	destroy() {
		if (this.mode) this.stop();
		this.listeners.abort();
		this.controls.destroy();
		this.playButton.remove();
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

		this.texture = new THREE.VideoTexture(this.video);
		this.texture.minFilter = THREE.LinearFilter;
		this.texture.magFilter = THREE.LinearFilter;
		this.texture.colorSpace = THREE.SRGBColorSpace;

		this.scene = new THREE.Scene();
		this.screen = createVideoScreen(this.format, this.texture);
		this.scene.add(this.screen);
		this.vrPanel = new VRPanel(this.title);
		this.scene.add(this.vrPanel.group);

		this.flatMode = new FlatMode(this);
		this.xrMode = new XRMode(this);
		this.syncUI();
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

	// The play button works after the browser says if it can do VR, and while the video has no error.
	#updatePlayButton() {
		this.playButton.disabled = this.xrSupported === null || Boolean(this.video.error);
	}

	#listenToVideo() {
		const { video } = this;
		const options = { signal: this.listeners.signal };
		const syncUI = () => this.syncUI();
		for (const type of ['loadedmetadata', 'timeupdate', 'play', 'pause', 'volumechange']) {
			video.addEventListener(type, syncUI, options);
		}
		video.addEventListener('ended', () => this.#onEnded(), options);
		video.addEventListener('error', () => {
			const error = video.error;
			console.error('VR180Player: video error:', error ? `code ${error.code}: ${error.message}` : 'unknown');
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

// Makes a title from the file name, for example "my-trip.mp4" becomes "my trip".
function titleFromSource(video) {
	const src = video.currentSrc || video.src || video.querySelector('source')?.src;
	if (!src) return '';
	const fileName = new URL(src, document.baseURI).pathname.split('/').pop() ?? '';
	return decodeURIComponent(fileName.replace(/\.[^.]+$/, '')).replace(/[-_]+/g, ' ');
}
