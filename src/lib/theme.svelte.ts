export type Theme = 'system' | 'light' | 'dark';

function createThemeStore() {
	let theme = $state<Theme>('system');
	let mediaQuery: MediaQueryList | null = null;

	function applyToDOM(t: Theme) {
		if (typeof document === 'undefined') return;
		const isDark = t === 'dark' || (t === 'system' && mediaQuery?.matches === true);
		document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
	}

	function apply(t: Theme) {
		theme = t;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('theme', t);
		}
		applyToDOM(t);
	}

	function init() {
		if (typeof window === 'undefined') return;

		mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', () => {
			if (theme === 'system') applyToDOM('system');
		});

		const saved = localStorage.getItem('theme') as Theme | null;
		apply(saved ?? 'system');
	}

	return {
		get theme() {
			return theme;
		},
		setTheme: apply,
		init
	};
}

export const themeStore = createThemeStore();
