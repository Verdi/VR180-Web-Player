import * as THREE from './three.js';

// A video format has two parts:
// - a projection: the shape the video is drawn on (for example, half a sphere for 180°).
// - a stereo layout: where the left-eye and right-eye pictures are in each frame.
// To support a new format, add an entry to PROJECTIONS or LAYOUTS.

const SPHERE_RADIUS = 500;

export const PROJECTIONS = {
	'180': {
		createGeometry() {
			const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 32, -Math.PI / 2, Math.PI, 0, Math.PI);
			geometry.scale(-1, 1, 1); // Show the inside of the sphere.
			return geometry;
		},
		rotationY: Math.PI / 2,
		// How far the 2D view can turn before the edge of the video shows.
		maxYaw: Math.PI / 4,
		maxPitch: Math.PI / 4,
	},
};

// The part of the frame each eye sees, as [offsetU, offsetV, scaleU, scaleV] in texture coordinates.
// A layout with no `right` entry is mono: both eyes see `left`.
export const LAYOUTS = {
	sbs: { left: [0, 0, 0.5, 1], right: [0.5, 0, 0.5, 1] },
	// One picture for both eyes. For example, a 2D playlist with only the left-eye picture.
	mono: { left: [0, 0, 1, 1] },
};

export function resolveFormat({ projection = '180', stereo = 'sbs' } = {}) {
	const projectionSpec = PROJECTIONS[projection];
	if (!projectionSpec) {
		throw new Error(`Unknown projection "${projection}". Supported: ${Object.keys(PROJECTIONS).join(', ')}.`);
	}
	const layout = LAYOUTS[stereo];
	if (!layout) {
		throw new Error(`Unknown stereo layout "${stereo}". Supported: ${Object.keys(LAYOUTS).join(', ')}.`);
	}
	return { projection: projectionSpec, layout, isStereo: Boolean(layout.right) };
}
