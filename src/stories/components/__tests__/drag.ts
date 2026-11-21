/** Presses on `el`, moves the pointer by `dx` in small steps like a real drag, and releases. */
export async function dragBy(el: HTMLElement, dx: number) {
	// Let the first layout measurement finish, as it has by the time a person grabs something.
	await new Promise((r) => setTimeout(r, 300));
	const box = el.getBoundingClientRect();
	const startX = box.left + box.width / 2;
	const y = box.top + box.height / 2;
	const fire = (target: EventTarget, type: string, x: number) =>
		target.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				cancelable: true,
				isPrimary: true,
				pointerId: 1,
				pointerType: 'mouse',
				button: 0,
				buttons: type === 'pointerup' ? 0 : 1,
				clientX: x,
				clientY: y
			})
		);
	const frame = () => new Promise((r) => requestAnimationFrame(r));

	fire(el, 'pointerdown', startX);
	const steps = Math.ceil(Math.abs(dx) / 20);
	for (let i = 1; i <= steps; i++) {
		fire(window, 'pointermove', startX + (dx * i) / steps);
		await frame();
	}
	await new Promise((r) => setTimeout(r, 100));
	return () => fire(window, 'pointerup', startX + dx);
}
