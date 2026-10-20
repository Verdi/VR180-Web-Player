import * as THREE from './three.js';
import { ICONS, drawIcon, textIcon } from './icons.js';

// Sizes from the Figma design, in design pixels (origin top-left, y down).
const DESIGN = {
	width: 450,
	height: 132,
	cornerRadius: 30,
	titleSize: 14,
	titleTop: 20,
	seekWidth: 386,
	seekHeight: 5,
	seekY: 54,
	buttonSize: 44,
	buttonY: 90,
};

const PANEL_WIDTH_METERS = 1.5;
const METERS_PER_PIXEL = PANEL_WIDTH_METERS / DESIGN.width;
const PANEL_POSITION = [0, 0.5, -1.8];
const TEXTURE_WIDTH = 1024;
const TEXTURE_SCALE = TEXTURE_WIDTH / DESIGN.width;
const BUTTON_TEXTURE_SIZE = 128;
const SEEK_HIT_AREA_MULTIPLIER = 5;
const FADE_MS = 200;
const AUTO_HIDE_MS = 10000;

// The panel buttons. `x` is the button center in the design.
// `icon` picks the icon to show from the current video state and the panel state.
// A button whose icon is null is hidden.
const BUTTONS = [
	{ action: 'exit', x: 42, icon: () => ICONS.exit },
	{ action: 'back', x: 169, icon: () => ICONS.back },
	{ action: 'playPause', x: 225, icon: (video) => (video.paused || video.ended ? ICONS.play : ICONS.pause) },
	{ action: 'forward', x: 281, icon: () => ICONS.forward },
	// Between the forward and mute buttons. Shown only when the video has qualities to choose.
	{ action: 'quality', x: 345, icon: (_video, state) => (state.qualityLabel ? textIcon(state.qualityLabel) : null) },
	{ action: 'mute', x: 408, icon: (video) => (video.muted || video.volume === 0 ? ICONS.soundOff : ICONS.soundOn) },
];

const SEEK_WIDTH = DESIGN.seekWidth * METERS_PER_PIXEL;

// Converts a design point to panel coordinates in meters (origin center, y up).
function toPanel(x, y) {
	return [(x - DESIGN.width / 2) * METERS_PER_PIXEL, -(y - DESIGN.height / 2) * METERS_PER_PIXEL];
}

function fadeMaterial(options) {
	return new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, ...options });
}

// The control panel that floats in front of the viewer in VR.
// Meshes that react to a controller have `userData.action` and are listed in `interactables`.
export class VRPanel {
	constructor(title) {
		this.group = new THREE.Group();
		this.group.name = 'vrControlPanel';
		this.group.position.set(...PANEL_POSITION);
		this.allInteractables = [];
		this.buttons = [];
		this.state = { qualityLabel: null };
		this.opacity = 0;
		this.targetOpacity = 0;
		this.hideTimer = null;

		this.#addBackground(title);
		this.#addSeekBar();
		for (const spec of BUTTONS) this.#addButton(spec);
		this.reset();
	}

	// The meshes a controller can press. Hidden buttons are not in the list.
	get interactables() {
		return this.allInteractables.filter((mesh) => mesh.visible);
	}

	// Shows the quality choice on the quality button, or hides the button if `label` is null.
	setQualityLabel(label) {
		this.state.qualityLabel = label;
	}

	get isShown() {
		return this.group.visible && this.opacity > 0.01;
	}

	show() {
		this.group.visible = true;
		this.targetOpacity = 1;
		clearTimeout(this.hideTimer);
		this.hideTimer = setTimeout(() => this.hide(), AUTO_HIDE_MS);
	}

	hide() {
		clearTimeout(this.hideTimer);
		this.targetOpacity = 0;
	}

	// Hides the panel at once, with no fade.
	reset() {
		clearTimeout(this.hideTimer);
		this.opacity = 0;
		this.targetOpacity = 0;
		this.#applyOpacity();
		this.group.visible = false;
	}

	// Moves the fade forward. Called once per frame by the VR render loop.
	tick(deltaMs) {
		if (this.opacity === this.targetOpacity) return;
		const step = deltaMs / FADE_MS;
		this.opacity = this.opacity < this.targetOpacity
			? Math.min(this.targetOpacity, this.opacity + step)
			: Math.max(this.targetOpacity, this.opacity - step);
		this.#applyOpacity();
		if (this.opacity === 0) this.group.visible = false;
	}

