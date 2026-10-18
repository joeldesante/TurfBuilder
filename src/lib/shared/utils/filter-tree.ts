import type { Filter, FilterGroup } from '../types/filters';
import { isFilterGroup } from './filters';

/** Position of a node in a filter tree: the index to take in each group, from the root down. */
export type FilterPath = number[];

type Node = Filter | FilterGroup;

/** Whether `path` is `ancestor` itself or lies somewhere beneath it. */
export function isSameOrDescendant(path: FilterPath, ancestor: FilterPath): boolean {
	return path.length >= ancestor.length && ancestor.every((index, depth) => path[depth] === index);
}

export function getNode(root: FilterGroup, path: FilterPath): Node | undefined {
	let node: Node = root;
	for (const index of path) {
		if (!isFilterGroup(node)) return undefined;
		const next: Node | undefined = node.filters[index];
		if (!next) return undefined;
		node = next;
	}
	return node;
}

/** Applies `change` to the group at `path`, copying every group on the way down. */
function updateGroup(
	group: FilterGroup,
	path: FilterPath,
	change: (group: FilterGroup) => FilterGroup
): FilterGroup {
	if (path.length === 0) return change(group);
	const [head, ...rest] = path;
	const child = group.filters[head];
	if (!child || !isFilterGroup(child)) return group;
	return {
		...group,
		filters: group.filters.map((entry, i) => (i === head ? updateGroup(child, rest, change) : entry))
	};
}

/**
 * Moves the node at `from` so it sits at `to`, which is a position in the tree
 * as it is before the move: the parent group's path followed by the index to
 * insert before. Returns the tree unchanged when the move is not possible,
 * including moving a group into itself or one of its own descendants.
 */
export function moveNode(root: FilterGroup, from: FilterPath, to: FilterPath): FilterGroup {
	if (from.length === 0 || to.length === 0) return root;
	if (isSameOrDescendant(to, from)) return root;

	const node = getNode(root, from);
	if (!node) return root;

	const depth = from.length - 1;
	const fromIndex = from[depth];
	const removed = updateGroup(root, from.slice(0, depth), (group) => ({
		...group,
		filters: group.filters.filter((_, i) => i !== fromIndex)
	}));

	// Removing the node shifts later siblings up, which moves the target with them.
	const target = [...to];
	const shares = from.slice(0, depth).every((index, d) => to[d] === index);
	if (shares && to.length > depth && to[depth] > fromIndex) target[depth] -= 1;

	const parent = getNode(removed, target.slice(0, -1));
	if (!parent || !isFilterGroup(parent)) return root;

	const insertAt = target[target.length - 1];
	return updateGroup(removed, target.slice(0, -1), (group) => {
		const filters = [...group.filters];
		filters.splice(insertAt, 0, node);
		return { ...group, filters };
	});
}
