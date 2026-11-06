import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Loading from './Loading.svelte';

describe('Loading', () => {
	it('announces a loading status to assistive technology', async () => {
		render(Loading, { label: 'Loading organizations' });
		await expect.element(page.getByRole('status')).toHaveTextContent('Loading organizations');
	});

	it('hides the graphic from assistive technology', async () => {
		const { container } = render(Loading);
		expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
	});

	it('warps the logo with a displacement filter fed by a sliding map', async () => {
		const { container } = render(Loading);
		expect(container.querySelector('filter feDisplacementMap')).toBeTruthy();
		const slide = container.querySelector('filter feImage animate')!;
		expect(slide.getAttribute('attributeName')).toBe('x');
		expect(slide.getAttribute('repeatCount')).toBe('indefinite');
		expect(slide.getAttribute('dur')).toBe('1.5s');
	});

	it('applies the filter to the logo group', async () => {
		const { container } = render(Loading);
		const filterId = container.querySelector('filter')!.id;
		expect(container.querySelector('.warp')!.getAttribute('filter')).toBe(`url(#${filterId})`);
	});

	it('masks a lighter copy of the logo with a sliding gradient', async () => {
		const { container } = render(Loading, { color: '#339c5e' });
		const glow = container.querySelector('.glow')!;
		expect(glow.getAttribute('mask')).toContain('url(#');
		expect((glow as SVGElement).style.color).toContain('color-mix');
		const slide = container.querySelector('linearGradient animateTransform')!;
		expect(slide.getAttribute('dur')).toBe('1.5s');
	});

	it('applies the width to the logo', async () => {
		const { container } = render(Loading, { width: 240 });
		expect((container.querySelector('svg') as SVGElement).style.width).toBe('240px');
	});

	it('keeps the distortion and the wave when reduced motion is off', async () => {
		const { container } = render(Loading, { reducedMotion: false });
		const warp = getComputedStyle(container.querySelector('.warp')!);
		expect(warp.filter).not.toBe('none');
		expect(warp.animationName).toBe('none');
		expect(getComputedStyle(container.querySelector('.glow')!).display).not.toBe('none');
	});

	it('swaps the distortion and wave for a light opacity pulse in reduced motion mode', async () => {
		const { container } = render(Loading, { reducedMotion: true });
		const warp = getComputedStyle(container.querySelector('.warp')!);
		expect(warp.filter).toBe('none');
		expect(warp.animationName).toContain('loading-pulse');
		expect(getComputedStyle(container.querySelector('.glow')!).display).toBe('none');
	});
});
