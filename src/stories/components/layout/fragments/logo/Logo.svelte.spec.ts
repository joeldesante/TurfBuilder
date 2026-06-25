import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Logo from './Logo.svelte';

test('renders an svg with role img', async () => {
  const { getByRole } = render(Logo);
  await expect.element(getByRole('img', { name: 'Logo' })).toBeVisible();
});

test('defaults to 200px width', async () => {
  const { getByRole } = render(Logo);
  const svg = getByRole('img', { name: 'Logo' });
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('width: 200px'));
});

test('sets explicit width in pixels', async () => {
  const { getByRole } = render(Logo, { props: { width: 300 } });
  const svg = getByRole('img', { name: 'Logo' });
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('width: 300px'));
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('height: auto'));
});

test('sets explicit height and auto width', async () => {
  const { getByRole } = render(Logo, { props: { height: 80 } });
  const svg = getByRole('img', { name: 'Logo' });
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('height: 80px'));
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('width: auto'));
});

test('width takes precedence over height', async () => {
  const { getByRole } = render(Logo, { props: { width: 200, height: 80 } });
  const svg = getByRole('img', { name: 'Logo' });
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('width: 200px'));
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('height: auto'));
});

test('applies custom color via css color property', async () => {
  const { getByRole } = render(Logo, { props: { color: '#ff0000' } });
  const svg = getByRole('img', { name: 'Logo' });
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('color: #ff0000'));
});

test('defaults color to var(--primary)', async () => {
  const { getByRole } = render(Logo);
  const svg = getByRole('img', { name: 'Logo' });
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('color: var(--primary)'));
});

test('accepts string width values', async () => {
  const { getByRole } = render(Logo, { props: { width: '50%' } });
  const svg = getByRole('img', { name: 'Logo' });
  await expect.element(svg).toHaveAttribute('style', expect.stringContaining('width: 50%'));
});