	update(video) {
		const progress = isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0;
		this.seekProgress.scale.x = Math.max(0.0001, progress);
		this.seekProgress.position.x = -SEEK_WIDTH / 2 + (SEEK_WIDTH * progress) / 2;

		for (const button of this.buttons) {
			const icon = button.spec.icon(video, this.state);
			button.mesh.visible = Boolean(icon);
			if (!icon || icon === button.icon) continue;
			button.icon = icon;
			drawIcon(button.context, BUTTON_TEXTURE_SIZE, icon);
			button.texture.needsUpdate = true;
		}
	}

	// Converts a point where a controller hit the seek bar to a fraction of the video (0 to 1).
	seekFractionAt(worldPoint) {
		const local = this.seekTrack.worldToLocal(worldPoint.clone());
		return THREE.MathUtils.clamp((local.x + SEEK_WIDTH / 2) / SEEK_WIDTH, 0, 1);
	}

	dispose() {
		clearTimeout(this.hideTimer);
		this.group.traverse((object) => {
			if (!object.isMesh) return;
			object.geometry.dispose();
			object.material.map?.dispose();
			object.material.dispose();
		});
	}

	#applyOpacity() {
		this.group.traverse((object) => {
			if (object.material) object.material.opacity = this.opacity;
		});
	}

	#addMesh(width, height, material, { x = 0, y = 0, z = 0, renderOrder = 0, action } = {}) {
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
		mesh.position.set(x, y, z);
		mesh.renderOrder = renderOrder;
		if (action) {
			mesh.name = action;
			mesh.userData.action = action;
			this.allInteractables.push(mesh);
		}
		this.group.add(mesh);
		return mesh;
	}

	// Changes the title on the panel.
	setTitle(title) {
		if (title === this.title) return;
		this.title = title;
		const { canvas, ctx, texture } = this.background;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
		ctx.beginPath();
		ctx.roundRect(0, 0, canvas.width, canvas.height, DESIGN.cornerRadius * TEXTURE_SCALE);
		ctx.fill();

		ctx.fillStyle = '#ffffff';
		ctx.font = `500 ${Math.round(DESIGN.titleSize * TEXTURE_SCALE)}px Helvetica, Arial, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText(title, canvas.width / 2, DESIGN.titleTop * TEXTURE_SCALE);
		texture.needsUpdate = true;
	}

	#addBackground(title) {
		const canvas = document.createElement('canvas');
		canvas.width = TEXTURE_WIDTH;
		canvas.height = Math.round(DESIGN.height * TEXTURE_SCALE);
		const texture = new THREE.CanvasTexture(canvas);
		texture.minFilter = THREE.LinearFilter;
		this.background = { canvas, ctx: canvas.getContext('2d'), texture };
		this.setTitle(title);
		this.#addMesh(PANEL_WIDTH_METERS, DESIGN.height * METERS_PER_PIXEL, fadeMaterial({ map: texture }), {
			action: 'background',
		});
	}

	#addSeekBar() {
		const [, y] = toPanel(0, DESIGN.seekY);
		const trackHeight = DESIGN.seekHeight * METERS_PER_PIXEL;
		const progressHeight = (DESIGN.seekHeight - 1) * METERS_PER_PIXEL;

		this.seekTrack = this.#addMesh(SEEK_WIDTH, trackHeight, fadeMaterial({ color: 0x767676, depthWrite: true }), {
			y, z: 0.01, renderOrder: 1,
		});
		this.seekProgress = this.#addMesh(SEEK_WIDTH, progressHeight, fadeMaterial({ color: 0xffffff, depthWrite: true }), {
			y: y + METERS_PER_PIXEL, z: 0.015, renderOrder: 2,
		});
		// A taller, invisible area above the thin bar, so it is easy to hit with a controller.
		this.#addMesh(SEEK_WIDTH, trackHeight * SEEK_HIT_AREA_MULTIPLIER, fadeMaterial({ visible: false }), {
			y, z: 0.012, renderOrder: 2, action: 'seek',
		});
	}

	#addButton(spec) {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = BUTTON_TEXTURE_SIZE;
		const texture = new THREE.CanvasTexture(canvas);
		texture.minFilter = THREE.LinearFilter;

		const [x, y] = toPanel(spec.x, DESIGN.buttonY);
		const size = DESIGN.buttonSize * METERS_PER_PIXEL;
		const mesh = this.#addMesh(size, size, fadeMaterial({ map: texture }), { x, y, z: 0.02, renderOrder: 3, action: spec.action });
		this.buttons.push({ spec, mesh, texture, context: canvas.getContext('2d'), icon: null });
	}
}
