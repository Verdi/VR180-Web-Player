import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.176.0/build/three.module.js';

let scene, camera, renderer, video, videoTexture, sphereMaterial;
let vr180Mesh;
let xrSession = null;
let controller1, raycaster, uiElements = [];
const tempMatrix = new THREE.Matrix4();
let videoElement, playBtn;
let frameCounter = 0;

// 2D Control Panel Elements
let controlPanel, videoTitle, currentTimeDisplay, totalTimeDisplay, progressBar, playedBar;
let fullscreenBtn, backBtn, play2Btn, forwardBtn, muteBtn;
let controlPanelTimeout;
let isControlPanelVisible = false;
const CONTROL_PANEL_HIDE_DELAY = 3000; // 3 seconds

let isXrLoopActive = false;
let is2DMode = false;
let vrControlPanel;

// 2D Camera Controls
let camera2D;
let cameraRotation = { yaw: 0, pitch: 0 };
let cameraVelocity = { yaw: 0, pitch: 0 };
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let lastTouchX = 0;
let lastTouchY = 0;

// 2D Control Constants
const MOUSE_SENSITIVITY = 0.002;
const TOUCH_SENSITIVITY = 0.003;
const MOMENTUM_DAMPING = 0.8; // Reduced from 0.9 for 50% less inertia
const MAX_PITCH = Math.PI * (45 / 180); // ~45 degrees - edge of VR180 content aligns with viewport edge
const MAX_YAW = Math.PI * (45 / 180); // ~45 degrees - edge of VR180 content aligns with viewport edge

// Figma design constants (for layout reference)
const FIGMA_PANEL_WIDTH_PX = 450;
const FIGMA_PANEL_HEIGHT_PX = 132;
const FIGMA_CORNER_RADIUS_PX = 30;
const FIGMA_TITLE_FONT_SIZE_PX = 14;
const FIGMA_TITLE_MARGIN_TOP_PX = 20;
const FIGMA_SEEK_BAR_WIDTH_PX = 386;
const FIGMA_SEEK_BAR_HEIGHT_PX = 5;
const FIGMA_SEEK_BAR_Y_OFFSET_FROM_PANEL_CENTER_PX = (FIGMA_PANEL_HEIGHT_PX / 2) - 54;

const FIGMA_PLAYPAUSE_BUTTON_SIZE_PX = 44;
const FIGMA_PLAYPAUSE_BUTTON_X_PX = 225;
const FIGMA_PLAYPAUSE_BUTTON_Y_PX = 90;

const FIGMA_REWIND_BUTTON_SIZE_PX = 44;
const FIGMA_REWIND_BUTTON_X_PX = 169;
const FIGMA_REWIND_BUTTON_Y_PX = 90;

const FIGMA_FORWARD_BUTTON_SIZE_PX = 44;
const FIGMA_FORWARD_BUTTON_X_PX = 281;
const FIGMA_FORWARD_BUTTON_Y_PX = 90;

const FIGMA_EXIT_BUTTON_SIZE_PX = 44;
const FIGMA_EXIT_BUTTON_X_PX = 42;
const FIGMA_EXIT_BUTTON_Y_PX = 90;

const FIGMA_VOLUME_BUTTON_SIZE_PX = 44;
const FIGMA_VOLUME_BUTTON_X_PX = 408;
const FIGMA_VOLUME_BUTTON_Y_PX = 90;


// World space dimensions derived from Figma constants
const WORLD_PANEL_WIDTH = 1.5;
const SCALE_FACTOR = WORLD_PANEL_WIDTH / FIGMA_PANEL_WIDTH_PX;
const WORLD_PANEL_HEIGHT = FIGMA_PANEL_HEIGHT_PX * SCALE_FACTOR;
const WORLD_SEEK_BAR_WIDTH = FIGMA_SEEK_BAR_WIDTH_PX * SCALE_FACTOR;
const WORLD_SEEK_BAR_TRACK_HEIGHT = (FIGMA_SEEK_BAR_HEIGHT_PX) * SCALE_FACTOR;
const WORLD_SEEK_BAR_PROGRESS_HEIGHT = (FIGMA_SEEK_BAR_HEIGHT_PX - 1) * SCALE_FACTOR;
const WORLD_SEEK_BAR_Y_OFFSET = FIGMA_SEEK_BAR_Y_OFFSET_FROM_PANEL_CENTER_PX * SCALE_FACTOR;
const WORLD_SEEK_BAR_HIT_AREA_HEIGHT_MULTIPLIER = 5;
const WORLD_SEEK_BAR_HIT_AREA_HEIGHT = WORLD_SEEK_BAR_TRACK_HEIGHT * WORLD_SEEK_BAR_HIT_AREA_HEIGHT_MULTIPLIER;

const PANEL_TEXTURE_WIDTH = 1024;
const PANEL_TEXTURE_HEIGHT = Math.round(PANEL_TEXTURE_WIDTH * (FIGMA_PANEL_HEIGHT_PX / FIGMA_PANEL_WIDTH_PX));

// Panel fade animation variables
let panelOpacity = 0;
let panelTargetOpacity = 0;
let isPanelFading = false;
let panelHideTimeout = null;
let lastFadeTimestamp = 0;
const FADE_DURATION_MS = 200;
const AUTO_HIDE_DELAY_MS = 10000;

// VR UI Meshes
let seekBarTrackMesh, seekBarProgressMesh, seekBarHitAreaMesh;
let vrPlayPauseButtonMesh, vrPlayPauseButtonCanvas, vrPlayPauseButtonContext, vrPlayPauseButtonTexture;
let vrRewindButtonMesh;
let vrForwardButtonMesh;
let vrExitButtonMesh;
let vrVolumeButtonMesh, vrVolumeButtonCanvas, vrVolumeButtonContext, vrVolumeButtonTexture;
const VR_BUTTON_TEXTURE_SIZE = 128;

// SVG Path Data for Icons
const SOUND_ON_SVG_PATH = "M13.4844 0.956299C13.766 0.689292 14.2002 0.683249 14.4883 0.930908L14.5439 0.984619L14.9326 1.41431C18.8143 5.92858 18.6845 12.6488 14.5439 17.0159C14.259 17.3163 13.7849 17.329 13.4844 17.0442C13.1838 16.7592 13.1712 16.2852 13.4561 15.9846C17.0653 12.178 17.1776 6.32534 13.7939 2.39087L13.4561 2.01587L13.4062 1.95825C13.1736 1.6574 13.2025 1.22361 13.4844 0.956299ZM6.9082 2.89868C7.71642 2.4576 8.75 3.03449 8.75 4.00024V14.0002C8.74986 15.0302 7.57399 15.6181 6.75 15.0002L3.64746 12.6731L1.10449 11.8254C0.594287 11.6552 0.250089 11.1777 0.25 10.6399V7.3606C0.250012 6.82269 0.59426 6.34529 1.10449 6.17505L3.64746 5.32642L6.75 3.00024L6.9082 2.89868ZM12.6172 4.35474C12.9512 4.15679 13.3767 4.24825 13.6025 4.55396L13.6455 4.61743L13.7812 4.85864C14.4372 6.07858 14.75 7.55417 14.75 9.00024C14.75 10.5428 14.3943 12.1195 13.6455 13.3831C13.4343 13.7391 12.9734 13.8568 12.6172 13.6458C12.2611 13.4346 12.1435 12.9737 12.3545 12.6174C12.9389 11.6312 13.25 10.3324 13.25 9.00024C13.25 7.75133 12.9766 6.53179 12.4609 5.57153L12.3545 5.38306L12.3193 5.3147C12.1595 4.96983 12.2833 4.55281 12.6172 4.35474ZM4.51465 6.552C4.40729 6.63245 4.28743 6.69512 4.16016 6.73755L1.75 7.54028V10.4592L4.16016 11.2629C4.25561 11.2948 4.34674 11.3383 4.43164 11.3918L4.51465 11.4485L7.25 13.4993V4.50024L4.51465 6.552ZM10.1699 7.46997C10.4445 7.1954 10.8793 7.17791 11.1738 7.41821L11.2305 7.46997L11.377 7.63501C11.6931 8.03702 11.8252 8.54177 11.8252 9.00024C11.8252 9.52404 11.6529 10.1081 11.2305 10.5305C10.9376 10.8233 10.4628 10.8232 10.1699 10.5305C9.87703 10.2376 9.87703 9.76286 10.1699 9.46997C10.2474 9.39246 10.3252 9.22626 10.3252 9.00024C10.3252 8.83065 10.2811 8.69473 10.2266 8.60474L10.1699 8.53052L10.1182 8.47388C9.87786 8.1793 9.89532 7.74457 10.1699 7.46997Z";
const SOUND_MUTED_SVG_PATH = "M6.9082 2.8985C7.71639 2.45747 8.74994 3.03437 8.75 4.00006V14.0001C8.75 15.0301 7.57405 15.6181 6.75 15.0001L3.64746 12.6729L1.10449 11.8253C0.594245 11.655 0.250012 11.1776 0.25 10.6397V7.36041C0.25005 6.82252 0.594258 6.34508 1.10449 6.17486L3.64746 5.32623L6.75 3.00006L6.9082 2.8985ZM4.51465 6.55182C4.4341 6.61218 4.34631 6.66193 4.25391 6.70123L4.16016 6.73736L1.75 7.5401V10.459L4.16016 11.2628L4.25391 11.2989C4.31551 11.3251 4.37502 11.356 4.43164 11.3917L4.51465 11.4483L7.25 13.4991V4.50006L4.51465 6.55182ZM9.60156 5.53033C9.89446 5.23755 10.3693 5.23748 10.6621 5.53033L13.1318 8.00006L15.541 5.59088C15.8339 5.29821 16.3087 5.29806 16.6016 5.59088C16.8944 5.8837 16.8942 6.35852 16.6016 6.65143L14.1924 9.06061L16.6729 11.5411C16.9654 11.834 16.9655 12.3088 16.6729 12.6016C16.38 12.8945 15.9042 12.8945 15.6113 12.6016L13.1309 10.1212L10.5908 12.6622C10.2979 12.9549 9.82313 12.955 9.53027 12.6622C9.23742 12.3693 9.23749 11.8945 9.53027 11.6016L12.0703 9.06061L9.60156 6.59088C9.30867 6.29799 9.30867 5.82323 9.60156 5.53033Z";


