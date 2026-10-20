// Tells the VR render loop when the video has a new frame, so the player copies the picture to the
// GPU only then. An 8K picture is about 130 MB, and a headset draws 72 to 120 times per second,
// but the video has only 30 or 60 new frames per second.
//
// It watches in two ways, because neither works everywhere in VR:
// - requestVideoFrameCallback: the browser calls it for each new frame.
// - getVideoPlaybackQuality().totalVideoFrames: a count of the frames the browser has decoded.
// If neither one reports a frame for MAX_WAIT_MS while the video plays, it copies anyway. Before,
// the Quest froze the picture in VR when the player copied only on requestVideoFrameCallback.

const MAX_WAIT_MS = 100;

export class FrameWatcher {
	constructor() {
		this.video = null;
		this.callbackId = 0;
		this.newFrame = true;
		this.lastCount = -1;
		this.lastCopy = 0;
		// Copies in the current second, and in the last full second (for the debug label).
		this.counting = { start: 0, copies: 0, forced: 0 };
		this.perSecond = { copies: 0, forced: 0 };
	}

	// Starts to watch `video`. Call it every frame: it does nothing if the video is the same.
	watch(video) {
		if (video === this.video) return;
		this.stop();
		this.video = video;
		this.newFrame = true;
		this.lastCount = -1;
		if ('requestVideoFrameCallback' in video) {
			const onFrame = () => {
				this.newFrame = true;
				this.callbackId = video.requestVideoFrameCallback(onFrame);
			};
			this.callbackId = video.requestVideoFrameCallback(onFrame);
		}
	}

	stop() {
		if (this.video && this.callbackId) this.video.cancelVideoFrameCallback?.(this.callbackId);
		this.video = null;
		this.callbackId = 0;
	}

	// Returns true when the player must copy the picture now. `now` is in milliseconds.
	shouldCopy(now) {
		const { video } = this;
		if (!video) return false;
		const count = video.getVideoPlaybackQuality?.().totalVideoFrames;
		if (count !== undefined && count !== this.lastCount) {
			this.lastCount = count;
			this.newFrame = true;
		}
		const playing = !video.paused && !video.ended;
		const forced = !this.newFrame && playing && now - this.lastCopy > MAX_WAIT_MS;
		this.#count(now, forced);
		if (!this.newFrame && !forced) return false;
		this.newFrame = false;
		this.lastCopy = now;
		return true;
	}

	#count(now, forced) {
		const { counting } = this;
		if (now - counting.start >= 1000) {
			this.perSecond = { copies: counting.copies, forced: counting.forced };
			this.counting = { start: now, copies: 0, forced: 0 };
		}
		if (this.newFrame || forced) this.counting.copies++;
		if (forced) this.counting.forced++;
	}
}
