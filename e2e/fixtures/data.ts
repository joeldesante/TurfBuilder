import type { LocationRow } from './world';

/** Four places: two in Philadelphia, one across the river in Camden NJ, one in Pittsburgh. */
export const LOCATIONS: LocationRow[] = [
	{
		name: 'Liberty Bell',
		address_line_1: '526 Market St',
		city: 'Philadelphia',
		state_or_region: 'PA',
		postal_code: '19106',
		country_code: 'US',
		latitude: 39.9496,
		longitude: -75.1503
	},
	{
		name: 'City Hall',
		address_line_1: '1400 John F Kennedy Blvd',
		city: 'Philadelphia',
		state_or_region: 'PA',
		postal_code: '19107',
		country_code: 'US',
		latitude: 39.9526,
		longitude: -75.1652
	},
	{
		name: 'Camden Aquarium',
		address_line_1: '1 Riverside Dr',
		city: 'Camden',
		state_or_region: 'NJ',
		postal_code: '08103',
		country_code: 'US',
		latitude: 39.9447,
		longitude: -75.1306
	},
	{
		name: 'Pittsburgh Point',
		address_line_1: '601 Commonwealth Pl',
		city: 'Pittsburgh',
		state_or_region: 'PA',
		postal_code: '15222',
		country_code: 'US',
		latitude: 40.4417,
		longitude: -80.0084
	}
];

export const PEOPLE = [
	{
		first_name: 'Ada',
		last_name: 'Lovelace',
		dob: '1990-12-10',
		email: 'ada@example.test',
		phone: ''
	},
	{ first_name: 'Grace', last_name: 'Hopper', dob: '1960-12-09', email: '', phone: '555-0100' },
	{ first_name: 'Alan', last_name: 'Turing', dob: '2010-06-23', email: '', phone: '' }
];
