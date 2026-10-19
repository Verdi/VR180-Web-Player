import * as THREE from './three.js';

// In VR, Three.js draws layer 1 only for the left eye and layer 2 only for the right eye.
// Layer 0 (the default) is drawn for both eyes.
export const LEFT_EYE_LAYER = 1;
export const RIGHT_EYE_LAYER = 2;

// Builds the surface the video is drawn on.
// A stereo video gets one mesh per eye. Each mesh shows only its eye's part of the frame,
// so the player never has to guess which eye is being drawn.
export function createVideoScreen(format, texture) {
	const screen = new THREE.Group();
	screen.name = 'videoScreen';
	screen.rotation.y = format.projection.rotationY ?? 0;
	screen.visible = false;

	const material = new THREE.MeshBasicMaterial({ map: texture });
	const baseGeometry = format.projection.createGeometry();
	if (format.isStereo) {
		screen.add(createEyeMesh(baseGeometry, format.layout.left, material, LEFT_EYE_LAYER));
		screen.add(createEyeMesh(baseGeometry, format.layout.right, material, RIGHT_EYE_LAYER));
	} else {
		screen.add(createEyeMesh(baseGeometry, format.layout.left, material, 0));
	}
	baseGeometry.dispose();
	return screen;
}

export function disposeVideoScreen(screen) {
	screen.traverse((object) => {
		if (object.isMesh) {
			object.geometry.dispose();
			object.material.dispose();
		}
	});
}

function createEyeMesh(baseGeometry, region, material, layer) {
	const geometry = baseGeometry.clone();
	const [offsetU, offsetV, scaleU, scaleV] = region;
	const uv = geometry.attributes.uv;
	for (let i = 0; i < uv.count; i++) {
		uv.setXY(i, offsetU + uv.getX(i) * scaleU, offsetV + uv.getY(i) * scaleV);
	}
	const mesh = new THREE.Mesh(geometry, material);
	mesh.layers.set(layer);
	return mesh;
}
