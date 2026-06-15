export interface IntegrationDef {
	id: string;
	name: string;
	description: string;
	/** SVG data URI shown as the logo. */
	logoUrl: string;
	/** When true the tile is non-interactive and shows a tooltip on hover. */
	disabled?: boolean;
	/** Tooltip text shown when the tile is disabled. */
	disabledMessage?: string;
	/** When true the toggle switch is hidden and the integration cannot be disabled. */
	permanent?: boolean;
}

function svgLogo(abbr: string, bg: string, fg = '#fff'): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
		<rect width="48" height="48" rx="10" fill="${bg}"/>
		<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
			font-family="system-ui,sans-serif" font-weight="700" font-size="16" fill="${fg}">${abbr}</text>
	</svg>`;
	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const INTEGRATIONS: IntegrationDef[] = [
	{
		id: 'overture_maps',
		name: 'Overture Maps Foundation',
		description: 'Import high-quality open map data including buildings, addresses, and places from the Overture Maps dataset.',
		logoUrl: svgLogo('OM', '#1b3a6b'),
		permanent: true
	},
	{
		id: 'google_sheets',
		name: 'Google Sheets',
		description: 'Import people and location data directly from Google Sheets.',
		logoUrl: svgLogo('GS', '#0f9d58'),
		disabled: true,
		disabledMessage: 'This integration is coming soon'
	},
	{
		id: 'van',
		name: 'VAN / EveryAction',
		description: 'Sync voter and volunteer records with the Voter Activation Network.',
		logoUrl: svgLogo('VAN', '#1a56db'),
		disabled: true,
		disabledMessage: 'This integration is coming soon'
	},
	{
		id: 'action_network',
		name: 'Action Network',
		description: 'Import supporters and actions from Action Network into your universe.',
		logoUrl: svgLogo('AN', '#e03131'),
		disabled: true,
		disabledMessage: 'This integration is coming soon'
	},
	{
		id: 'optakit',
		name: 'OptaKit',
		description: 'Connect with OptaKit to enhance your canvassing operations and data workflows.',
		logoUrl: svgLogo('OK', '#7c3aed'),
		disabled: true,
		disabledMessage: 'This integration is coming soon'
	}
];

export function settingKey(integrationId: string): string {
	return `integration.${integrationId}.enabled`;
}
