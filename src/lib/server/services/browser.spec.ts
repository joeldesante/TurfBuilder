import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { launch } = vi.hoisted(() => ({ launch: vi.fn() }));

vi.mock('puppeteer', () => ({ default: { launch } }));

import { launchBrowser } from './browser';

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('launchBrowser', () => {
	it('keeps the Chrome sandbox when not running as root', async () => {
		vi.spyOn(process, 'getuid').mockReturnValue(1000);

		await launchBrowser(['--flag']);

		expect(launch).toHaveBeenCalledWith({ args: ['--flag'] });
	});

	// Chrome refuses to sandbox itself as root, which is how the containers run.
	it('drops the sandbox only when running as root', async () => {
		vi.spyOn(process, 'getuid').mockReturnValue(0);

		await launchBrowser(['--flag']);

		expect(launch).toHaveBeenCalledWith({ args: ['--no-sandbox', '--flag'] });
	});
});