// Dynamic UI Creation Functions
function createPlayButton() {
	const playButton = document.createElement('button');
	playButton.id = 'playBtn';
	playButton.setAttribute('aria-label', 'Play video');
	
	const playImg = document.createElement('img');
	playImg.src = 'vr180player/images/play.png';
	playImg.alt = 'Play';
	
	playButton.appendChild(playImg);
	
	return playButton;
}

function create2DControlPanel() {
	const panel = document.createElement('div');
	panel.id = 'panel';
	
	// Status section
	const status = document.createElement('div');
	status.id = 'status';
	
	const videoTitle = document.createElement('p');
	videoTitle.id = 'video-title';
	videoTitle.textContent = 'Title';
	
	const progress = document.createElement('div');
	progress.id = 'progress';
	
	const currentTime = document.createElement('p');
	currentTime.id = 'current-time';
	currentTime.textContent = '00:00:00';
	
	const bar = document.createElement('div');
	bar.id = 'bar';
	
	const played = document.createElement('div');
	played.id = 'played';
	bar.appendChild(played);
	
	const totalTime = document.createElement('p');
	totalTime.id = 'total-time';
	totalTime.textContent = '00:00:00';
	
	progress.appendChild(currentTime);
	progress.appendChild(bar);
	progress.appendChild(totalTime);
	
	status.appendChild(videoTitle);
	status.appendChild(progress);
	
	// Controls section
	const controls = document.createElement('div');
	controls.id = 'controls';
	
	const fullscreenBtn = document.createElement('button');
	fullscreenBtn.id = 'fullscreen';
	
	const nav = document.createElement('div');
	nav.id = 'nav';
	
	const backBtn = document.createElement('button');
	backBtn.id = 'back';
	
	const play2Btn = document.createElement('button');
	play2Btn.id = 'play2';
	
	const forwardBtn = document.createElement('button');
	forwardBtn.id = 'forward';
	
	nav.appendChild(backBtn);
	nav.appendChild(play2Btn);
	nav.appendChild(forwardBtn);
	
	const muteBtn = document.createElement('button');
	muteBtn.id = 'mute';
	
	controls.appendChild(fullscreenBtn);
	controls.appendChild(nav);
	controls.appendChild(muteBtn);
	
	// Assemble panel
	panel.appendChild(status);
	panel.appendChild(controls);
	
	return panel;
}

document.addEventListener('DOMContentLoaded', () => {
	videoElement = document.getElementById('vr180');
	
	if (!videoElement) {
		console.error("CRITICAL_ERROR_DOM: Essential HTML element (video) not found.");
		return;
	}

	// Create and insert UI elements dynamically
	const container = document.getElementById('vr-container');
	if (!container) {
		console.error("CRITICAL_ERROR_DOM: VR container not found.");
		return;
	}

	// Create and insert play button
	playBtn = createPlayButton();
	container.appendChild(playBtn);

	// Create and insert 2D control panel
	const controlPanel = create2DControlPanel();
	container.appendChild(controlPanel);

	playBtn.disabled = true;
	
	if (videoElement) {
		videoElement.load();
	}

	if (navigator.xr) {
		navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
			if (supported) {
				playBtn.dataset.xrSupported = "true";
			} else {
				playBtn.dataset.xrSupported = "false";
				// Enable button for regular video playback when VR is not supported
				playBtn.disabled = false;
			}
			// Always call init() regardless of VR support
			init();
		}).catch(err => {
			console.error("XR Support Check Error:", err);
			playBtn.dataset.xrSupported = "false";
			// Enable button for regular video playback when VR check fails
			playBtn.disabled = false;
			// Call init() even when VR check fails
			init();
		});
	} else {
		playBtn.dataset.xrSupported = "false";
		// If navigator.xr itself is not available, enable button for regular video playback
		if (playBtn) {
			playBtn.disabled = false;
		}
		// Call init() even when XR is not available
		init();
	}
});

function drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
	if (typeof stroke === 'undefined') { stroke = true; }
	if (typeof radius === 'undefined') { radius = 5; }
	if (typeof radius === 'number') {
		radius = { tl: radius, tr: radius, br: radius, bl: radius };
	} else {
		const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
		for (let side in defaultRadius) {
			radius[side] = radius[side] || defaultRadius[side];
		}
	}
	const minDimension = Math.min(width, height);
	if (width < 2 * radius.tl) radius.tl = width / 2;
	if (width < 2 * radius.tr) radius.tr = width / 2;
	if (width < 2 * radius.bl) radius.bl = width / 2;
	if (width < 2 * radius.br) radius.br = width / 2;

	if (height < 2 * radius.tl) radius.tl = height / 2;
	if (height < 2 * radius.tr) radius.tr = height / 2;
	if (height < 2 * radius.bl) radius.bl = height / 2;
	if (height < 2 * radius.br) radius.br = height / 2;

	ctx.beginPath();
	ctx.moveTo(x + radius.tl, y);
	ctx.lineTo(x + width - radius.tr, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
	ctx.lineTo(x + width, y + height - radius.br);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	ctx.lineTo(x + radius.bl, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	ctx.lineTo(x, y + radius.tl);
	ctx.quadraticCurveTo(x, y, x + radius.tl, y);
	ctx.closePath();
	if (fill) {
		if (typeof fill === 'string') ctx.fillStyle = fill;
		ctx.fill();
	}
	if (stroke) {
		if (typeof stroke === 'string') ctx.strokeStyle = stroke;
		ctx.stroke();
	}
}

function createButtonTexture(textOrPathData, textColor = 'white', backgroundColor = 'rgba(0,0,0,0)', textureSize = 128, fontSize = 48, isSvgPath = false, svgViewBoxSize = 44) {
	const canvas = document.createElement('canvas');
	canvas.width = textureSize;
	canvas.height = textureSize;
	const ctx = canvas.getContext('2d');

	if (backgroundColor !== 'rgba(0,0,0,0)') {
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, textureSize, textureSize);
	}

	ctx.fillStyle = textColor;

	if (isSvgPath) {
		const path = new Path2D(textOrPathData);
		const iconTargetSize = textureSize;
		const scale = iconTargetSize / svgViewBoxSize;
		const offsetX = (textureSize - (svgViewBoxSize * scale)) / 2;
		const offsetY = (textureSize - (svgViewBoxSize * scale)) / 2;

		ctx.save();
		ctx.translate(offsetX, offsetY);
		ctx.scale(scale, scale);
		ctx.fill(path);
		ctx.restore();
	} else {
		ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(textOrPathData, textureSize / 2, textureSize / 2);
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.minFilter = THREE.LinearFilter;
	texture.needsUpdate = true;
	return texture;
}


function init() {
	try {
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		camera.position.set(0, 1.6, 0.1);
		scene.add(camera);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		if (!renderer || !renderer.isWebGLRenderer) {
			throw new Error("Failed to create WebGLRenderer or it's not a valid Three.js renderer type.");
		}
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.xr.enabled = true;
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		document.getElementById('vr-container').appendChild(renderer.domElement);

		if (renderer.domElement) {
			renderer.domElement.style.display = 'none';
		}

		const gl = renderer.getContext();
		if (!gl) {
			throw new Error("Failed to get WebGL context from renderer.");
		}
		gl.canvas.addEventListener('webglcontextlost', (event) => {
			event.preventDefault();
			console.error("CONTEXT_EVENT: WebGL Context Lost! xrSession active?", !!xrSession, event);
			if (xrSession) {
				const sessionToClose = xrSession;
				xrSession = null; // Nullify global ref immediately
				sessionToClose.removeEventListener('end', onVRSessionEnd); // Try to remove listener
				sessionToClose.end().catch(e => { console.error("Error ending session on context lost:", e); }).finally(() => {
					onVRSessionEnd({ session: sessionToClose });
				});
			}
		}, false);
		gl.canvas.addEventListener('webglcontextrestored', (event) => {
			console.log("CONTEXT_EVENT: WebGL Context Restored.");
			if (video && sphereMaterial && vr180Mesh && vr180Mesh.visible && renderer.xr.isPresenting && xrSession) {
				if (videoTexture) videoTexture.dispose();
				videoTexture = new THREE.VideoTexture(video);
				videoTexture.minFilter = THREE.LinearFilter; videoTexture.magFilter = THREE.LinearFilter;
				videoTexture.colorSpace = THREE.SRGBColorSpace;
				sphereMaterial.map = videoTexture;
				sphereMaterial.needsUpdate = true;
				updateVRPlayPauseButtonIcon();
				updateVRVolumeButtonIcon();
				console.log("Re-initialized video texture after context restoration during VR.");
			}
		}, false);

		video = videoElement;

		const sphereRadius = 500;
		let thetaStart = 0;
		let thetaLength = Math.PI;

		const sphereGeometry = new THREE.SphereGeometry(
			sphereRadius, 64, 32,
			-Math.PI / 2,
			Math.PI,
			thetaStart,
			thetaLength
		);
		sphereGeometry.scale(-1, 1, 1);
		sphereMaterial = new THREE.MeshBasicMaterial({ map: null });
		vr180Mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
		vr180Mesh.name = "vr180Mesh";
		uiElements.push(vr180Mesh);

		vr180Mesh.rotation.y = Math.PI / 2;
		scene.add(vr180Mesh);
		vr180Mesh.visible = false;

		vr180Mesh.onBeforeRender = function (renderer, scene, activeCamera, geometry, material, group) {
			if (!material.map) return;
			const isPresentingXR = renderer.xr.isPresenting;
			
			// Handle 2D mode - show only left eye view
			if (is2DMode && !isPresentingXR) {
				material.map.offset.x = 0;
				material.map.repeat.x = 0.5;
				material.map.offset.y = 0;
				material.map.repeat.y = 1;
				return;
			}
			
			// Default to full texture for non-VR, non-2D mode
			material.map.offset.x = 0; material.map.repeat.x = 1;
			material.map.offset.y = 0; material.map.repeat.y = 1;
			if (!isPresentingXR) {
				return;
			}

			const xrCamera = renderer.xr.getCamera();

			if (xrCamera && xrCamera.cameras && xrCamera.cameras.length >= 2) {
				if (activeCamera === xrCamera.cameras[0]) {
					material.map.offset.x = 0;
				} else if (activeCamera === xrCamera.cameras[1]) {
					material.map.offset.x = 0.5;
				} else {
					material.map.offset.x = 0;
				}
				material.map.repeat.x = 0.5;
			} else {
				const projMatrixEl8 = activeCamera.projectionMatrix.elements[8];
				if (projMatrixEl8 < -0.0001) {
					material.map.offset.x = 0; material.map.repeat.x = 0.5;
				} else if (projMatrixEl8 > 0.0001) {
					material.map.offset.x = 0.5; material.map.repeat.x = 0.5;
				}
			}
		};

		// Initialize 2D camera
		camera2D = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		camera2D.position.set(0, 0, 0);
		camera2D.rotation.set(0, 0, 0);
	} catch (e) {
		console.error("INIT_ERROR (Phase 1 - Core Setup):", e);
		renderer = null;
		return;
	}

	try { // Phase 2: VR Control Panel UI
		vrControlPanel = new THREE.Group();
		vrControlPanel.position.set(0, 0.5, -1.8);
		vrControlPanel.rotation.x = 0;
		scene.add(vrControlPanel);

		const panelCanvas = document.createElement('canvas');
		panelCanvas.width = PANEL_TEXTURE_WIDTH;
		panelCanvas.height = PANEL_TEXTURE_HEIGHT;
		const panelCtx = panelCanvas.getContext('2d');

		panelCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
		const textureCornerRadius = FIGMA_CORNER_RADIUS_PX * (PANEL_TEXTURE_WIDTH / FIGMA_PANEL_WIDTH_PX);
		drawRoundedRect(panelCtx, 0, 0, PANEL_TEXTURE_WIDTH, PANEL_TEXTURE_HEIGHT, textureCornerRadius, true, false);

		const videoTitle = videoElement.getAttribute('title') || videoElement.querySelector('source')?.src.split('/').pop()?.split('.')[0].replace(/-/g, ' ') || "Video Title";
		const titleFontSizeTexturePx = Math.round(FIGMA_TITLE_FONT_SIZE_PX * (PANEL_TEXTURE_HEIGHT / FIGMA_PANEL_HEIGHT_PX));
		panelCtx.fillStyle = '#ffffff';
		panelCtx.font = `500 ${titleFontSizeTexturePx}px Helvetica, Arial, sans-serif`;
		panelCtx.textAlign = 'center';
		panelCtx.textBaseline = 'top';
		const titleMarginTopTexturePx = FIGMA_TITLE_MARGIN_TOP_PX * (PANEL_TEXTURE_HEIGHT / FIGMA_PANEL_HEIGHT_PX);
		panelCtx.fillText(videoTitle, PANEL_TEXTURE_WIDTH / 2, titleMarginTopTexturePx);

		const panelTexture = new THREE.CanvasTexture(panelCanvas);
		panelTexture.minFilter = THREE.LinearFilter;
		panelTexture.needsUpdate = true;

		const panelMaterial = new THREE.MeshBasicMaterial({
			map: panelTexture,
			transparent: true,
			opacity: 0,
			depthWrite: false
		});
		const panelGeometry = new THREE.PlaneGeometry(WORLD_PANEL_WIDTH, WORLD_PANEL_HEIGHT);
		const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
		panelMesh.name = "vrControlPanelBackground";
		panelMesh.renderOrder = 0;
		vrControlPanel.add(panelMesh);
		uiElements.push(panelMesh);

		const seekBarTrackMaterial = new THREE.MeshBasicMaterial({ color: 0x767676, transparent: true, opacity: 0 });
		const seekBarTrackGeometry = new THREE.PlaneGeometry(WORLD_SEEK_BAR_WIDTH, WORLD_SEEK_BAR_TRACK_HEIGHT);
		seekBarTrackMesh = new THREE.Mesh(seekBarTrackGeometry, seekBarTrackMaterial);
		seekBarTrackMesh.name = "seekBarTrackVisual";
		seekBarTrackMesh.position.y = WORLD_SEEK_BAR_Y_OFFSET;
		seekBarTrackMesh.position.z = 0.01;
		seekBarTrackMesh.renderOrder = 1;
		vrControlPanel.add(seekBarTrackMesh);

		const seekBarProgressMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
		const seekBarProgressGeometry = new THREE.PlaneGeometry(WORLD_SEEK_BAR_WIDTH, WORLD_SEEK_BAR_PROGRESS_HEIGHT);
		seekBarProgressMesh = new THREE.Mesh(seekBarProgressGeometry, seekBarProgressMaterial);
		seekBarProgressMesh.name = "seekBarProgressVisual";
		seekBarProgressMesh.position.y = WORLD_SEEK_BAR_Y_OFFSET + (1 * SCALE_FACTOR);
		seekBarProgressMesh.position.x = -WORLD_SEEK_BAR_WIDTH / 2;
		seekBarProgressMesh.position.z = 0.015;
		seekBarProgressMesh.scale.x = 0.001;
		seekBarProgressMesh.renderOrder = 2;
		vrControlPanel.add(seekBarProgressMesh);

		const seekBarHitAreaGeometry = new THREE.PlaneGeometry(WORLD_SEEK_BAR_WIDTH, WORLD_SEEK_BAR_TRACK_HEIGHT * WORLD_SEEK_BAR_HIT_AREA_HEIGHT_MULTIPLIER);
		const seekBarHitAreaMaterial = new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 });
		seekBarHitAreaMesh = new THREE.Mesh(seekBarHitAreaGeometry, seekBarHitAreaMaterial);
		seekBarHitAreaMesh.name = "seekBarHitArea";
		seekBarHitAreaMesh.position.y = WORLD_SEEK_BAR_Y_OFFSET;
		seekBarHitAreaMesh.position.z = 0.012;
		seekBarHitAreaMesh.renderOrder = 2;
		vrControlPanel.add(seekBarHitAreaMesh);
		uiElements.push(seekBarHitAreaMesh);

		vrPlayPauseButtonCanvas = document.createElement('canvas');
		vrPlayPauseButtonCanvas.width = VR_BUTTON_TEXTURE_SIZE;
		vrPlayPauseButtonCanvas.height = VR_BUTTON_TEXTURE_SIZE;
		vrPlayPauseButtonContext = vrPlayPauseButtonCanvas.getContext('2d');
		vrPlayPauseButtonTexture = new THREE.CanvasTexture(vrPlayPauseButtonCanvas);
		vrPlayPauseButtonTexture.minFilter = THREE.LinearFilter;

		const playPauseButtonMaterial = new THREE.MeshBasicMaterial({
			map: vrPlayPauseButtonTexture,
			transparent: true,
			opacity: 0,
			depthWrite: false
		});

		const playPauseButtonWorldSize = FIGMA_PLAYPAUSE_BUTTON_SIZE_PX * SCALE_FACTOR;
		const playPauseButtonGeometry = new THREE.PlaneGeometry(playPauseButtonWorldSize, playPauseButtonWorldSize);
		vrPlayPauseButtonMesh = new THREE.Mesh(playPauseButtonGeometry, playPauseButtonMaterial);
		vrPlayPauseButtonMesh.name = "vrPlayPauseButton";
		vrPlayPauseButtonMesh.renderOrder = 3;

		const figmaPlayPauseButtonCenterX = FIGMA_PLAYPAUSE_BUTTON_X_PX;
		const figmaPlayPauseButtonCenterY = FIGMA_PLAYPAUSE_BUTTON_Y_PX;
		const worldPlayPauseButtonOffsetX = (figmaPlayPauseButtonCenterX - FIGMA_PANEL_WIDTH_PX / 2) * SCALE_FACTOR;
		const worldPlayPauseButtonOffsetY = -(figmaPlayPauseButtonCenterY - FIGMA_PANEL_HEIGHT_PX / 2) * SCALE_FACTOR;
		vrPlayPauseButtonMesh.position.set(worldPlayPauseButtonOffsetX, worldPlayPauseButtonOffsetY, 0.02);
		vrControlPanel.add(vrPlayPauseButtonMesh);
		uiElements.push(vrPlayPauseButtonMesh);

		const rewindButtonWorldSize = FIGMA_REWIND_BUTTON_SIZE_PX * SCALE_FACTOR;
		const rewindSVGPath = "M20.5021 19.1818V25H19.0987V20.4943H19.0646L17.7635 21.2898V20.0739L19.1982 19.1818H20.5021ZM24.0156 25.0795C23.5914 25.0795 23.2145 25.0028 22.8849 24.8494C22.5554 24.696 22.295 24.4848 22.1037 24.2159C21.9143 23.947 21.8158 23.6383 21.8082 23.2898H23.1719C23.1832 23.5038 23.2704 23.6761 23.4332 23.8068C23.5961 23.9356 23.7902 24 24.0156 24C24.1918 24 24.348 23.9612 24.4844 23.8835C24.6207 23.8059 24.7277 23.697 24.8054 23.5568C24.883 23.4148 24.9209 23.2519 24.919 23.0682C24.9209 22.8807 24.8821 22.7169 24.8026 22.5767C24.7249 22.4366 24.617 22.3277 24.4787 22.25C24.3423 22.1705 24.1851 22.1307 24.0071 22.1307C23.8385 22.1288 23.6785 22.1657 23.527 22.2415C23.3774 22.3172 23.2637 22.4205 23.1861 22.5511L21.9446 22.3182L22.1974 19.1818H25.9304V20.3153H23.3537L23.2202 21.6875H23.2543C23.3509 21.5265 23.5062 21.3939 23.7202 21.2898C23.9361 21.1837 24.1813 21.1307 24.456 21.1307C24.8045 21.1307 25.1151 21.2121 25.3878 21.375C25.6624 21.536 25.8783 21.7595 26.0355 22.0455C26.1946 22.3314 26.2741 22.6591 26.2741 23.0284C26.2741 23.428 26.1795 23.7822 25.9901 24.0909C25.8026 24.3996 25.5393 24.642 25.2003 24.8182C24.8632 24.9924 24.4683 25.0795 24.0156 25.0795Z M22 14.25C26.2802 14.25 29.75 17.7198 29.75 22C29.75 26.2802 26.2802 29.75 22 29.75C17.7198 29.75 14.25 26.2802 14.25 22C14.25 21.661 14.2742 21.3275 14.3164 21H15.8311C15.7787 21.3257 15.75 21.6595 15.75 22C15.75 25.4518 18.5482 28.25 22 28.25C25.4518 28.25 28.25 25.4518 28.25 22C28.25 18.5482 25.4518 15.75 22 15.75C20.5176 15.75 19.1563 16.2666 18.085 17.1289L18.459 17.4775C18.5996 17.6088 18.5452 17.8431 18.3613 17.8994L15.877 18.6592C15.693 18.7154 15.5166 18.5516 15.5596 18.3643L16.1445 15.832C16.1881 15.6449 16.418 15.5749 16.5586 15.7061L16.9785 16.0977C18.3312 14.9459 20.0842 14.25 22 14.25Z";
		const rewindButtonTexture = createButtonTexture(rewindSVGPath, '#ffffff', 'rgba(0,0,0,0)', VR_BUTTON_TEXTURE_SIZE, 0, true, FIGMA_REWIND_BUTTON_SIZE_PX);
		const rewindButtonMaterial = new THREE.MeshBasicMaterial({ map: rewindButtonTexture, transparent: true, opacity: 0, depthWrite: false });
		const rewindButtonGeometry = new THREE.PlaneGeometry(rewindButtonWorldSize, rewindButtonWorldSize);
		vrRewindButtonMesh = new THREE.Mesh(rewindButtonGeometry, rewindButtonMaterial);
		vrRewindButtonMesh.name = "vrRewindButton";
		vrRewindButtonMesh.renderOrder = 3;
		const figmaRewindButtonCenterX = FIGMA_REWIND_BUTTON_X_PX;
		const figmaRewindButtonCenterY = FIGMA_REWIND_BUTTON_Y_PX;
		const worldRewindButtonOffsetX = (figmaRewindButtonCenterX - FIGMA_PANEL_WIDTH_PX / 2) * SCALE_FACTOR;
		const worldRewindButtonOffsetY = -(figmaRewindButtonCenterY - FIGMA_PANEL_HEIGHT_PX / 2) * SCALE_FACTOR;
		vrRewindButtonMesh.position.set(worldRewindButtonOffsetX, worldRewindButtonOffsetY, 0.02);
		vrControlPanel.add(vrRewindButtonMesh);
		uiElements.push(vrRewindButtonMesh);

		const forwardButtonWorldSize = FIGMA_FORWARD_BUTTON_SIZE_PX * SCALE_FACTOR;
		const forwardSVGPath = "M20.5021 19.1818V25H19.0987V20.4943H19.0646L17.7635 21.2898V20.0739L19.1982 19.1818H20.5021ZM24.0156 25.0795C23.5914 25.0795 23.2145 25.0028 22.8849 24.8494C22.5554 24.696 22.295 24.4848 22.1037 24.2159C21.9143 23.947 21.8158 23.6383 21.8082 23.2898H23.1719C23.1832 23.5038 23.2704 23.6761 23.4332 23.8068C23.5961 23.9356 23.7902 24 24.0156 24C24.1918 24 24.348 23.9612 24.4844 23.8835C24.6207 23.8059 24.7277 23.697 24.8054 23.5568C24.883 23.4148 24.9209 23.2519 24.919 23.0682C24.9209 22.8807 24.8821 22.7169 24.8026 22.5767C24.7249 22.4366 24.617 22.3277 24.4787 22.25C24.3423 22.1705 24.1851 22.1307 24.0071 22.1307C23.8385 22.1288 23.6785 22.1657 23.527 22.2415C23.3774 22.3172 23.2637 22.4205 23.1861 22.5511L21.9446 22.3182L22.1974 19.1818H25.9304V20.3153H23.3537L23.2202 21.6875H23.2543C23.3509 21.5265 23.5062 21.3939 23.7202 21.2898C23.9361 21.1837 24.1813 21.1307 24.456 21.1307C24.8045 21.1307 25.1151 21.2121 25.3878 21.375C25.6624 21.536 25.8783 21.7595 26.0355 22.0455C26.1946 22.3314 26.2741 22.6591 26.2741 23.0284C26.2741 23.428 26.1795 23.7822 25.9901 24.0909C25.8026 24.3996 25.5393 24.642 25.2003 24.8182C24.8632 24.9924 24.4683 25.0795 24.0156 25.0795Z M22 14.25C17.7198 14.25 14.25 17.7198 14.25 22C14.25 26.2802 17.7198 29.75 22 29.75C26.2802 29.75 29.75 26.2802 29.75 22C29.75 21.661 29.7258 21.3275 29.6836 21H28.1689C28.2213 21.3257 28.25 21.6595 28.25 22C28.25 25.4518 25.4518 28.25 22 28.25C18.5482 28.25 15.75 25.4518 15.75 22C15.75 18.5482 18.5482 15.75 22 15.75C23.4824 15.75 24.8437 16.2666 25.915 17.1289L25.541 17.4775C25.4004 17.6088 25.4548 17.8431 25.6387 17.8994L28.123 18.6592C28.307 18.7154 28.4834 18.5516 28.4404 18.3643L27.8555 15.832C27.8119 15.6449 27.582 15.5749 27.4414 15.7061L27.0215 16.0977C25.6688 14.9459 23.9158 14.25 22 14.25Z";
		const forwardButtonTexture = createButtonTexture(forwardSVGPath, '#ffffff', 'rgba(0,0,0,0)', VR_BUTTON_TEXTURE_SIZE, 0, true, FIGMA_FORWARD_BUTTON_SIZE_PX);
		const forwardButtonMaterial = new THREE.MeshBasicMaterial({ map: forwardButtonTexture, transparent: true, opacity: 0, depthWrite: false });
		const forwardButtonGeometry = new THREE.PlaneGeometry(forwardButtonWorldSize, forwardButtonWorldSize);
		vrForwardButtonMesh = new THREE.Mesh(forwardButtonGeometry, forwardButtonMaterial);
		vrForwardButtonMesh.name = "vrForwardButton";
		vrForwardButtonMesh.renderOrder = 3;
		const figmaForwardButtonCenterX = FIGMA_FORWARD_BUTTON_X_PX;
		const figmaForwardButtonCenterY = FIGMA_FORWARD_BUTTON_Y_PX;
		const worldForwardButtonOffsetX = (figmaForwardButtonCenterX - FIGMA_PANEL_WIDTH_PX / 2) * SCALE_FACTOR;
		const worldForwardButtonOffsetY = -(figmaForwardButtonCenterY - FIGMA_PANEL_HEIGHT_PX / 2) * SCALE_FACTOR;
		vrForwardButtonMesh.position.set(worldForwardButtonOffsetX, worldForwardButtonOffsetY, 0.02);
		vrControlPanel.add(vrForwardButtonMesh);
		uiElements.push(vrForwardButtonMesh);

		const exitButtonWorldSize = FIGMA_EXIT_BUTTON_SIZE_PX * SCALE_FACTOR;
		const exitSVGPath = "M17.5264 17.418C17.8209 17.1778 18.2557 17.1953 18.5303 17.4698C18.8049 17.7444 18.8223 18.1791 18.582 18.4737L18.5303 18.5303L15.8105 21.2501H26C26.4142 21.2501 26.7499 21.5859 26.75 22.0001C26.75 22.4143 26.4142 22.7501 26 22.7501H15.8105L18.5303 25.4698L18.582 25.5264C18.8223 25.821 18.8048 26.2557 18.5303 26.5303C18.2557 26.8049 17.8209 26.8224 17.5264 26.5821L17.4697 26.5303L13.4697 22.5303L13.418 22.4737C13.4075 22.4608 13.3982 22.4471 13.3887 22.4337C13.3787 22.4196 13.3704 22.4045 13.3613 22.3897C13.3475 22.3671 13.3354 22.344 13.3242 22.3204C13.3187 22.3088 13.3115 22.2981 13.3066 22.2862C13.3029 22.2772 13.3002 22.2679 13.2969 22.2589C13.2874 22.2329 13.281 22.2064 13.2744 22.1798C13.2721 22.1702 13.2676 22.1611 13.2656 22.1514L13.2637 22.1436C13.2632 22.1414 13.2631 22.139 13.2627 22.1368C13.2616 22.1309 13.2607 22.1251 13.2598 22.1192C13.258 22.1081 13.2561 22.0971 13.2549 22.086C13.2517 22.0578 13.25 22.0291 13.25 22.0001C13.25 21.9912 13.2507 21.9825 13.251 21.9737C13.2512 21.9669 13.2515 21.96 13.252 21.9532C13.2537 21.9244 13.2568 21.896 13.2617 21.8682C13.2629 21.8617 13.2643 21.8552 13.2656 21.8487C13.2662 21.8458 13.2669 21.8428 13.2676 21.8399C13.2748 21.8067 13.286 21.7745 13.2979 21.7423C13.3012 21.733 13.3029 21.7231 13.3066 21.7139C13.3079 21.7108 13.3082 21.7073 13.3096 21.7042C13.3234 21.6718 13.3427 21.6419 13.3613 21.6114C13.3667 21.6026 13.3702 21.5927 13.376 21.584C13.3784 21.5804 13.3813 21.5769 13.3838 21.5733C13.409 21.537 13.4374 21.5021 13.4697 21.4698L17.4697 17.4698L17.5264 17.418Z M25.0381 16.0322H28.5C29.7425 16.0322 30.7498 17.0398 30.75 18.2822V25.7168C30.75 26.9594 29.7426 27.9668 28.5 27.9668H23V27.9648L22.9229 27.9609C22.5449 27.9223 22.25 27.603 22.25 27.2148C22.2501 26.8007 22.5859 26.4648 23 26.4648H25C25.0128 26.4648 25.0255 26.4662 25.0381 26.4668H28.5C28.9142 26.4668 29.25 26.131 29.25 25.7168V18.2822C29.2498 17.8682 28.9141 17.5322 28.5 17.5322H23V17.5303L22.9229 17.5264C22.5449 17.4878 22.2501 17.1683 22.25 16.7803C22.25 16.3661 22.5858 16.0303 23 16.0303H25C25.0128 16.0303 25.0254 16.0316 25.0381 16.0322Z";
		const exitButtonTexture = createButtonTexture(exitSVGPath, '#ffffff', 'rgba(0,0,0,0)', VR_BUTTON_TEXTURE_SIZE, 0, true, FIGMA_EXIT_BUTTON_SIZE_PX);
		const exitButtonMaterial = new THREE.MeshBasicMaterial({ map: exitButtonTexture, transparent: true, opacity: 0, depthWrite: false });
		const exitButtonGeometry = new THREE.PlaneGeometry(exitButtonWorldSize, exitButtonWorldSize);
		vrExitButtonMesh = new THREE.Mesh(exitButtonGeometry, exitButtonMaterial);
		vrExitButtonMesh.name = "vrExitButton";
		vrExitButtonMesh.renderOrder = 3;
		const figmaExitButtonCenterX = FIGMA_EXIT_BUTTON_X_PX;
		const figmaExitButtonCenterY = FIGMA_EXIT_BUTTON_Y_PX;
		const worldExitButtonOffsetX = (figmaExitButtonCenterX - FIGMA_PANEL_WIDTH_PX / 2) * SCALE_FACTOR;
		const worldExitButtonOffsetY = -(figmaExitButtonCenterY - FIGMA_PANEL_HEIGHT_PX / 2) * SCALE_FACTOR;
		vrExitButtonMesh.position.set(worldExitButtonOffsetX, worldExitButtonOffsetY, 0.02);
		vrControlPanel.add(vrExitButtonMesh);
		uiElements.push(vrExitButtonMesh);

		vrVolumeButtonCanvas = document.createElement('canvas');
		vrVolumeButtonCanvas.width = VR_BUTTON_TEXTURE_SIZE;
		vrVolumeButtonCanvas.height = VR_BUTTON_TEXTURE_SIZE;
		vrVolumeButtonContext = vrVolumeButtonCanvas.getContext('2d');
		vrVolumeButtonTexture = new THREE.CanvasTexture(vrVolumeButtonCanvas);
		vrVolumeButtonTexture.minFilter = THREE.LinearFilter;
		const volumeButtonMaterial = new THREE.MeshBasicMaterial({ map: vrVolumeButtonTexture, transparent: true, opacity: 0, depthWrite: false });
		const volumeButtonWorldSize = FIGMA_VOLUME_BUTTON_SIZE_PX * SCALE_FACTOR;
		const volumeButtonGeometry = new THREE.PlaneGeometry(volumeButtonWorldSize, volumeButtonWorldSize);
		vrVolumeButtonMesh = new THREE.Mesh(volumeButtonGeometry, volumeButtonMaterial);
		vrVolumeButtonMesh.name = "vrVolumeButton";
		vrVolumeButtonMesh.renderOrder = 3;
		const figmaVolumeButtonCenterX = FIGMA_VOLUME_BUTTON_X_PX;
		const figmaVolumeButtonCenterY = FIGMA_VOLUME_BUTTON_Y_PX;
		const worldVolumeButtonOffsetX = (figmaVolumeButtonCenterX - FIGMA_PANEL_WIDTH_PX / 2) * SCALE_FACTOR;
		const worldVolumeButtonOffsetY = -(figmaVolumeButtonCenterY - FIGMA_PANEL_HEIGHT_PX / 2) * SCALE_FACTOR;
		vrVolumeButtonMesh.position.set(worldVolumeButtonOffsetX, worldVolumeButtonOffsetY, 0.02);
		vrControlPanel.add(vrVolumeButtonMesh);
		uiElements.push(vrVolumeButtonMesh);

		vrControlPanel.visible = false;
		panelOpacity = 0;
		panelTargetOpacity = 0;

		controller1 = renderer.xr.getController(0);
		controller1.addEventListener('selectstart', onSelectStartVR);
		const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
		const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)]);
		controller1.add(new THREE.Line(lineGeometry, lineMaterial));
		scene.add(controller1);
		raycaster = new THREE.Raycaster();
		raycaster.near = 0.1; raycaster.far = 5;
	} catch (e) {
		console.error("INIT_ERROR (Phase 2 - VR Controls Setup):", e);
	}

	try { // Phase 3: Event Listeners
		if (playBtn) {
			playBtn.addEventListener('click', handleEnterVRButtonClick);
		}
		window.addEventListener('resize', onWindowResize);

		if (video) {
		video.onloadedmetadata = () => {
			if (isFinite(video.duration) && playBtn) {
				// Enable button for both VR and non-VR scenarios when video is ready
				playBtn.disabled = false;
			}
			updateSeekBarAppearance();
			updateVRPlayPauseButtonIcon();
			updateVRVolumeButtonIcon();
			update2DControlPanel();
			update2DMuteButton();
		};
			video.oncanplaythrough = () => {
				if (playBtn && video.readyState >= video.HAVE_FUTURE_DATA) {
					// Enable button for both VR and non-VR scenarios when video is ready to play
					playBtn.disabled = false;
				}
			};
			video.ontimeupdate = () => {
				if (isFinite(video.duration)) {
					updateSeekBarAppearance();
					update2DControlPanel();
				}
			};
			video.onplaying = () => {
				updateVRPlayPauseButtonIcon();
				update2DPlayPauseButton();
			};
			video.onpause = () => {
				updateVRPlayPauseButtonIcon();
				update2DPlayPauseButton();
			};
			video.onerror = (e) => {
				const videoError = video.error;
				const errorDetail = videoError ? `Code: ${videoError.code}, Message: ${videoError.message}` : 'Unknown error';
				console.error("VIDEO_ERROR_EVENT:", e, "Details:", errorDetail);
				if (playBtn) playBtn.disabled = true;
			};
			video.addEventListener('ended', onVideoEnded);
			video.addEventListener('volumechange', updateVRVolumeButtonIcon);
			video.addEventListener('volumechange', update2DMuteButton);
		}
		
		// Initialize 2D control panel
		init2DControlPanel();
	} catch (e) {
		console.error("INIT_ERROR (Phase 3 - Event Listeners):", e);
	}
}


