# VR180 Web Player
A web-based video player for 180 degree, 3D video.

Got an immersive video you want people to see with the Apple Vision Pro or Meta Quest headsets? Now you can put it on your website just like any other video! People will see the immersive 3D video if they have a capable headset or they'll get a 2D version on other devices.

## How to use it
1. Link to the player CSS file `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Verdi/VR180-Web-Player@v1.3.0/vr180player/vr180-player.css">`.
2. Add the player script `<script type="module" src="https://cdn.jsdelivr.net/gh/Verdi/VR180-Web-Player@v1.3.0/vr180player/vr180-player.js"></script>` before the closing body tag.
3. And use this HTML snippet to embed your video: 
```
<div id="vr-container">
	<video id="vr180" poster="poster.jpg" title="Demo Video" crossOrigin="anonymous" playsinline>
		<source src="sbs-video.mp4" type="video/mp4">
	</video>
</div>
```

### More than one player on a page
Add `data-vr180` to each video. You do not need the `vr-container` div.
```
<video data-vr180 poster="poster.jpg" title="My Video" crossOrigin="anonymous" playsinline>
	<source src="my-video.mp4" type="video/mp4">
</video>
```
Options go in data attributes. For example, `data-skip-seconds="10"` changes how far the back and forward buttons skip (the default is 15).

