/** A system setting's current value, as the settings page receives it. */
export interface SystemSettingValue {
	key: string;
	value: string;
	/** ISO timestamp of the last save; null when it has never been saved. */
	updatedAt: string | null;
}
