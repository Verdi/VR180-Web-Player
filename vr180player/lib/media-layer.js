// A WebXR media layer: the browser shows the <video> directly in the headset, as a 180° or 360°
// sphere around the viewer. The player does not copy the picture to the GPU at all.
//
// The player uses it on the Quest. There, copying an 8K picture to the GPU 60 times per second was
// too slow, and an eye sometimes showed a broken picture (a flicker). The VR panel and the
// controller rays are still drawn with Three.js, in a layer on top of the video.
//
// Safari on Vision Pro keeps the WebGL way (the video is drawn on a sphere in the Three.js scene).

// Can this browser make media layers? The session must also have the 'layers' feature.
export function mediaLayersSupported() {
	return typeof XRMediaBinding !== 'undefined';
}

// Makes a media layer for `video` and puts it under the Three.js layer.
// Returns the layer, or null if the format or the session cannot use one.
export function addMediaLayer(session, renderer, video, format) {
	const { mediaLayer: angles } = format.projection;
	const layout = format.layout.mediaLayout;
	if (!mediaLayersSupported() || !angles || !layout) return null;
	if (session.enabledFeatures && !session.enabledFeatures.includes('layers')) return null;

	const binding = new XRMediaBinding(session);
	const layer = binding.createEquirectLayer(video, {
		space: renderer.xr.getReferenceSpace(),
		layout,
		radius: 0, // 0 is a sphere that is infinitely far away, like a sky.
		...angles,
	});
	// The first layer is drawn first, so the Three.js layer (panel and rays) is on top of the video.
	session.updateRenderState({ layers: [layer, renderer.xr.getBaseLayer()] });
	return layer;
}
