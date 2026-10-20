import * as THREE from './three.js';
import { FrameWatcher } from './frame-watcher.js';
import { DebugLabel } from './debug-label.js';

const DEBUG_LABEL_INTERVAL_MS = 500;

let supportCheck;

// Asks the browser once per page if it can show immersive VR.
export function isXRSupported() {
	supportCheck ??= navigator.xr
		? navigator.xr.isSessionSupported('immersive-vr').catch((err) => {
			console.error('VR180Player: VR support check failed:', err);
			return false;
		})
		: Promise.resolve(false);
	return supportCheck;
}

// Shows the video in a VR headset (Apple Vision Pro, Meta Quest).
export class XRMode {
	constructor(player) {
		this.player = player;
		this.session = null;
		this.lastFrameTime = 0;
		// Three.js replaces this camera with the headset's eye cameras while in VR.
		this.camera = new THREE.PerspectiveCamera();
		this.raycaster = new THREE.Raycaster();
		this.raycaster.near = 0.1;
		this.raycaster.far = 5;
		this.controllersReady = false;
		this.frames = new FrameWatcher();
		this.debugLabel = null; // Made when VR starts with data-debug.
		this.lastDebugUpdate = 0;
		this.render = this.render.bind(this);
		this.onSessionEnd = this.onSessionEnd.bind(this);
	}

	async enter() {
		const { player } = this;
		const { renderer, video } = player;
		try {
			// This must be the first await, so the browser still sees the user's click.
			const session = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] });
			this.session = session;
			session.addEventListener('end', this.onSessionEnd);

			player.hideVideo();
			if (video.paused || video.ended) {
				await video.play().catch((err) => console.error('VR180Player: could not play video in VR:', err));
			}

			this.#setUpControllers();
			if (player.options.debug && !this.debugLabel) {
				this.debugLabel = new DebugLabel();
				player.scene.add(this.debugLabel.mesh);
			}
			player.screen.visible = true;
			player.vrPanel.reset();
			player.syncUI();

			await renderer.xr.setSession(session);
			this.lastFrameTime = 0;
			renderer.setAnimationLoop(this.render);
		} catch (err) {
			console.error('VR180Player: could not start VR:', err);
			if (this.session) {
				this.session.end().catch(() => this.onSessionEnd());
			} else {
				player.reset();
			}
		}
	}

	exit() {
		if (!this.session) return;
		this.player.vrPanel.reset();
		this.session.end().catch((err) => {
			console.error('VR180Player: could not end VR session:', err);
			this.onSessionEnd();
		});
	}

	// Runs when the session ends for any reason: the exit button, the headset menu, or an error.
	onSessionEnd() {
		const { session, player } = this;
		if (!session) return;
		this.session = null;
		session.removeEventListener('end', this.onSessionEnd);
		player.renderer.setAnimationLoop(null);
		this.frames.stop();
		player.screen.visible = false;
		player.vrPanel.reset();
		player.reset();
	}

	render(time, frame) {
		if (!frame) return;
		const { player } = this;
		const { video } = player;

		const deltaMs = this.lastFrameTime ? time - this.lastFrameTime : 0;
		this.lastFrameTime = time;
		player.vrPanel.tick(deltaMs);
		if (player.options.debug) player.vrPanel.setTitle(player.debugTitle());

		// Copy the picture to the GPU when the video has a new frame (see frame-watcher.js).
		// Before, the player copied it on every headset frame, and the Quest sometimes showed a
		// flicker in the left eye, which is drawn first.
		this.frames.watch(video);
		if (this.frames.shouldCopy(time)) player.texture.needsUpdate = true;
		// Test option copyEveryFrame: the old way, to compare.
		if (player.options.copyEveryFrame && !video.paused && !video.ended) player.texture.needsUpdate = true;

		if (this.debugLabel && time - this.lastDebugUpdate > DEBUG_LABEL_INTERVAL_MS) {
			this.lastDebugUpdate = time;
			this.debugLabel.setText(player.debugStatus(this.frames.perSecond));
		}

		try {
			player.renderer.render(player.scene, this.camera);
		} catch (err) {
			console.error('VR180Player: render error, leaving VR:', err);
			player.renderer.setAnimationLoop(null);
			this.exit();
		}
	}

	#setUpControllers() {
		if (this.controllersReady) return;
		this.controllersReady = true;
		const { renderer, scene } = this.player;
		const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)]);
		const rayMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
		for (const index of [0, 1]) {
			const controller = renderer.xr.getController(index);
			controller.addEventListener('selectstart', () => this.#onSelect(controller));
			controller.add(new THREE.Line(rayGeometry, rayMaterial));
			scene.add(controller);
		}
	}

	#onSelect(controller) {
		const panel = this.player.vrPanel;
		// When the panel is hidden, any tap shows it. A tap never presses a hidden button.
		if (!panel.isShown) {
			panel.show();
			return;
		}

		// Three.js has the new pose, but has not applied it to matrixWorld yet. On Vision Pro the
		// pointer only exists during the pinch, so without this the ray uses the previous pinch.
		controller.updateMatrixWorld(true);
		this.raycaster.setFromXRController(controller);
		const hit = this.raycaster.intersectObjects(panel.interactables, false)[0];
		const action = hit?.object.userData.action;
		if (!action || action === 'background') {
			panel.hide();
			return;
		}

		const value = action === 'seek' ? panel.seekFractionAt(hit.point) : undefined;
		this.player.runAction(action, value);
		if (action !== 'exit') panel.show();
	}
}
