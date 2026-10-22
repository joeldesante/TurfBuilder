import type { Component } from 'svelte';
import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
import ChartLineIcon from 'phosphor-svelte/lib/ChartLine';
import BuildingsIcon from 'phosphor-svelte/lib/Buildings';
import UsersIcon from 'phosphor-svelte/lib/Users';
import ShieldCheckIcon from 'phosphor-svelte/lib/ShieldCheck';
import ListChecksIcon from 'phosphor-svelte/lib/ListChecks';
import GearIcon from 'phosphor-svelte/lib/Gear';
import EnvelopeIcon from 'phosphor-svelte/lib/Envelope';
import TrayIcon from 'phosphor-svelte/lib/Tray';
import HeartbeatIcon from 'phosphor-svelte/lib/Heartbeat';
import ArrowsClockwiseIcon from 'phosphor-svelte/lib/ArrowsClockwise';
import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOut';
import type { InfraNavIcon } from '$lib/shared/utils/infra-nav';

/** The Phosphor icon for each infra nav entry. */
export const INFRA_NAV_ICONS: Record<InfraNavIcon, Component> = {
	overview: SquaresFourIcon,
	metrics: ChartLineIcon,
	organizations: BuildingsIcon,
	users: UsersIcon,
	admins: ShieldCheckIcon,
	audit: ListChecksIcon,
	settings: GearIcon,
	email: EnvelopeIcon,
	'email-log': TrayIcon,
	health: HeartbeatIcon,
	migrate: ArrowsClockwiseIcon,
	external: ArrowSquareOutIcon
};