function updateVRPlayPauseButtonIcon() {
	if (!vrPlayPauseButtonContext || !vrPlayPauseButtonTexture || !video) {
		return;
	}
	const ctx = vrPlayPauseButtonContext;
	const canvas = vrPlayPauseButtonCanvas;
	const tempViewBoxSize = 44;
	const iconScale = canvas.width / tempViewBoxSize;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "#ffffff";
	ctx.save();
	const scaledIconSize = tempViewBoxSize * iconScale;
	ctx.translate((canvas.width - scaledIconSize) / 2, (canvas.height - scaledIconSize) / 2);
	ctx.scale(iconScale, iconScale);
	if (video.paused || video.ended) {
		const playPath = new Path2D("M32.3859 20.4038C33.4457 21.204 33.4457 22.796 32.3859 23.5962L18.2051 34.3026C16.8874 35.2974 15 34.3575 15 32.7064V11.2936C15 9.64253 16.8874 8.70258 18.2051 9.69741L32.3859 20.4038Z");
		ctx.fill(playPath);
	} else {
		const rectX1 = 16; const rectX2 = 23;
		const rectY = 9; const rectWidth = 5; const rectHeight = 26;
		const rectRx = 2;
		drawRoundedRect(ctx, rectX1, rectY, rectWidth, rectHeight, rectRx, true, false);
		drawRoundedRect(ctx, rectX2, rectY, rectWidth, rectHeight, rectRx, true, false);
	}
	ctx.restore();
	vrPlayPauseButtonTexture.needsUpdate = true;
}

