import * as THREE from './three.js';
import { LEFT_EYE_LAYER } from './video-screen.js';

const MOUSE_SENSITIVITY = 0.002;
const TOUCH_SENSITIVITY = 0.003;
const MOMENTUM_DAMPING = 0.8;
const MIN_VELOCITY = 0.001;
const ASPECT_RATIO = 16 / 9;
const MIN_WIDTH = 320;

// Shows the video as a normal 2D view on the web page.
// The viewer can drag the view to look around.
export class FlatMode {
	constructor(player) {
		this.player = player;
		this.camera = new THREE.PerspectiveCamera(75, ASPECT_RATIO, 0.1, 1000);
		// A stereo video shows only its left-eye picture in 2D.
		this.camera.layers.enable(LEFT_EYE_LAYER);
		this.rotation = { yaw: 0, pitch: 0 };
		this.velocity = { yaw: 0, pitch: 0 };
		this.drag = null;
		this.listeners = null;
		this.resizeObserver = null;
		this.render = this.render.bind(this);
	}

	start() {
		const { player } = this;
		const { renderer, video, container } = player;
		const canvas = renderer.domElement;

		this.rotation = { yaw: 0, pitch: 0 };
		this.velocity = { yaw: 0, pitch: 0 };
		this.drag = null;
		this.#resize();

		player.hideVideo();
		canvas.style.display = '';
		player.screen.visible = true;

		this.listeners = new AbortController();
		const options = { signal: this.listeners.signal };
		canvas.addEventListener('pointerdown', (e) => this.#onPointerDown(e), options);
		canvas.addEventListener('pointermove', (e) => this.#onPointerMove(e), options);
		canvas.addEventListener('pointerup', (e) => this.#onPointerUp(e), options);
		canvas.addEventListener('pointercancel', (e) => this.#onPointerUp(e), options);
		this.resizeObserver = new ResizeObserver(() => this.#resize());
		this.resizeObserver.observe(container);

		renderer.setAnimationLoop(this.render);
		player.play();
		player.controls.show();
	}

	stop() {
		const { renderer, screen } = this.player;
		renderer.setAnimationLoop(null);
		this.listeners?.abort();
		this.resizeObserver?.disconnect();
		renderer.domElement.style.display = 'none';
		screen.visible = false;
		this.drag = null;
	}

	render() {
		this.#updateCamera();
		this.player.renderer.render(this.player.scene, this.camera);
	}

	#updateCamera() {
		const { maxYaw, maxPitch } = this.player.format.projection;
		const { rotation, velocity } = this;
		rotation.yaw = THREE.MathUtils.clamp(rotation.yaw + velocity.yaw, -maxYaw, maxYaw);
		rotation.pitch = THREE.MathUtils.clamp(rotation.pitch + velocity.pitch, -maxPitch, maxPitch);
		velocity.yaw = Math.abs(velocity.yaw * MOMENTUM_DAMPING) < MIN_VELOCITY ? 0 : velocity.yaw * MOMENTUM_DAMPING;
		velocity.pitch = Math.abs(velocity.pitch * MOMENTUM_DAMPING) < MIN_VELOCITY ? 0 : velocity.pitch * MOMENTUM_DAMPING;
		this.camera.rotation.set(rotation.pitch, rotation.yaw, 0);
	}

	// The canvas keeps a 16:9 shape and fills the width of the container.
	#resize() {
		const width = Math.max(this.player.container.clientWidth, MIN_WIDTH);
		this.player.renderer.setSize(width, width / ASPECT_RATIO, false);
	}

	#onPointerDown(event) {
		if (this.drag || !event.isPrimary) return;
		this.drag = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			sensitivity: event.pointerType === 'touch' ? TOUCH_SENSITIVITY : MOUSE_SENSITIVITY,
		};
		// Keep getting moves when the pointer leaves the canvas during a drag.
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// The pointer is already gone. The drag still works inside the canvas.
		}
		this.velocity = { yaw: 0, pitch: 0 };
		this.player.controls.hide();
	}

	#onPointerMove(event) {
		if (!this.drag) {
			if (event.pointerType === 'mouse') this.player.controls.show();
			return;
		}
		if (event.pointerId !== this.drag.id) return;
		this.velocity.yaw = (event.clientX - this.drag.x) * this.drag.sensitivity;
		this.velocity.pitch = (event.clientY - this.drag.y) * this.drag.sensitivity;
		this.drag.x = event.clientX;
		this.drag.y = event.clientY;
	}

	#onPointerUp(event) {
		if (!this.drag || event.pointerId !== this.drag.id) return;
		this.drag = null;
		this.player.controls.show();
	}
}
