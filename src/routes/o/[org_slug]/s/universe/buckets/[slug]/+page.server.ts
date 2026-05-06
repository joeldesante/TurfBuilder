export async function load({ params }) {
	// TODO: query bucket table once it exists (slug + org-scoped SELECT)
	return {
		name: params.slug,
		description: undefined as string | undefined
	};
}
