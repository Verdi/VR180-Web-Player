# VR180 Web Player
A web-based video player for 180 degree, 3D video.

Got an immersive video you want people to see with the Apple Vision Pro or Meta Quest headsets? Now you can put it on your website just like any other video! People will see the immersive 3D video if they have a capable headset or they'll get a 2D version on other devices.

## How to use it
1. Drop the `vr180player` directory in the root level of your website.
2. Link to the player CSS file `<link rel="stylesheet" href="vr180player/vr180-player.css">`.
3. Add the player script `<script type="module" src="vr180player/vr180-player.js"></script>` before the closing body tag.
4. And use this HTML snippet to embed your video: 
```
<div id="vr-container">
	<video id="vr180" poster="poster.jpg" title="Demo Video" crossOrigin="anonymous" playsinline>
		<source src="sbs-video.mp4" type="video/mp4">
	</video>
</div>
```

## How it works
When the webpage loads, the video file is embeded normally, with a play button positioned over the poster frame. When the user clicks play, the player script checks if `navigator.xr` exists. If it does, a VR experience is initiated. If not, it builds a rectilinear, 2D view of your video and plays it that way. 

**VR on Apple Vision Pro**
![vr](https://github.com/user-attachments/assets/c1097a4f-8712-4e6b-a233-a52d49cb261e)

**2D in Safari on Mac**

You can drag the 2D video around to see things outside the frame.
<img width="1000" height="793" alt="2d" src="https://github.com/user-attachments/assets/094d30b7-7175-44ba-a700-d333196f8bb3" />

## Video Format
**The player only supports 2:1, side-by-side video using either H.264 or HEVC in an mp4 file.** It does not support over-under, MV-HEVC, APMP, or .aivu.

## Support
I'm not a developer and I might not be able to help you if you run into problems, want to customize this, or add new features (not that I won't try). I'm releasing this with the [unlicense](https://unlicense.org/) so you're free to do anything at all with it. That said, if you have ideas or want to contribute code, I'd love to [hear](mailto:hello@michaelverdi.com) from you.

## Demo
**Test it out!**
Open [https://verdi.github.io/VR180-Web-Player/](https://verdi.github.io/VR180-Web-Player/) in a browser on your headset (or another device). Or check out this short film I made -> [Blandscape](https://michaelverdi.com/blandscape)