function updateVRVolumeButtonIcon() {
	if (!vrVolumeButtonContext || !vrVolumeButtonTexture || !video) {
		return;
	}
	const ctx = vrVolumeButtonContext;
	const canvas = vrVolumeButtonCanvas;
	const svgPathNaturalViewBoxSize = 24;
	const referenceDisplayViewBoxSize = 44;
	const iconScale = canvas.width / referenceDisplayViewBoxSize;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "#ffffff";
	ctx.save();
	const pathRenderScale = iconScale;
	const pathOffsetX = (canvas.width - (svgPathNaturalViewBoxSize * pathRenderScale)) / 2;
	const pathOffsetY = (canvas.height - (svgPathNaturalViewBoxSize * pathRenderScale)) / 2;
	ctx.translate(pathOffsetX, pathOffsetY);
	ctx.scale(pathRenderScale, pathRenderScale);
	if (video.muted || video.volume === 0) {
		const mutedPath = new Path2D(SOUND_MUTED_SVG_PATH);
		ctx.fill(mutedPath);
	} else {
		const soundOnPath = new Path2D(SOUND_ON_SVG_PATH);
		ctx.fill(soundOnPath);
	}
	ctx.restore();
	vrVolumeButtonTexture.needsUpdate = true;
}

function updateSeekBarAppearance() {
	if (video && isFinite(video.duration) && video.duration > 0 && seekBarProgressMesh) {
		const progress = video.currentTime / video.duration;
		seekBarProgressMesh.scale.x = Math.max(0.0001, progress);
		seekBarProgressMesh.position.x = -WORLD_SEEK_BAR_WIDTH / 2 + (WORLD_SEEK_BAR_WIDTH * progress) / 2;
	} else if (seekBarProgressMesh) {
		seekBarProgressMesh.scale.x = 0.0001;
		seekBarProgressMesh.position.x = -WORLD_SEEK_BAR_WIDTH / 2;
	}
}

