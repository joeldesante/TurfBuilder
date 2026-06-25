export function isNavActive(href: string, currentPath: string): boolean {
	const normHref = href.endsWith('/') ? href : href + '/';
	const normPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
	return normPath.startsWith(normHref);
}
