/**
 * Whether the full-screen loader is up. It lives above the router, in the root layout, so it
 * survives a navigation: start it before navigating, and the layout puts it away once the next
 * page has rendered, so it fades out over that page instead of vanishing with the old one.
 */
class PageLoader {
	active = $state(false);
	/**
	 * How long the cover is up before the logo fades in on it. Set by whoever starts the loader,
	 * so each use decides for itself, and kept after hide() so the logo is not dropped mid-fade.
	 */
	logoDelayMs = $state(0);
	/** The least time the logo stays up once it has appeared, even if the page is ready sooner. */
	logoMinMs = $state(0);
	/** After this long a "the server is slow" message fades in under the logo. 0 means never. */
	slowMessageDelayMs = $state(0);
	/**
	 * Whether the cover appears at once instead of fading in. Decided each time it is shown: true
	 * while the page on screen came from a full load (a typed address, a link from another site, a
	 * refresh). There is no earlier page to fade from then, and a see-through cover would show the
	 * page filling in underneath it.
	 */
	cutIn = $state(false);
	/**
	 * Whether the page on screen came from a full load and not an in-app navigation. Kept current
	 * by the root layout; true until the first in-app navigation.
	 */
	fullLoad = true;

	/**
	 * Brings the loader up. By default the logo shows straight away and the loader goes as soon as
	 * hide() is called. `logoDelayMs` holds the logo back, and `logoMinMs` keeps it on screen for
	 * at least that long once it has appeared. `slowMessageDelayMs` adds the slow-server message
	 * once the loader has been up that long.
	 */
	show(options: { logoDelayMs?: number; logoMinMs?: number; slowMessageDelayMs?: number } = {}) {
		this.logoDelayMs = options.logoDelayMs ?? 0;
		this.logoMinMs = options.logoMinMs ?? 0;
		this.slowMessageDelayMs = options.slowMessageDelayMs ?? 0;
		this.cutIn = this.fullLoad;
		this.active = true;
	}

	hide() {
		this.active = false;
	}
}

export const pageLoader = new PageLoader();
