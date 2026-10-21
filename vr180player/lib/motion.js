import * as THREE from './three.js';

// Motion control for 2D on phones and tablets: the viewer looks around by turning the device,
// as if the screen were a window into the video.

const DEGREES = Math.PI / 180;
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
		this.onOrientation = (event) => {
			if (event.alpha !== null) this.event = event;
		};
	}

	start() {
		if (this.enabled) return;
		this.enabled = true;
		this.event = null;
		this.startYaw = null; // The direction the device faces now becomes "straight ahead".
		window.addEventListener('deviceorientation', this.onOrientation);
	}

	stop() {
		this.enabled = false;
		this.event = null;
		window.removeEventListener('deviceorientation', this.onOrientation);
	}

	// The device direction as { yaw, pitch, roll } in radians, or null before the first reading.
	// Yaw is relative to the direction when motion control started. Pitch 0 is a device held upright.
	read() {
		const { event } = this;
		if (!event) return null;
		const screenAngle = (screen.orientation?.angle ?? window.orientation ?? 0) * DEGREES;
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