function animatePanelFade(timestamp) {
	if (!vrControlPanel) return;
	if (lastFadeTimestamp === 0) lastFadeTimestamp = timestamp;
	const deltaTime = (timestamp - lastFadeTimestamp) / 1000;
	lastFadeTimestamp = timestamp;
	const FADE_SPEED = 1 / (FADE_DURATION_MS / 1000);
	let opacityChanged = false;
	if (panelOpacity < panelTargetOpacity) {
		panelOpacity += FADE_SPEED * deltaTime;
		if (panelOpacity >= panelTargetOpacity) {
			panelOpacity = panelTargetOpacity;
			isPanelFading = false;
		}
		opacityChanged = true;
	} else if (panelOpacity > panelTargetOpacity) {
		panelOpacity -= FADE_SPEED * deltaTime;
		if (panelOpacity <= panelTargetOpacity) {
			panelOpacity = panelTargetOpacity;
			isPanelFading = false;
			if (panelOpacity === 0) vrControlPanel.visible = false;
		}
		opacityChanged = true;
	} else {
		isPanelFading = false;
	}
	if (opacityChanged) {
		vrControlPanel.children.forEach(child => {
			if (child.material && child.material.hasOwnProperty('opacity')) {
				child.material.opacity = panelOpacity;
			}
		});
	}
	if (isPanelFading) requestAnimationFrame(animatePanelFade);
}

function showPanel() {
	if (vrControlPanel) vrControlPanel.visible = true;
	clearTimeout(panelHideTimeout);
	if (panelTargetOpacity !== 1.0 || panelOpacity < 1.0) {
		panelTargetOpacity = 1.0;
		if (!isPanelFading) {
			isPanelFading = true;
			lastFadeTimestamp = 0;
			requestAnimationFrame(animatePanelFade);
		}
	}
	panelHideTimeout = setTimeout(hidePanel, AUTO_HIDE_DELAY_MS);
}

function hidePanel() {
	clearTimeout(panelHideTimeout);
	if (panelTargetOpacity !== 0.0 || panelOpacity > 0.0) {
		panelTargetOpacity = 0.0;
		if (!isPanelFading) {
			isPanelFading = true;
			lastFadeTimestamp = 0;
			requestAnimationFrame(animatePanelFade);
		}
	}
}

function onWindowResize() {
	if (!renderer) return;
	if (renderer.xr && renderer.xr.isPresenting) return;
	
	if (is2DMode) {
		// In 2D mode, calculate canvas size based on container dimensions
		const container = document.getElementById('vr-container');
		if (container) {
			const containerRect = container.getBoundingClientRect();
			const containerWidth = containerRect.width;
			
			// Calculate height based on 16:9 aspect ratio
			const aspectRatio = 16 / 9;
			const calculatedHeight = containerWidth / aspectRatio;
			
			// Ensure minimum dimensions to prevent zero-sized canvas
			const canvasWidth = Math.max(containerWidth, 320);
			const canvasHeight = Math.max(calculatedHeight, 180);
			
			renderer.setSize(canvasWidth, canvasHeight);
			camera2D.aspect = canvasWidth / canvasHeight;
			camera2D.updateProjectionMatrix();
			
			// Update canvas styling to maintain proper positioning
			const canvas = renderer.domElement;
			canvas.style.width = '100%';
			canvas.style.height = 'auto';
			canvas.style.aspectRatio = '16/9';
			
			// Reposition control panel after resize
			position2DControlPanel();
		}
	} else {
		// Normal VR/window mode
		if (camera && renderer.domElement.style.display !== 'none') {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		} else if (camera) {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		}
		
		// Update 2D camera aspect ratio for potential future use
		if (camera2D) {
			camera2D.aspect = window.innerWidth / window.innerHeight;
			camera2D.updateProjectionMatrix();
		}
	}
}

// 2D Camera Control Functions
function updateCameraRotation() {
	if (!camera2D) return;
	
	// Apply momentum
	cameraRotation.yaw += cameraVelocity.yaw;
	cameraRotation.pitch += cameraVelocity.pitch;
	
	// Constrain pitch (vertical rotation)
	cameraRotation.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, cameraRotation.pitch));
	
	// Constrain yaw (horizontal rotation) to VR180 content boundaries
	cameraRotation.yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, cameraRotation.yaw));
	
	// Apply damping to velocity
	cameraVelocity.yaw *= MOMENTUM_DAMPING;
	cameraVelocity.pitch *= MOMENTUM_DAMPING;
	
	// Stop very small velocities
	if (Math.abs(cameraVelocity.yaw) < 0.001) cameraVelocity.yaw = 0;
	if (Math.abs(cameraVelocity.pitch) < 0.001) cameraVelocity.pitch = 0;
	
	// Apply rotation to camera
	camera2D.rotation.set(cameraRotation.pitch, cameraRotation.yaw, 0);
}

// Mouse Controls
function onMouseDown(event) {
	if (!is2DMode) return;
	isDragging = true;
	lastMouseX = event.clientX;
	lastMouseY = event.clientY;
	cameraVelocity.yaw = 0;
	cameraVelocity.pitch = 0;
	
	// Hide controls when dragging starts
	hide2DControlPanel();
}

function onMouseMove(event) {
	if (!is2DMode || !isDragging) return;
	
	const deltaX = event.clientX - lastMouseX;
	const deltaY = event.clientY - lastMouseY;
	
	cameraVelocity.yaw = deltaX * MOUSE_SENSITIVITY;
	cameraVelocity.pitch = deltaY * MOUSE_SENSITIVITY;
	
	lastMouseX = event.clientX;
	lastMouseY = event.clientY;
}

function onMouseUp(event) {
	if (!is2DMode) return;
	isDragging = false;
	
	// Show controls when dragging ends
	show2DControlPanel();
}

// Touch Controls
function onTouchStart(event) {
	if (!is2DMode) return;
	event.preventDefault();
	if (event.touches.length === 1) {
		isDragging = true;
		lastTouchX = event.touches[0].clientX;
		lastTouchY = event.touches[0].clientY;
		cameraVelocity.yaw = 0;
		cameraVelocity.pitch = 0;
		
		// Hide controls when dragging starts
		hide2DControlPanel();
	}
}

function onTouchMove(event) {
	if (!is2DMode || !isDragging) return;
	event.preventDefault();
	
	if (event.touches.length === 1) {
		const deltaX = event.touches[0].clientX - lastTouchX;
		const deltaY = event.touches[0].clientY - lastTouchY;
		
		cameraVelocity.yaw = deltaX * TOUCH_SENSITIVITY;
		cameraVelocity.pitch = deltaY * TOUCH_SENSITIVITY;
		
		lastTouchX = event.touches[0].clientX;
		lastTouchY = event.touches[0].clientY;
	}
}

function onTouchEnd(event) {
	if (!is2DMode) return;
	event.preventDefault();
	isDragging = false;
	
	// Show controls when dragging ends
	show2DControlPanel();
}

// 2D Render Loop
function render2D() {
	if (!is2DMode) return;
	
	updateCameraRotation();
	
	if (renderer && camera2D && scene) {
		renderer.render(scene, camera2D);
	}
	
	requestAnimationFrame(render2D);
}

// 2D Control Panel Functions
function init2DControlPanel() {
	// Get references to 2D control elements
	controlPanel = document.getElementById('panel');
	videoTitle = document.getElementById('video-title');
	currentTimeDisplay = document.getElementById('current-time');
	totalTimeDisplay = document.getElementById('total-time');
	progressBar = document.getElementById('bar');
	playedBar = document.getElementById('played');
	fullscreenBtn = document.getElementById('fullscreen');
	backBtn = document.getElementById('back');
	play2Btn = document.getElementById('play2');
	forwardBtn = document.getElementById('forward');
	muteBtn = document.getElementById('mute');

	if (!controlPanel) {
		console.error("2D Control panel not found");
		return;
	}

	// Set initial video title
	if (videoTitle && video) {
		const title = video.getAttribute('title') || 
					  video.querySelector('source')?.src.split('/').pop()?.split('.')[0].replace(/-/g, ' ') || 
					  "Demo Video";
		videoTitle.textContent = title;
	}

	// Add event listeners for 2D controls
	if (fullscreenBtn) {
		fullscreenBtn.addEventListener('click', toggle2DFullscreen);
	}
	
	if (backBtn) {
		backBtn.addEventListener('click', () => {
			if (video) {
				video.currentTime = Math.max(0, video.currentTime - 15);
			}
			show2DControlPanel();
		});
	}
	
	if (play2Btn) {
		play2Btn.addEventListener('click', () => {
			togglePlayPause();
			show2DControlPanel();
		});
	}
	
	if (forwardBtn) {
		forwardBtn.addEventListener('click', () => {
			if (video && isFinite(video.duration)) {
				video.currentTime = Math.min(video.duration, video.currentTime + 15);
			}
			show2DControlPanel();
		});
	}
	
	if (muteBtn) {
		muteBtn.addEventListener('click', () => {
			if (video) {
				video.muted = !video.muted;
			}
			show2DControlPanel();
		});
	}
	
	if (progressBar) {
		progressBar.addEventListener('click', (e) => {
			if (video && isFinite(video.duration)) {
				const rect = progressBar.getBoundingClientRect();
				const clickX = e.clientX - rect.left;
				const progress = clickX / rect.width;
				video.currentTime = progress * video.duration;
			}
			show2DControlPanel();
		});
	}

	// Mouse movement listener will be added to canvas in start2DMode
	document.addEventListener('touchstart', on2DTouchStart);
}

function show2DControlPanel() {
	if (!is2DMode || !controlPanel) return;
	
	clearTimeout(controlPanelTimeout);
	controlPanel.classList.add('visible');
	isControlPanelVisible = true;
	
	controlPanelTimeout = setTimeout(hide2DControlPanel, CONTROL_PANEL_HIDE_DELAY);
}

function hide2DControlPanel() {
	if (!controlPanel) return;
	
	clearTimeout(controlPanelTimeout);
	controlPanel.classList.remove('visible');
	isControlPanelVisible = false;
}

function onCanvasMouseMove() {
	if (is2DMode && !isDragging) {
		show2DControlPanel();
	}
}

function on2DMouseMove() {
	if (is2DMode) {
		show2DControlPanel();
	}
}

function on2DTouchStart() {
	if (is2DMode && !isDragging) {
		show2DControlPanel();
	}
}

function update2DControlPanel() {
	if (!is2DMode || !video) return;
	
	// Update time displays
	if (currentTimeDisplay) {
		currentTimeDisplay.textContent = formatTime(video.currentTime);
	}
	
	if (totalTimeDisplay && isFinite(video.duration)) {
		totalTimeDisplay.textContent = formatTime(video.duration);
	}
	
	// Update progress bar
	if (playedBar && isFinite(video.duration) && video.duration > 0) {
		const progress = (video.currentTime / video.duration) * 100;
		playedBar.style.width = `${progress}%`;
	}
}

