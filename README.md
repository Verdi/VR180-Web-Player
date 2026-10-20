# VR180 Web Player
A web-based video player for 180 degree, 3D video.

Got an immersive video you want people to see with the Apple Vision Pro or Meta Quest headsets? Now you can put it on your website just like any other video! People will see the immersive 3D video if they have a capable headset or they'll get a 2D version on other devices.

## How to use it
1. Link to the player CSS file `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Verdi/VR180-Web-Player@v1.0.4/vr180player/vr180-player.css">`.
2. Add the player script `<script type="module" src="https://cdn.jsdelivr.net/gh/Verdi/VR180-Web-Player@v1.0.4/vr180player/vr180-player.js"></script>` before the closing body tag.
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
- Add `preload="none"`. Without it, some browsers start to download the stream before the player is ready.
- Your video server must allow cross-origin requests (CORS) for the playlists and the video files. Without CORS, the browser cannot draw the video in 3D.
- In Safari (Mac, Vision Pro, iPhone), the browser plays the stream itself. Other browsers, such as Chrome and the Quest browser, use [hls.js](https://github.com/video-dev/hls.js). The player loads hls.js only when it needs it.
- To choose, add `data-hls="native"` (the browser's own HLS) or `data-hls="hls.js"`. If that way cannot work in the browser, the player uses the other one.
- Quality:
  - With hls.js, the player starts at the highest quality. It goes down only if the connection is too slow.
  - With the browser's own HLS, the player lets the browser use **only the highest resolution**. Without this, Safari on Vision Pro played a low quality when the video played a second time. On a slow connection, the video pauses to load instead of getting blurry.
  - To let the browser choose the quality, add `data-hls-quality="auto"`.
- To see which quality plays, add `data-debug`. The control panel title then shows the video size and how the stream plays.

### Starting a player from JavaScript
```
import { VR180Player } from 'https://cdn.jsdelivr.net/gh/Verdi/VR180-Web-Player@v1.0.4/vr180player/vr180-player.js';
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
| `formats.js` | Video formats: the shape the video is drawn on, and where each eye's picture is in the frame. |
| `video-screen.js` | Makes the 3D surface for the video. Each eye gets its own copy. |
| `xr-mode.js` | VR mode on a headset. |
| `vr-panel.js` | The control panel you see in VR. |
| `flat-mode.js` | 2D mode on a normal screen, with drag to look around. |
| `dom-controls.js` | The control panel you see in 2D. |
| `icons.js` | Icons for the VR panel. |
| `three.js` | Loads Three.js, locked to one version. |

To test your changes, run `python3 tools/dev-server.py 8180` in this folder and open `http://localhost:8180/dev.html`.

`dev.html` also plays an HLS test stream with 5 qualities (8K to 2K), in `test-media/hls/`. To make it again from an 8192x4096 video (needs [ffmpeg](https://ffmpeg.org) on a Mac), run `tools/make-test-hls.sh path/to/video.mp4`.

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
