import * as THREE from './three.js';

// Motion control for 2D on phones and tablets: the viewer looks around by turning the device,
// as if the screen were a window into the video.
//
// In an iframe from another website, Safari does not give the motion sensor to the player. Then the
// player asks the page around the iframe for the readings (see vr180-embed.js on that page).

const DEGREES = Math.PI / 180;
// Messages with vr180-embed.js on the page around an iframe.
const MOTION_MESSAGE = 'vr180-motion'; // To the page: { on }.
const MOTION_STATE_MESSAGE = 'vr180-motion-state'; // From the page: { on: true, false, or 'asking' }.
const ORIENTATION_MESSAGE = 'vr180-orientation'; // From the page: { alpha, beta, gamma, angle }.
// If the page does not answer in this time, it does not have vr180-embed.js.
const PAGE_ANSWER_MS = 1500;

// True in an iframe from another website. There, the page around it must read the motion sensor.
export function inOtherSiteFrame() {
	if (window.parent === window) return false;
	try {
		return !window.parent.document;
	} catch {
		return true;
	}
}
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// The device's camera looks out of the back of the device, not out of the top.
const LOOK_OUT_OF_BACK = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

// True on a touch device that reports its direction.
export function motionSupported() {
	return typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}

// Asks for permission to read the motion sensor. Safari on iPhone and iPad asks the viewer,
// and only allows the question during a tap. Other browsers do not ask. Returns true if allowed.
export async function requestMotionPermission() {
	if (typeof DeviceOrientationEvent.requestPermission !== 'function') return true;
	try {
		return (await DeviceOrientationEvent.requestPermission()) === 'granted';
	} catch (err) {
		console.warn('VR180Player: no permission for the motion sensor:', err);
		return false;
	}
}

export class MotionControl {
	constructor() {
		this.enabled = false;
		this.event = null;
		this.startYaw = null;
		this.quaternion = new THREE.Quaternion();
		this.screenTurn = new THREE.Quaternion();
		this.euler = new THREE.Euler();
		this.onStop = null; // Called when motion control stops by itself (the page said no).
		this.onOrientation = (event) => {
			if (event.alpha !== null) this.event = event;
		};
		this.onPageMessage = (event) => this.#onPageMessage(event);
		this.pageTimer = null;
	}

	// Reads the device's own motion sensor.
	start() {
		if (this.enabled) return;
		this.#begin();
		window.addEventListener('deviceorientation', this.onOrientation);
	}

	// Gets the readings from the page around the iframe. The page asks for permission.
	startFromPage() {
		if (this.enabled) return;
		this.#begin();
		this.fromPage = true;
		window.addEventListener('message', this.onPageMessage);
		window.parent.postMessage({ type: MOTION_MESSAGE, on: true }, '*');
		this.pageTimer = setTimeout(() => {
			console.warn('VR180Player: the page around the iframe has no vr180-embed.js, so there is no motion control.');
			this.#stopBySelf();
		}, PAGE_ANSWER_MS);
	}

	stop() {
		this.enabled = false;
		this.event = null;
		window.removeEventListener('deviceorientation', this.onOrientation);
		if (this.fromPage) {
			this.fromPage = false;
			clearTimeout(this.pageTimer);
			window.removeEventListener('message', this.onPageMessage);
			window.parent.postMessage({ type: MOTION_MESSAGE, on: false }, '*');
		}
	}

	#begin() {
		this.enabled = true;
		this.event = null;
		this.startYaw = null; // The direction the device faces now becomes "straight ahead".
	}

	#stopBySelf() {
		this.stop();
		this.onStop?.();
	}

	#onPageMessage(event) {
		if (event.source !== window.parent) return;
		const { data } = event;
		if (data?.type === MOTION_STATE_MESSAGE) {
			clearTimeout(this.pageTimer); // The page has vr180-embed.js.
			if (data.on === false) {
				console.warn('VR180Player: no permission for the motion sensor on the page around the iframe.');
				this.#stopBySelf();
			}
		} else if (data?.type === ORIENTATION_MESSAGE && data.alpha !== null) {
			this.event = data;
		}
	}

	// The device direction as { yaw, pitch, roll } in radians, or null before the first reading.
	// Yaw is relative to the direction when motion control started. Pitch 0 is a device held upright.
	read() {
		const { event } = this;
		if (!event) return null;
		const screenAngle = (event.angle ?? screen.orientation?.angle ?? window.orientation ?? 0) * DEGREES;
		this.euler.set(event.beta * DEGREES, event.alpha * DEGREES, -event.gamma * DEGREES, 'YXZ');
		this.quaternion.setFromEuler(this.euler)
			.multiply(LOOK_OUT_OF_BACK)
			.multiply(this.screenTurn.setFromAxisAngle(Z_AXIS, -screenAngle));
		const direction = this.euler.setFromQuaternion(this.quaternion, 'YXZ');
		if (this.startYaw === null) this.startYaw = direction.y;
		return {
			yaw: THREE.MathUtils.euclideanModulo(direction.y - this.startYaw + Math.PI, Math.PI * 2) - Math.PI,
			pitch: direction.x,
			roll: direction.z,
		};
	}
}
