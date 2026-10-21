// In landscape on iPhone, Safari keeps a strip free on each side for the notch, and shows the page
// color there, unless the page asks for the whole screen with viewport-fit=cover. The player asks
// for it only during its own full screen, so the page layout does not change at other times.
// vr180-embed.js does the same for the page around an iframe.

let savedContent = null; // The viewport content from before, or '' if the player made the tag.
let madeTag = false;

export function coverWholeScreen(on) {
	let meta = document.querySelector('meta[name="viewport"]');
	if (on) {
		if (savedContent !== null) return;
		madeTag = !meta;
		if (!meta) {
			meta = document.createElement('meta');
			meta.name = 'viewport';
			meta.content = 'width=device-width, initial-scale=1';
			document.head.append(meta);
		}
		savedContent = madeTag ? '' : meta.content;
		if (!/viewport-fit/.test(meta.content)) meta.content = `${meta.content}, viewport-fit=cover`;
	} else {
		if (savedContent === null) return;
		if (madeTag) meta?.remove();
		else if (meta) meta.content = savedContent;
		savedContent = null;
		madeTag = false;
	}
}
