export async function load({ locals }) {
	return {
		config: locals.config ?? null,
		infraAccess: locals.infrastructure?.permissions.includes('access') ?? false
	};
}
