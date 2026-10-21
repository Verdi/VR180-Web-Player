import * as THREE from './three.js';
import { LEFT_EYE_LAYER } from './video-screen.js';
import { MotionControl, requestMotionPermission, inOtherSiteFrame } from './motion.js';

const MOUSE_SENSITIVITY = 0.002;
const TOUCH_SENSITIVITY = 0.003;
const MOMENTUM_DAMPING = 0.8;
const MIN_VELOCITY = 0.001;
const ASPECT_RATIO = 16 / 9; // Outside full screen.
const MIN_WIDTH = 320;
// A touch that moves less than this, and ends within TAP_MAX_MS, is a tap, not a drag.
const TAP_MAX_MOVE_PX = 10;
const TAP_MAX_MS = 500;

// Moves a drag angle by `step`. The total (drag + device angle) must stay within ±limit, so the
// drag stops at the edge of the video. But the device angle never moves the drag: when the device
// turns past the edge and back, the view comes back to the same place.
function dragWithin(drag, step, device, limit) {
	const next = drag + step;
	if (Math.abs(next + device) <= limit) return next;
	const nowOutside = Math.abs(drag + device) > limit;
	if (nowOutside) return Math.abs(next + device) < Math.abs(drag + device) ? next : drag;
	return Math.sign(next + device) * limit - device; // Stop at the edge.
}

