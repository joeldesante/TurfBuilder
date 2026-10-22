import { describe, it, expect } from 'vitest';
import { sanitizeEvent } from './analytics';

const ROUTE = '/invite/[token]';
const ORIGIN = 'https://turfbuilder.org';

describe('sanitizeEvent', () => {
	it('replaces URLs and paths with the route pattern', () => {
		const event = sanitizeEvent(
			{
				properties: {
					$current_url: 'https://turfbuilder.org/invite/secret-token?x=1',
					$pathname: '/invite/secret-token',
					$session_entry_url: 'https://turfbuilder.org/o/riverside/s/turfs/9'
				}
			},
			ROUTE,
			ORIGIN
		);

		expect(event.properties).toEqual({
			$current_url: 'https://turfbuilder.org/invite/[token]',
			$pathname: '/invite/[token]',
			$session_entry_url: 'https://turfbuilder.org/invite/[token]'
		});
	});

	it('drops referrers and page titles, which can carry names', () => {
		const event = sanitizeEvent(
			{
				properties: { $referrer: 'https://x.org/o/riverside', title: 'Riverside turf 9', $browser: 'Firefox' },
				$set_once: { $initial_referrer: 'https://x.org/o/riverside', $initial_current_url: 'https://x.org/o/riverside' }
			},
			ROUTE,
			ORIGIN
		);

		expect(event.properties).toEqual({ $browser: 'Firefox' });
		expect(event.$set_once).toEqual({ $initial_current_url: 'https://turfbuilder.org/invite/[token]' });
		expect(JSON.stringify(event)).not.toContain('riverside');
	});
});
