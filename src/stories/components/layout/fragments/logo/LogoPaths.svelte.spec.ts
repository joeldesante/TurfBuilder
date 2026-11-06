import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import LogoPaths from './LogoPaths.svelte';

test('renders the logo shapes in the svg namespace', async () => {
  const { container } = render(LogoPaths);
  const group = container.querySelector('g');
  expect(group).toBeTruthy();
  expect(group!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  expect(container.querySelectorAll('path').length).toBeGreaterThan(5);
});

test('fills every shape with currentColor so the parent controls the color', async () => {
  const { container } = render(LogoPaths);
  const paths = [...container.querySelectorAll('path')];
  expect(paths.every((path) => path.getAttribute('style')?.includes('fill:currentColor'))).toBe(true);
});
