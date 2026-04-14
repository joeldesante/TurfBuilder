export interface ApplicationTheme {}

export interface ApplicationConfig {
	application_name: string;
	logo_src: string;
	base_origins: string[];
	theme: ApplicationTheme;
}

let baseUrlArray = (process.env.BASE_URL_ARRAY || '').split(',').filter(Boolean);

const config: ApplicationConfig = {
	application_name: 'Turf Builder',
	logo_src: '/logos/default_logo.svg',
	base_origins: baseUrlArray,
	theme: {
		primaryColor: '',
		secondaryColor: ''
	}
};

export default config;
