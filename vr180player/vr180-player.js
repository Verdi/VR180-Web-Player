// VR180 Web Player: plays 180° 3D video in 2D on the web, and in VR on Apple Vision Pro and Meta Quest.
//
// Add this script to a page and it starts a player for:
// - the <video id="vr180"> element (the original embed), and
// - every <video data-vr180> element.
//
// Or import the class and make players yourself:
//   import { VR180Player } from '.../vr180player/vr180-player.js';
//   const player = new VR180Player(videoElement, { skipSeconds: 10 });

import { VR180Player } from './lib/player.js';

export { VR180Player };
window.VR180Player = VR180Player;

// Reads player options from data attributes, for example <video data-vr180 data-skip-seconds="10">.
function optionsFromAttributes(video) {
	const { projection, stereo, skipSeconds, hls } = video.dataset;
	const options = {};
	if (hls) options.hls = hls;
	if (projection) options.projection = projection;
	if (stereo) options.stereo = stereo;
	if (skipSeconds && isFinite(Number(skipSeconds))) options.skipSeconds = Number(skipSeconds);
	return options;
}

function startPlayers() {
	for (const video of document.querySelectorAll('video#vr180, video[data-vr180]')) {
		if (video.vr180Player) continue;
		try {
			new VR180Player(video, optionsFromAttributes(video));
		} catch (err) {
			console.error('VR180Player:', err);
		}
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startPlayers);
} else {
	startPlayers();
}
