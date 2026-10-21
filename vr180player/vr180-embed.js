// VR180 Web Player: helper for a page that shows the player in an <iframe>.
//
// On iPhone, a web page cannot use real full screen, so the player covers the window itself.
// In an iframe, the window is only the iframe. With this script on the page around the iframe,
// the player can ask this page to make its iframe cover the whole screen.
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

	function cover(frame, on) {
		if (on && !covering.has(frame)) {
			if (!covering.size) {
				pageOverflow = document.documentElement.style.overflow;
				document.documentElement.style.overflow = 'hidden'; // The page cannot scroll behind it.
			}
			covering.set(frame, frame.getAttribute('style'));
			frame.setAttribute('style', `${frame.getAttribute('style') ?? ''}; ${COVER_SCREEN}`);
		} else if (!on && covering.has(frame)) {
			const style = covering.get(frame);
			if (style === null) frame.removeAttribute('style');
			else frame.setAttribute('style', style);
			covering.delete(frame);
			if (!covering.size) document.documentElement.style.overflow = pageOverflow;
		}
	}

	window.addEventListener('message', (event) => {
		if (event.data?.type !== MESSAGE) return;
		const frame = frameOf(event.source);
		if (frame) cover(frame, Boolean(event.data.on));
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
