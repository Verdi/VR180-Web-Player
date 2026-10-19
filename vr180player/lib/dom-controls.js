const AUTO_HIDE_MS = 3000;

function element(tag, className, attributes = {}) {
	const el = document.createElement(tag);
	el.className = className;
	for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
	return el;
}

function button(className, action, label) {
	return element('button', `vr180-button ${className}`, { type: 'button', 'data-action': action, 'aria-label': label });
}

export function formatTime(seconds) {
	if (!isFinite(seconds)) return '00:00';
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const parts = hours > 0 ? [hours, minutes, secs] : [minutes, secs];
	return parts.map((part) => String(part).padStart(2, '0')).join(':');
}

// The HTML control panel shown over the video in 2D mode.
// Each button has a `data-action`. A click sends that action to `onAction`.
export class DomControls {
	constructor(container, { title, onAction }) {
		this.hideTimer = null;
		this.root = element('div', 'vr180-panel');

		const titleEl = element('p', 'vr180-title');
		titleEl.textContent = title;
		this.currentTime = element('p', 'vr180-time vr180-current-time');
		this.totalTime = element('p', 'vr180-time vr180-total-time');
		this.bar = element('div', 'vr180-bar');
		this.played = element('div', 'vr180-played');
		this.bar.append(this.played);
		const progress = element('div', 'vr180-progress');
		progress.append(this.currentTime, this.bar, this.totalTime);
		const status = element('div', 'vr180-status');
		status.append(titleEl, progress);

		this.playPause = button('vr180-play-pause', 'playPause', 'Play');
		this.mute = button('vr180-mute', 'mute', 'Mute');
		const nav = element('div', 'vr180-nav');
		nav.append(button('vr180-back', 'back', 'Skip back'), this.playPause, button('vr180-forward', 'forward', 'Skip forward'));
		const controls = element('div', 'vr180-controls');
		controls.append(button('vr180-fullscreen', 'fullscreen', 'Full screen'), nav, this.mute);

		this.root.append(status, controls);
		container.append(this.root);

		this.root.addEventListener('click', (event) => {
			const target = event.target.closest('[data-action]');
			if (target) {
				onAction(target.dataset.action);
			} else if (event.target.closest('.vr180-bar')) {
				const rect = this.bar.getBoundingClientRect();
				onAction('seek', (event.clientX - rect.left) / rect.width);
			} else {
				return;
			}
			this.show();
		});
	}

	// Shows the panel, then hides it after a short time.
	show() {
		this.pin();
		this.hideTimer = setTimeout(() => this.hide(), AUTO_HIDE_MS);
	}

	// Shows the panel and keeps it shown.
	pin() {
		clearTimeout(this.hideTimer);
		this.root.classList.add('visible');
	}

	hide() {
		clearTimeout(this.hideTimer);
		this.root.classList.remove('visible');
	}

	update(video) {
		this.currentTime.textContent = formatTime(video.currentTime);
		if (isFinite(video.duration)) this.totalTime.textContent = formatTime(video.duration);
		const progress = isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0;
		this.played.style.width = `${progress * 100}%`;

		const playing = !video.paused && !video.ended;
		this.playPause.classList.toggle('is-playing', playing);
		this.playPause.setAttribute('aria-label', playing ? 'Pause' : 'Play');
		this.mute.classList.toggle('is-muted', video.muted);
		this.mute.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
	}

	destroy() {
		clearTimeout(this.hideTimer);
		this.root.remove();
	}
}
