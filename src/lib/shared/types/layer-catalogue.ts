import type { CataloguePage } from '$lib/shared/registries/layer-catalogue';

/** GET /api/v1/layer-catalogue/data-gov: one page of data.gov datasets that can be loaded as map layers. */
export type DataGovSearchResult = CataloguePage & {
	/** Pass back as `after` to get the next page; null on the last page. */
	next: string | null;
};

/** GET /api/v1/layer-catalogue/ckan: one page of one CKAN city portal's datasets that can be loaded as map layers. */
export type CkanSearchResult = CataloguePage & {
	/** Pass back as `start` to get the next page; null on the last page. */
	next: number | null;
};
