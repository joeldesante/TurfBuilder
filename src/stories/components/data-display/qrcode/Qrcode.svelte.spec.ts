import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Qrcode from './Qrcode.svelte';

describe('Qrcode', () => {
	it('renders a canvas element', async () => {
		const { container } = render(Qrcode, { uri: 'otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP' });
		const canvas = container.querySelector('canvas');
		expect(canvas).toBeTruthy();
	});

	it('renders the canvas inside a div wrapper', async () => {
		const { container } = render(Qrcode, { uri: 'otpauth://totp/Test?secret=ABC123' });
		const wrapper = container.querySelector('div');
		expect(wrapper).toBeTruthy();
		const canvas = wrapper!.querySelector('canvas');
		expect(canvas).toBeTruthy();
	});
});
