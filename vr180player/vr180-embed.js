// VR180 Web Player: helper for a page that shows the player in an <iframe>.
//
// It helps the player with two things on iPhone:
// - Full screen. A web page cannot use real full screen, so the player covers the window itself.
//   In an iframe, the window is only the iframe. This script makes the iframe cover the screen.
// - Motion control. In an iframe from another website, Safari does not give the motion sensor to
//   the player. This script reads it, and passes the readings to the player.
//
// Add it to the page that has the <iframe>:
//   <script src="https://cdn.jsdelivr.net/gh/Verdi/VR180-Web-Player@v1.4.1/vr180player/vr180-embed.js"></script>
//
// Note: the iframe covers the screen with position: fixed. That does not work inside an element with
// a CSS transform, filter, or perspective, so do not put the iframe inside one.

(() => {
	if (window.vr180Embed) return; // The script is already on the page.
	window.vr180Embed = true;

	const MESSAGE = 'vr180-fullscreen';
	const MOTION_MESSAGE = 'vr180-motion';
	const MOTION_STATE_MESSAGE = 'vr180-motion-state';
	const ORIENTATION_MESSAGE = 'vr180-orientation';
	const COVER_SCREEN = [
		'position: fixed', 'top: 0', 'left: 0', 'width: 100vw', 'height: 100vh', 'height: 100dvh',
		'max-width: none', 'max-height: none', 'margin: 0', 'border: 0', 'z-index: 2147483000',
	].map((rule) => `${rule} !important`).join('; ');

	// The iframes that cover the screen now, with their style from before.
	const covering = new Map();
	let pageOverflow = '';

	function frameOf(source) {
		return [...document.querySelectorAll('iframe')].find((frame) => frame.contentWindow === source);
	}

	// In landscape on iPhone, Safari keeps a strip free on each side for the notch, unless the page
	// asks for the whole screen (viewport-fit=cover). Ask for it only while an iframe covers the screen.
	let viewportBefore = null;
	function coverWholeScreen(on) {
		const meta = document.querySelector('meta[name="viewport"]');
		if (!meta) return;
		if (on && viewportBefore === null) {
			viewportBefore = meta.content;
			if (!/viewport-fit/.test(meta.content)) meta.content = `${meta.content}, viewport-fit=cover`;
		} else if (!on && viewportBefore !== null) {
			meta.content = viewportBefore;
			viewportBefore = null;
		}
	}

	function cover(frame, on) {
		if (on && !covering.has(frame)) {
			if (!covering.size) {
				pageOverflow = document.documentElement.style.overflow;
				document.documentElement.style.overflow = 'hidden'; // The page cannot scroll behind it.
				coverWholeScreen(true);
			}
			covering.set(frame, frame.getAttribute('style'));
			frame.setAttribute('style', `${frame.getAttribute('style') ?? ''}; ${COVER_SCREEN}`);
		} else if (!on && covering.has(frame)) {
			const style = covering.get(frame);
			if (style === null) frame.removeAttribute('style');
			else frame.setAttribute('style', style);
			covering.delete(frame);
			if (!covering.size) {
				document.documentElement.style.overflow = pageOverflow;
				coverWholeScreen(false);
			}
		}
	}

	// Motion control: the iframes that get the motion readings.
	const motionFrames = new Set();
	function onOrientation(event) {
		const reading = {
			type: ORIENTATION_MESSAGE,
			alpha: event.alpha,
			beta: event.beta,
			gamma: event.gamma,
			angle: screen.orientation?.angle ?? window.orientation ?? 0,
		};
		for (const frame of motionFrames) frame.contentWindow?.postMessage(reading, '*');
	}

	// Safari on iPhone asks the viewer, and only allows the question right after a tap. The tap
	// happened in the iframe; Safari usually still counts it when the message comes right after.
	async function motionAllowed() {
		if (typeof DeviceOrientationEvent === 'undefined') return false;
		if (typeof DeviceOrientationEvent.requestPermission !== 'function') return true;
		try {
			return (await DeviceOrientationEvent.requestPermission()) === 'granted';
		} catch (err) {
			console.warn('VR180 embed: no permission for the motion sensor:', err);
			return false;
		}
	}

	async function motion(frame, on) {
		const reply = (state) => frame.contentWindow?.postMessage({ type: MOTION_STATE_MESSAGE, on: state }, '*');
		if (!on) {
			motionFrames.delete(frame);
			if (!motionFrames.size) window.removeEventListener('deviceorientation', onOrientation);
			return;
		}
		reply('asking'); // Tells the player that this page has vr180-embed.js.
		if (!(await motionAllowed())) {
			reply(false);
			return;
		}
		if (!motionFrames.size) window.addEventListener('deviceorientation', onOrientation);
		motionFrames.add(frame);
		reply(true);
	}

	window.addEventListener('message', (event) => {
		const type = event.data?.type;
		if (type !== MESSAGE && type !== MOTION_MESSAGE) return;
		const frame = frameOf(event.source);
		if (!frame) return;
		if (type === MESSAGE) cover(frame, Boolean(event.data.on));
		else motion(frame, Boolean(event.data.on));
	});

	// Escape on this page ends full screen too, and tells the player.
	window.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape') return;
		for (const frame of [...covering.keys()]) {
			cover(frame, false);
			frame.contentWindow?.postMessage({ type: MESSAGE, on: false }, '*');
		}
	});
})();