function update2DPlayPauseButton() {
	if (!is2DMode || !play2Btn || !video) return;
	
	if (video.paused || video.ended) {
		play2Btn.classList.remove('playing');
		play2Btn.classList.add('paused');
	} else {
		play2Btn.classList.remove('paused');
		play2Btn.classList.add('playing');
	}
}

function update2DMuteButton() {
	if (!is2DMode || !muteBtn || !video) return;
	
	if (video.muted) {
		// Video is muted, show unmute icon (user can click to unmute)
		muteBtn.classList.remove('muted');
		muteBtn.classList.add('unmuted');
	} else {
		// Video is unmuted, show mute icon (user can click to mute)
		muteBtn.classList.remove('unmuted');
		muteBtn.classList.add('muted');
	}
}

function toggle2DFullscreen() {
	if (!document.fullscreenElement) {
		// Enter fullscreen
		const container = document.getElementById('vr-container');
		if (container && container.requestFullscreen) {
			container.requestFullscreen().catch(err => {
				console.error('Error attempting to enable fullscreen:', err);
			});
		}
	} else {
		// Exit fullscreen
		if (document.exitFullscreen) {
			document.exitFullscreen().catch(err => {
				console.error('Error attempting to exit fullscreen:', err);
			});
		}
	}
}

function handle2DVideoEnd() {
	if (!is2DMode || !video) return;
	
	// Keep video at last frame (don't reset currentTime)
	// Video is already paused by onVideoEnded()
	
	// Show control panel and keep it visible (no auto-hide timeout)
	if (controlPanel) {
		clearTimeout(controlPanelTimeout);
		controlPanel.classList.add('visible');
		isControlPanelVisible = true;
		// Don't set timeout - panel stays visible until user interacts
	}
	
	// Update play button to show replay state
	update2DPlayPauseButton();
}

function position2DControlPanel() {
	if (!is2DMode || !controlPanel || !renderer) return;
	
	// Get the canvas dimensions and position
	const canvas = renderer.domElement;
	const canvasRect = canvas.getBoundingClientRect();
	const containerRect = document.getElementById('vr-container').getBoundingClientRect();
	
	// Calculate 10% from the bottom of the canvas
	const bottomOffset = canvasRect.height * 0.1;
	
	// Get the panel's height
	const panelHeight = controlPanel.offsetHeight;
	
	// Calculate the top position: canvas bottom minus offset minus panel height, relative to container
	const topPosition = (canvasRect.bottom - containerRect.top) - bottomOffset - panelHeight;
	
	// Position the panel so its bottom edge is 10% from canvas bottom
	controlPanel.style.position = 'absolute';
	controlPanel.style.top = `${topPosition}px`;
	controlPanel.style.bottom = 'auto'; // Clear any previous bottom positioning
	controlPanel.style.left = '50%';
	controlPanel.style.transform = 'translateX(-50%)';
	controlPanel.style.zIndex = '1000'; // Ensure it's above the canvas
}