// Shows the video as a normal 2D view on the web page.
// The viewer can drag the view to look around, and on a phone also turn the phone (motion control).
export class FlatMode {
	constructor(player) {
		this.player = player;
		this.camera = new THREE.PerspectiveCamera(75, ASPECT_RATIO, 0.1, 1000);
		// A stereo video shows only its left-eye picture in 2D.
		this.camera.layers.enable(LEFT_EYE_LAYER);
		this.camera.rotation.order = 'YXZ'; // Turn side to side first, then up and down, as a head does.
		this.motion = new MotionControl();
		this.motion.onStop = () => this.player.syncUI();
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
		player.flatScreen.visible = true;

		this.listeners = new AbortController();
		const options = { signal: this.listeners.signal };
		canvas.addEventListener('pointerdown', (e) => this.#onPointerDown(e), options);
		canvas.addEventListener('pointermove', (e) => this.#onPointerMove(e), options);
		canvas.addEventListener('pointerup', (e) => this.#onPointerUp(e), options);
		canvas.addEventListener('pointercancel', (e) => this.#onPointerCancel(e), options);
		this.resizeObserver = new ResizeObserver(() => this.#resize());
		this.resizeObserver.observe(container);

		renderer.setAnimationLoop(this.render);
		player.play();
		player.controls.show();
	}

	stop() {
		const { renderer, flatScreen } = this.player;
		renderer.setAnimationLoop(null);
		this.listeners?.abort();
		this.resizeObserver?.disconnect();
		this.motion.stop();
		renderer.domElement.style.display = 'none';
		flatScreen.visible = false;
		this.drag = null;
	}

	render() {
		const { player } = this;
		this.#updateCamera();
		// Three.js updates the picture when the browser says that a new video frame is ready.
		// In Safari on Mac, that stopped after an HLS quality change (the picture froze, the sound
		// played on). So update the picture on every frame while the video plays, as in VR.
		if (!player.video.paused && !player.video.ended) player.texture.needsUpdate = true;
		player.renderer.render(player.scene, this.camera);
	}

	// Turns motion control on or off. Returns true if it is on. Call it during a tap: Safari on
	// iPhone asks for permission to read the motion sensor, and only allows that during a tap.
	async toggleMotion() {
		if (this.motion.enabled) {
			this.motion.stop();
			return false;
		}
		if (inOtherSiteFrame()) {
			this.motion.startFromPage(); // The page around the iframe asks for permission.
			return true;
		}
		if (!(await requestMotionPermission())) return false;
		this.motion.start();
		return true;
	}

	// How far the view can turn, so that the edge of the view stays inside the video.
	#limits() {
		const { horizontalExtent, verticalExtent } = this.player.format.projection;
		const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
		const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
		return {
			yaw: Math.max(0, (horizontalExtent - horizontalFov) / 2),
			pitch: Math.max(0, (verticalExtent - verticalFov) / 2),
		};
	}

	// The view direction is the drag direction plus the device direction (with motion control).
	#updateCamera() {
		const limits = this.#limits();
		const device = this.motion.enabled ? this.motion.read() : null;
		const deviceYaw = device?.yaw ?? 0;
		const devicePitch = device?.pitch ?? 0;
		const { rotation, velocity } = this;
		rotation.yaw = dragWithin(rotation.yaw, velocity.yaw, deviceYaw, limits.yaw);
		rotation.pitch = dragWithin(rotation.pitch, velocity.pitch, devicePitch, limits.pitch);
		velocity.yaw = Math.abs(velocity.yaw * MOMENTUM_DAMPING) < MIN_VELOCITY ? 0 : velocity.yaw * MOMENTUM_DAMPING;
		velocity.pitch = Math.abs(velocity.pitch * MOMENTUM_DAMPING) < MIN_VELOCITY ? 0 : velocity.pitch * MOMENTUM_DAMPING;
		const yaw = THREE.MathUtils.clamp(rotation.yaw + deviceYaw, -limits.yaw, limits.yaw);
		const pitch = THREE.MathUtils.clamp(rotation.pitch + devicePitch, -limits.pitch, limits.pitch);
		this.camera.rotation.set(pitch, yaw, device?.roll ?? 0);
	}

	// On the page, the canvas has a 16:9 shape and fills the width of the container.
	// In full screen, it fills the whole screen, at any shape.
	#resize() {
		const { container, renderer } = this.player;
		let width = Math.max(container.clientWidth, MIN_WIDTH);
		let height = width / ASPECT_RATIO;
		if (this.player.isFullscreen && container.clientHeight > 0) {
			width = container.clientWidth;
			height = container.clientHeight;
		}
		renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}

	// A pointer that goes down on the view is a tap or a drag. It is a tap until it moves more than
	// TAP_MAX_MOVE_PX. A tap shows or hides the controls. A drag turns the view, and never shows the
	// controls: on a phone, the controls coming up after each drag were in the way.
	#onPointerDown(event) {
		if (this.drag || !event.isPrimary) return;
		this.drag = {
			id: event.pointerId,
			type: event.pointerType,
			startX: event.clientX,
			startY: event.clientY,
			startTime: performance.now(),
			moved: false,
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
	}

	#onPointerMove(event) {
		if (!this.drag) {
			if (event.pointerType === 'mouse') this.player.controls.show();
			return;
		}
		if (event.pointerId !== this.drag.id) return;
		const { drag } = this;
		if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > TAP_MAX_MOVE_PX) {
			drag.moved = true;
			this.player.controls.hide();
		}
		this.velocity.yaw = (event.clientX - this.drag.x) * this.drag.sensitivity;
		this.velocity.pitch = (event.clientY - this.drag.y) * this.drag.sensitivity;
		this.drag.x = event.clientX;
		this.drag.y = event.clientY;
	}

	#onPointerUp(event) {
		const { drag } = this;
		if (!drag || event.pointerId !== drag.id) return;
		this.drag = null;
		const isTap = !drag.moved && performance.now() - drag.startTime < TAP_MAX_MS;
		if (!isTap) return;
		// A mouse shows the controls when it moves, so a click only shows them too.
		if (drag.type === 'mouse') this.player.controls.show();
		else this.player.controls.toggle();
	}

	// The browser took the pointer, for example for a page scroll or a system gesture.
	#onPointerCancel(event) {
		if (this.drag && event.pointerId === this.drag.id) this.drag = null;
	}
}
