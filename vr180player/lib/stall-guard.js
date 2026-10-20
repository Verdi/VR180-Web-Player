// Gets a stuck video going again.
//
// On the Quest, with hls.js on Auto, a jump to a far part of the video sometimes left it stuck:
// the video said it was playing, but the time did not move. A pause and play by the viewer fixed it.
// While the video should play, the guard checks if the time moves:
// - Stuck for STUCK_WITH_DATA_MS, with video loaded ahead: pause and play, as the viewer did.
// - Stuck for STUCK_WITHOUT_DATA_MS, with nothing loaded ahead: the source loads again at that time.

const CHECK_MS = 500;
const STUCK_WITH_DATA_MS = 2000;
const STUCK_WITHOUT_DATA_MS = 4000;
const LOADED_AHEAD_SECONDS = 1;

// How many seconds of video are loaded after the current time.
export function bufferedAhead(video) {
	const { buffered, currentTime } = video;
	for (let i = 0; i < buffered.length; i++) {
		if (buffered.start(i) <= currentTime + 0.1 && currentTime < buffered.end(i)) return buffered.end(i) - currentTime;
	}
	return 0;
}

export class StallGuard {
	constructor(player) {
		this.player = player;
		this.timer = null;
		this.fixes = 0; // How often the guard had to help, for data-debug.
	}

	start() {
		this.stop();
		this.#moved();
		this.timer = setInterval(() => this.#check(), CHECK_MS);
	}

	stop() {
		clearInterval(this.timer);
		this.timer = null;
	}

	#moved() {
		this.lastTime = this.player.video.currentTime;
		this.lastMove = performance.now();
	}

	#check() {
		const { video, source } = this.player;
		if (video.paused || video.ended || video.currentTime !== this.lastTime) {
			this.#moved();
			return;
		}
		const stuckMs = performance.now() - this.lastMove;
		const ahead = bufferedAhead(video);
		if (ahead >= LOADED_AHEAD_SECONDS && stuckMs >= STUCK_WITH_DATA_MS) {
			this.fixes++;
			console.warn(`VR180Player: video stuck at ${video.currentTime.toFixed(1)} s with ${ahead.toFixed(1)} s loaded. Pausing and playing again.`);
			video.pause();
			setTimeout(() => video.play().catch((err) => console.error('VR180Player: could not play again:', err)), 100);
			this.#moved();
		} else if (stuckMs >= STUCK_WITHOUT_DATA_MS) {
			this.fixes++;
			console.warn(`VR180Player: video stuck at ${video.currentTime.toFixed(1)} s with nothing loaded. Loading again.`);
			source?.restartLoad?.(video.currentTime);
			this.#moved();
		}
	}
}