### HLS streaming
Use your HLS stream (`.m3u8`) as the video source:
```
<video data-vr180 preload="none" poster="poster.jpg" title="My Video" crossOrigin="anonymous" playsinline>
	<source src="https://example.com/my-video/master.m3u8" type="application/vnd.apple.mpegurl">
</video>
```
- Add `preload="none"`. Without it, some browsers start to download the stream before the player is ready. (In Safari, the player always waits for play before it loads the stream, because Safari chooses a low quality if the stream loads while the video is small on the page.)
- Your video server must allow cross-origin requests (CORS) for the playlists and the video files. Without CORS, the browser cannot draw the video in 3D.
- In Safari (Mac, Vision Pro, iPhone), the browser plays the stream itself. Other browsers, such as Chrome and the Quest browser, use [hls.js](https://github.com/video-dev/hls.js). The player loads hls.js only when it needs it.
- To choose, add `data-hls="native"` (the browser's own HLS) or `data-hls="hls.js"`. If that way cannot work in the browser, the player uses the other one.
- Quality:
  - **Auto** is the default. With hls.js, the player starts at the highest quality and goes down only if the connection is too slow. With the browser's own HLS, the browser chooses. (The player uses a new `<video>` element for each play, because on Vision Pro, Safari chose a low quality when the same element played a second time.)
  - **The viewer can choose a quality.** The VR panel has a quality button between "forward" and "mute": each tap goes to the next quality. The 2D controls have a quality menu. The list comes from the qualities in your HLS playlist, so there is nothing to set up. MP4 videos have no quality choice.
  - With the browser's own HLS, a fixed quality works like in [OpenImmersive](https://github.com/acuteimmersive/openimmersive): the player gives the browser a playlist with only that quality. A change takes a moment, because the video loads again at the same time. The player keeps the same `<video>` element for this, because Safari lets a new element play with sound only after the viewer presses play.
  - To start with a fixed quality, add `data-hls-quality="best"` (the highest) or a height, such as `data-hls-quality="2880"`.
- To see which quality plays, add `data-debug`. The control panel title then shows the video size and how the stream plays.

### A smaller video for 2D
In 2D, the player shows only the left-eye picture, so 2D viewers download the right half of each frame for nothing. You can give the player a second video for 2D, with only the left-eye picture:
```
<video data-vr180 data-2d-src="https://example.com/my-video/2d/master.m3u8" preload="none" poster="poster.jpg" title="My Video" crossOrigin="anonymous" playsinline>
	<source src="https://example.com/my-video/vr/master.m3u8" type="application/vnd.apple.mpegurl">
</video>
```
- Headsets always play the `<source>` (side by side). Other devices play `data-2d-src`.
- The 2D video is the left half of the side-by-side frame, so it is square, for example 2048×2048. It can be an HLS playlist or a file.
- Use H.264 for the 2D video, so every browser can play it (Firefox cannot play HEVC). Headsets play HEVC, so the VR video can stay HEVC.
- With H.264, make the largest 2D size 3072×3072. That is the largest square that most devices can play in H.264. It looks sharp in full screen on a large monitor.
- `tools/make-test-hls-2d.sh` shows how to make one with ffmpeg.

### Starting a player from JavaScript
```
import { VR180Player } from 'https://cdn.jsdelivr.net/gh/Verdi/VR180-Web-Player@v1.3.0/vr180player/vr180-player.js';
const player = new VR180Player(document.querySelector('video'), { skipSeconds: 10 });
// Later, to remove it (for example, when your page changes without a reload):
player.destroy();
```

## How the code is organized
`vr180player/vr180-player.js` is the file you add to your page. It starts the players. The rest is in `vr180player/lib/`:

| File | What it does |
| --- | --- |
| `player.js` | One player for one video. Starts VR or 2D mode and runs the control actions. |
| `source.js` | Where the video comes from: a normal file, or an HLS stream (with hls.js or the browser's own HLS). |
| `hls-playlist.js` | Makes an HLS playlist with only the highest quality, for the browser's own HLS. |
| `formats.js` | Video formats: the shape the video is drawn on, and where each eye's picture is in the frame (side by side, or mono for a 2D video). |
| `video-screen.js` | Makes the 3D surface for the video. Each eye gets its own copy. Used in 2D, and in VR on Vision Pro. |
| `xr-mode.js` | VR mode on a headset. |
| `media-layer.js` | On the Quest, shows the video directly in the headset as a WebXR media layer, with no copy to the GPU. |
| `vr-panel.js` | The control panel you see in VR. |
| `flat-mode.js` | 2D mode on a normal screen, with drag to look around. |
| `dom-controls.js` | The control panel you see in 2D. |
| `icons.js` | Icons for the VR panel. |
| `three.js` | Loads Three.js, locked to one version. |

To test your changes, run `python3 tools/dev-server.py 8180` in this folder and open `http://localhost:8180/dev.html`.

`dev.html` also plays a 60-second HLS test stream with 3 qualities (8K, 6K, and 4K), in `test-media/hls/`, and in 2D a left-eye stream (3K, 2K, and 1K, H.264), in `test-media/hls-2d/`. `tools/make-test-hls-2d.sh` makes the 2D stream. To make it again from an 8192x4096 video (needs [ffmpeg](https://ffmpeg.org) on a Mac), run `tools/make-test-hls.sh path/to/video.mp4`.

## How it works
When the webpage loads, the video file is embeded normally, with a play button positioned over the poster frame. When the user clicks play, the player script checks if `navigator.xr` exists. If it does, a VR experience is initiated. If not, it builds a rectilinear, 2D view of your video and plays it that way. 

**VR on Apple Vision Pro**
![vr](https://github.com/user-attachments/assets/c1097a4f-8712-4e6b-a233-a52d49cb261e)

**2D in Safari on Mac**

You can drag the 2D video around to see things outside the frame.
<img width="1000" height="793" alt="2d" src="https://github.com/user-attachments/assets/094d30b7-7175-44ba-a700-d333196f8bb3" />

## Video Format
**The player only supports 2:1, side-by-side video using either H.264 or HEVC, in an mp4 file or an HLS stream.** It does not support over-under, MV-HEVC, APMP, or .aivu.

## Support
I'm not a developer and I might not be able to help you if you run into problems, want to customize this, or add new features (not that I won't try). I'm releasing this with the [unlicense](https://unlicense.org/) so you're free to do anything at all with it. That said, if you have ideas or want to contribute code, I'd love to [hear](mailto:hello@michaelverdi.com) from you.

## Demo
**Test it out!**
Open [https://verdi.github.io/VR180-Web-Player/](https://verdi.github.io/VR180-Web-Player/) in a browser on your headset (or another device). Or check out this short film I made -> [Blandscape](https://michaelverdi.com/blandscape)
