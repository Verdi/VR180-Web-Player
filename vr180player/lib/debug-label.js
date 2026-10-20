import * as THREE from './three.js';

const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 64;
const WIDTH_METERS = 1.5;
// Below the VR panel, which is centered at y = 0.5 and is about 0.44 m high.
const POSITION = [0, 0.22, -1.8];

// A line of text in VR that stays visible, for data-debug. Unlike the panel, it does not hide,
// so the viewer can read it at the moment a problem happens.
export class DebugLabel {
	constructor() {
		this.canvas = document.createElement('canvas');
		this.canvas.width = TEXTURE_WIDTH;
		this.canvas.height = TEXTURE_HEIGHT;
		this.context = this.canvas.getContext('2d');
		this.texture = new THREE.CanvasTexture(this.canvas);
		this.texture.minFilter = THREE.LinearFilter;
		const material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false });
		this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH_METERS, WIDTH_METERS * TEXTURE_HEIGHT / TEXTURE_WIDTH), material);
		this.mesh.name = 'debugLabel';
		this.mesh.position.set(...POSITION);
		this.mesh.renderOrder = 4;
		this.text = null;
	}

	setText(text) {
		if (text === this.text) return;
		this.text = text;
		const { context: ctx, canvas } = this;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
		ctx.beginPath();
		ctx.roundRect(0, 0, canvas.width, canvas.height, 16);
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.font = '500 26px Helvetica, Arial, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, canvas.width / 2, canvas.height / 2);
		this.texture.needsUpdate = true;
	}

	dispose() {
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
		this.texture.dispose();
	}
}
