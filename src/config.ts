export interface ApplicationTheme {}

export interface ApplicationConfig {
	application_name: string,
	logo_src: string,
	base_urls: string[],
	theme: ApplicationTheme
}

const config: ApplicationConfig = {
    application_name: "Turf Builder",
    logo_src: "/logos/default_logo.svg",
    base_urls: [
        "turfbuilder.org",
        "www.turfbuilder.org"
    ],
    theme: {
        "primaryColor": "",
        "secondaryColor": ""
    }
}

export default config