function formatTime(seconds) {
	if (!isFinite(seconds)) return '00:00:00';
	
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	
	if (hours > 0) {
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	} else {
		return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
}

function hidePlayButton() {
	if (playBtn) {
		playBtn.classList.add('hidden');
	}
}

function enableNativeControls() {
	if (video) {
		video.controls = true;
	}
}

function togglePlayPause() {
	if (!video || !video.currentSrc) return;
	if (video.paused || video.ended) {
		// If video has ended in 2D mode, restart from beginning
		if (video.ended && is2DMode) {
			video.currentTime = 0;
		}
		
		if (video.readyState >= video.HAVE_ENOUGH_DATA || video.currentSrc) {
			const playPromise = video.play();
			if (playPromise !== undefined) {
				playPromise.then(() => {
					// Resume normal control panel auto-hide behavior after restart
					if (is2DMode && video.ended === false) {
						show2DControlPanel();
					}
				}).catch(err => console.error("Error during video.play():", err));
			} else {
				console.error("video.play() did not return a promise.");
			}
		}
	} else {
		video.pause();
	}
}

function resetToOriginalState() {
	// Reset video to show poster frame
	if (video) {
		video.pause();
		video.currentTime = 0;
		video.controls = false; // Disable native controls
		
		// Force video back to poster state by reloading
		video.load();
	}
	
	// Show the play button in center position
	if (playBtn) {
		playBtn.classList.remove('hidden');
		playBtn.disabled = false;
	}
	
	// Reset 2D mode if it was active
	if (is2DMode) {
		is2DMode = false;
		remove2DEventListeners();
		
		// Hide 2D control panel
		hide2DControlPanel();
		
		// Reset camera rotation
		cameraRotation = { yaw: 0, pitch: 0 };
		cameraVelocity = { yaw: 0, pitch: 0 };
		isDragging = false;
		
		// Hide WebGL canvas and show video element
		if (renderer && renderer.domElement) {
			renderer.domElement.style.display = 'none';
		}
		if (video) {
			video.style.display = '';
		}
		
		// Reset renderer size
		onWindowResize();
	}
}

function onVideoEnded() {
	if (video && !video.paused) video.pause();
	
	if (xrSession && renderer && renderer.xr.isPresenting) {
		// VR mode - exit VR and reset to original state
		actualSessionToggle().catch(err => {
			console.error("Error during automatic VR exit on video end:", err);
			// Fallback cleanup if actualSessionToggle fails or doesn't fully clean up
			if(xrSession) { // Check if session still exists
				const sessionToClean = xrSession;
				xrSession = null; // Nullify global ref
				sessionToClean.removeEventListener('end', onVRSessionEnd);
				sessionToClean.end().catch(e => {}).finally(() => onVRSessionEnd({session: sessionToClean}));
			} else {
				 onVRSessionEnd({session: null}); // Call with null session if already gone
			}
		});
	} else if (is2DMode) {
		// 2D mode - stay on last frame with controls visible
		handle2DVideoEnd();
	} else {
		// Regular mode - reset to original state
		resetToOriginalState();
	}
}

function onSelectStartVR(event) {
	const controller = event.target;
	if (!raycaster) return;
	controller.updateMatrixWorld();
	tempMatrix.identity().extractRotation(controller.matrixWorld);
	raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
	raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
	const allInteractables = [...uiElements];
	const directIntersects = raycaster.intersectObjects(allInteractables, true);
	if (directIntersects.length > 0) {
		const firstIntersected = directIntersects[0].object;
		const intersectionPoint = directIntersects[0].point;
		if (firstIntersected.name === "vrPlayPauseButton") {
			togglePlayPause(); showPanel();
		} else if (firstIntersected.name === "vrRewindButton") {
			if (video) { video.currentTime = Math.max(0, video.currentTime - 15); updateSeekBarAppearance(); }
			showPanel();
		} else if (firstIntersected.name === "vrForwardButton") {
			if (video && isFinite(video.duration)) { video.currentTime = Math.min(video.duration, video.currentTime + 15); updateSeekBarAppearance(); }
			showPanel();
		} else if (firstIntersected.name === "vrExitButton") {
			if (xrSession) actualSessionToggle(); // Should trigger exit
			showPanel(); // Keep panel briefly visible or hide, depending on desired UX
		} else if (firstIntersected.name === "vrVolumeButton") {
			if (video) video.muted = !video.muted;
			showPanel();
		} else if (firstIntersected.name === "seekBarHitArea" && video && isFinite(video.duration)) {
			showPanel();
			const localPoint = seekBarTrackMesh.worldToLocal(intersectionPoint.clone());
			const normalizedPosition = (localPoint.x + WORLD_SEEK_BAR_WIDTH / 2) / WORLD_SEEK_BAR_WIDTH;
			const newTime = Math.max(0, Math.min(1, normalizedPosition)) * video.duration;
			video.currentTime = newTime;
			updateSeekBarAppearance();
		} else if (firstIntersected.name === "vrControlPanelBackground" || firstIntersected.name === "vr180Mesh") {
			if (vrControlPanel && vrControlPanel.visible && panelOpacity > 0.01) hidePanel(); else showPanel();
		} else {
			if (vrControlPanel && vrControlPanel.visible && panelOpacity > 0.01) hidePanel(); else showPanel();
		}
	} else {
		if (vrControlPanel && vrControlPanel.visible && panelOpacity > 0.01) hidePanel(); else showPanel();
	}
}

async function handleEnterVRButtonClick() {
	if (!video) {
		console.error("Video element not found for VR button click.");
		return;
	}
	
	// Hide the play button after click
	hidePlayButton();
	
	// Check if VR is supported
	if (playBtn.dataset.xrSupported === "true") {
		// VR is supported - use VR functionality
		await actualSessionToggle();
	} else {
		// VR is not supported - start 2D rectilinear mode
		start2DMode();
	}
}

function start2DMode() {
	if (!video || !renderer || !camera2D) {
		console.error("Required components not available for 2D mode");
		return;
	}
	
	// Set 2D mode flag
	is2DMode = true;
	
	// Calculate canvas size based on container dimensions (same logic as onWindowResize)
	const container = document.getElementById('vr-container');
	if (container) {
		const containerRect = container.getBoundingClientRect();
		const containerWidth = containerRect.width;
		
		// Calculate height based on 16:9 aspect ratio
		const aspectRatio = 16 / 9;
		const calculatedHeight = containerWidth / aspectRatio;
		
		// Ensure minimum dimensions to prevent zero-sized canvas
		const canvasWidth = Math.max(containerWidth, 320);
		const canvasHeight = Math.max(calculatedHeight, 180);
		
		// Resize renderer with calculated dimensions
		renderer.setSize(canvasWidth, canvasHeight);
		
		// Update 2D camera aspect ratio
		camera2D.aspect = canvasWidth / canvasHeight;
		camera2D.updateProjectionMatrix();
	}
	
	// Position the canvas to match the video element
	const canvas = renderer.domElement;
	canvas.style.position = 'absolute';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.width = '100%';
	canvas.style.height = 'auto';
	canvas.style.aspectRatio = '16/9';
	
	// Hide HTML video element and show WebGL canvas
	video.style.display = 'none';
	canvas.style.display = '';
	
	// Create video texture if not exists
	if (videoTexture) videoTexture.dispose();
	videoTexture = new THREE.VideoTexture(video);
	videoTexture.minFilter = THREE.LinearFilter;
	videoTexture.magFilter = THREE.LinearFilter;
	videoTexture.colorSpace = THREE.SRGBColorSpace;
	
	// Apply texture to sphere material and make mesh visible
	if (sphereMaterial && vr180Mesh) {
		sphereMaterial.map = videoTexture;
		sphereMaterial.needsUpdate = true;
		vr180Mesh.visible = true;
	}
	
	// Start video playback
	togglePlayPause();
	
	// Add event listeners for 2D controls
	add2DEventListeners();
	
	// Add fullscreen event listeners to handle resize properly
	document.addEventListener('fullscreenchange', onFullscreenChange);
	document.addEventListener('webkitfullscreenchange', onFullscreenChange);
	document.addEventListener('mozfullscreenchange', onFullscreenChange);
	document.addEventListener('MSFullscreenChange', onFullscreenChange);
	
	// Show 2D control panel
	show2DControlPanel();
	
	// Position control panel relative to canvas
	position2DControlPanel();
	
	// Start 2D render loop
	render2D();
}

function add2DEventListeners() {
	// Mouse events
	renderer.domElement.addEventListener('mousedown', onMouseDown);
	renderer.domElement.addEventListener('mousemove', onMouseMove);
	renderer.domElement.addEventListener('mouseup', onMouseUp);
	
	// Canvas-specific mouse movement for showing controls
	renderer.domElement.addEventListener('mousemove', onCanvasMouseMove);
	
	// Touch events
	renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
	renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
	renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
}

function remove2DEventListeners() {
	// Mouse events
	renderer.domElement.removeEventListener('mousedown', onMouseDown);
	renderer.domElement.removeEventListener('mousemove', onMouseMove);
	renderer.domElement.removeEventListener('mouseup', onMouseUp);
	
	// Touch events
	renderer.domElement.removeEventListener('touchstart', onTouchStart);
	renderer.domElement.removeEventListener('touchmove', onTouchMove);
	renderer.domElement.removeEventListener('touchend', onTouchEnd);
	
	// Fullscreen events
	document.removeEventListener('fullscreenchange', onFullscreenChange);
	document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
	document.removeEventListener('mozfullscreenchange', onFullscreenChange);
	document.removeEventListener('MSFullscreenChange', onFullscreenChange);
}

function onFullscreenChange() {
	if (!is2DMode) return;
	
	// Trigger resize handling when fullscreen state changes
	setTimeout(() => {
		onWindowResize();
	}, 100); // Small delay to ensure fullscreen transition is complete
}

async function actualSessionToggle() {
	if (!renderer || !renderer.isWebGLRenderer) {
		console.error("CRITICAL_ERROR: actualSessionToggle: renderer is NOT a WebGLRenderer or is null!", renderer);
		return;
	}

	if (xrSession) { // --- EXITING VR ---
		const sessionToClose = xrSession;
		xrSession = null;

		if (vrControlPanel) {
			clearTimeout(panelHideTimeout);
			panelTargetOpacity = 0;
			panelOpacity = 0; 
			vrControlPanel.children.forEach(child => {
				if (child.material && child.material.hasOwnProperty('opacity')) {
					child.material.opacity = 0;
				}
			});
			vrControlPanel.visible = false;
			isPanelFading = false;
		}
		sessionToClose.end().catch(err => {
			console.error("Error calling .end() on session:", err);
			onVRSessionEnd({ session: sessionToClose });
		});
	} else { // --- ENTERING VR ---
		try {
			const session = await navigator.xr.requestSession('immersive-vr', {
				requiredFeatures: ['local-floor'],
			});
			if (!session) { throw new Error("requestSession returned no session."); }

			xrSession = session; 
			xrSession.addEventListener('end', onVRSessionEnd); 


			// Hide the regular video element when entering VR
			if (video) {
				video.style.display = 'none';
			}

			if (video && (video.paused || video.ended)) {
				try {
					await video.play();
				} catch (playError) {
					console.error("Failed to play video after obtaining XR session:", playError);
				}
			}

			if (camera) camera.updateProjectionMatrix();

			if (videoTexture) { videoTexture.dispose(); videoTexture = null; }
			if (video) {
				videoTexture = new THREE.VideoTexture(video);
				videoTexture.minFilter = THREE.LinearFilter; videoTexture.magFilter = THREE.LinearFilter;
				videoTexture.colorSpace = THREE.SRGBColorSpace;
				if (vr180Mesh && sphereMaterial) {
					sphereMaterial.map = videoTexture;
					sphereMaterial.needsUpdate = true;
					vr180Mesh.visible = true;
				} else { throw new Error("VR mesh components not ready for texture."); }
			} else {
				throw new Error("Video element not available for creating texture.");
			}

			updateVRPlayPauseButtonIcon();
			updateVRVolumeButtonIcon();
			if (vrControlPanel) {
				vrControlPanel.visible = false;
				panelOpacity = 0; panelTargetOpacity = 0; isPanelFading = false;
				clearTimeout(panelHideTimeout);
				vrControlPanel.children.forEach(child => {
					if (child.material && child.material.hasOwnProperty('opacity')) {
						child.material.opacity = 0;
					}
				});
			}

			await renderer.xr.setSession(xrSession);
			isXrLoopActive = true;
			renderer.setAnimationLoop(renderXR);
			frameCounter = 0;
			lastFadeTimestamp = performance.now();

		} catch (err) {
			const sessionStartError = "XR_ERROR: Failed to start VR session: " + (err.message || String(err));
			console.error(sessionStartError, err);
			isXrLoopActive = false;

			if (vr180Mesh) vr180Mesh.visible = false;
			if (sphereMaterial) { sphereMaterial.map = null; sphereMaterial.needsUpdate = true; }
			if (videoTexture) { videoTexture.dispose(); videoTexture = null; }
			if (vrControlPanel) {
				vrControlPanel.visible = false; panelOpacity = 0; panelTargetOpacity = 0; isPanelFading = false;
				clearTimeout(panelHideTimeout);
			}
			if (xrSession) { 
				xrSession.removeEventListener('end', onVRSessionEnd);
				const tempSession = xrSession;
				xrSession = null; 
				tempSession.end().catch(e => {}).finally(() => {
					onVRSessionEnd({session: tempSession});
				});
			} else {
				 onVRSessionEnd({session: null});
			}
			if (renderer && renderer.getAnimationLoop && renderer.getAnimationLoop()) {
				renderer.setAnimationLoop(null);
			}
		}
	}
}

function onVRSessionEnd(event) { 
	const endedSession = event.session; 

	isXrLoopActive = false;
	if (renderer) {
		if (renderer.getAnimationLoop && renderer.getAnimationLoop()) {
			renderer.setAnimationLoop(null);
		}
	}

	// Show the regular video element when exiting VR
	if (video) {
		video.style.display = '';
	}

	if (video && !video.paused) {
		video.pause();
	}

	if (sphereMaterial && sphereMaterial.map) {
		sphereMaterial.map.dispose();
		sphereMaterial.map = null;
		sphereMaterial.needsUpdate = true;
	}
	if (videoTexture) {
		videoTexture.dispose(); videoTexture = null;
	}
	if (vr180Mesh) vr180Mesh.visible = false;
	if (vrControlPanel) {
		clearTimeout(panelHideTimeout);
		isPanelFading = false;
		panelOpacity = 0; panelTargetOpacity = 0;
		vrControlPanel.children.forEach(child => {
			if (child.material && child.material.hasOwnProperty('opacity')) {
				child.material.opacity = 0;
			}
		});
		vrControlPanel.visible = false;
	}

	if (endedSession && typeof endedSession.removeEventListener === 'function') {
		endedSession.removeEventListener('end', onVRSessionEnd);
	}

	if (xrSession === endedSession || xrSession === null) {
		xrSession = null;
	} else if (xrSession && endedSession) {
		console.warn("onVRSessionEnd: Global xrSession was different from the endedSession. Global xrSession:", xrSession, "Ended session:", endedSession);
		xrSession = null;
	}

	// Reset to original state when exiting VR
	resetToOriginalState();

	onWindowResize();
}


function handleControllerInteractions() {
	if (!renderer || !renderer.xr || !renderer.xr.isPresenting || !controller1) return;
}

function renderXR(timestamp, frame) {
	if (!isXrLoopActive) {
		return;
	}
	frameCounter++;

	if (!renderer || !renderer.xr || !renderer.xr.isPresenting) {
		console.warn("renderXR called but not in a valid XR presenting state. Stopping loop.");
		isXrLoopActive = false;
		if (renderer && renderer.getAnimationLoop && renderer.getAnimationLoop()) {
			renderer.setAnimationLoop(null);
		}
		return;
	}

	if (isPanelFading) {
		animatePanelFade(timestamp);
	}

	if (!frame) {
		console.warn("renderXR called without an XRFrame. Skipping render.");
		return;
	}

	if (frameCounter > 0 && frameCounter % 3600 === 0) {
		const gl = renderer.getContext();
		const error = gl.getError();
		if (error !== gl.NO_ERROR) {
			console.error(`WEBGL_ERROR_IN_RENDER_LOOP (F${frameCounter}):`, error, gl.enumToString ? gl.enumToString(error) : error);
		}
	}
	try {
		handleControllerInteractions();
		renderer.render(scene, camera);
	} catch (error) {
		const renderErrorMsg = "ERROR_IN_RENDERXR_LOOP (F" + frameCounter + "): " + (error.message || String(error));
		console.error(renderErrorMsg, error);
		console.error("Render loop error. Attempting to exit VR.");
		isXrLoopActive = false; 

		const sessionToCloseOnError = xrSession; 
		xrSession = null; 

		if (sessionToCloseOnError) {
			sessionToCloseOnError.removeEventListener('end', onVRSessionEnd);
			sessionToCloseOnError.end().catch(e => {
				console.error("Error trying to end session after render loop crash:", e);
			}).finally(() => {
				onVRSessionEnd({ session: sessionToCloseOnError });
			});
		} else {
			onVRSessionEnd({ session: null }); 
		}
	}
}
