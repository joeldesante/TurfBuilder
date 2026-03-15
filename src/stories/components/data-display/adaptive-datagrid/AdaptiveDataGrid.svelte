<script lang="ts">
	export interface Column {
		key: string;
		label: string;
		width?: number;
	}

	interface Props {
		columns: Column[];
		data: Record<string, unknown>[];
		readonly?: boolean;
		loading?: boolean;
		onchange?: (rowIndex: number, key: string, value: string) => void;
		oncolumnadd?: (col: Column) => void;
		onloadmore?: () => void;
	}

	let {
		columns,
		data,
		readonly = false,
		loading = false,
		onchange,
		oncolumnadd,
		onloadmore
	}: Props = $props();

	const DEFAULT_CELL_WIDTH = 96;
	const DEFAULT_CELL_HEIGHT = 28;
	const HEADER_HEIGHT = 36;
	const TOTAL_COLS = 26;
	const INACTIVE_ROW_BUFFER = 50;

	// ── Theme helpers ─────────────────────────────────────────────────────────

	// Read a CSS variable value from the component root at render time.
	function theme(name: string, fallback: string): string {
		if (!scrollEl) return fallback;
		return getComputedStyle(scrollEl).getPropertyValue(name).trim() || fallback;
	}

	// Parse a CSS hex or rgb() color into a 0–1 RGB triple for WebGL.
	function parseColor(c: string): [number, number, number] {
		c = c.trim();
		if (c.startsWith('#')) {
			const h = c.slice(1);
			if (h.length === 3)
				return [
					parseInt(h[0] + h[0], 16) / 255,
					parseInt(h[1] + h[1], 16) / 255,
					parseInt(h[2] + h[2], 16) / 255
				];
			return [
				parseInt(h.slice(0, 2), 16) / 255,
				parseInt(h.slice(2, 4), 16) / 255,
				parseInt(h.slice(4, 6), 16) / 255
			];
		}
		const m = c.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
		if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
		return [0.92, 0.92, 0.95];
	}

	// Return an rgba() string from a CSS hex/rgb color with a given alpha.
	function colorAlpha(c: string, a: number): string {
		const [r, g, b] = parseColor(c);
		return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
	}

	let localColumns = $state<Column[]>([...columns]);
	$effect(() => {
		localColumns = [...columns];
	});

	let activeCols = $derived(localColumns.length);
	let displayCols = $derived(Math.max(TOTAL_COLS, activeCols));
	let activeRows = $derived(data.length);
	let displayRows = $derived(Math.max(activeRows + INACTIVE_ROW_BUFFER, 100));

	let scrollEl: HTMLDivElement;
	let canvasElm: HTMLCanvasElement;
	let textCanvasElm: HTMLCanvasElement;
	let cellInputElm = $state<HTMLInputElement>();
	let scrollTop = $state(0);
	let viewportHeight = $state(0);

	// ── Infinite scroll / pagination ──────────────────────────────────────────

	// Tracks the data.length at the time we last fired onloadmore.
	// Reset to 0 whenever data grows, allowing the next near-bottom scroll to trigger again.
	let loadMoreDataLength = 0;

	// Drives the skeleton shimmer animation at 60fps while loading.
	let skeletonAnimTime = $state(0);
	$effect(() => {
		if (!loading) {
			skeletonAnimTime = 0;
			return;
		}
		let rafId: number;
		function tick(ts: number) {
			skeletonAnimTime = ts;
			rafId = requestAnimationFrame(tick);
		}
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	});

	$effect(() => {
		// When data grows, clear the guard so we can trigger again if still near bottom.
		if (data.length > loadMoreDataLength) loadMoreDataLength = 0;
		if (!onloadmore || !activeRows || loadMoreDataLength > 0) return;

		// Fire when within ~1 viewport of the end of loaded data.
		const scrollBottom = scrollTop + viewportHeight - HEADER_HEIGHT;
		const threshold = Math.max(10 * DEFAULT_CELL_HEIGHT, viewportHeight - HEADER_HEIGHT);
		if (scrollBottom >= activeRows * DEFAULT_CELL_HEIGHT - threshold) {
			loadMoreDataLength = data.length;
			onloadmore();
		}
	});

	// Selection: two corners defining a rectangular region
	let selStart = $state<{ row: number; col: number } | null>(null);
	let selEnd = $state<{ row: number; col: number } | null>(null);
	// The cell currently open for text editing
	let editCell = $state<{ row: number; col: number } | null>(null);
	let inputValue = $state('');
	let pointerDown = false;

	let sel = $derived(
		selStart && selEnd
			? {
					r1: Math.min(selStart.row, selEnd.row),
					c1: Math.min(selStart.col, selEnd.col),
					r2: Math.max(selStart.row, selEnd.row),
					c2: Math.max(selStart.col, selEnd.col)
				}
			: null
	);

	let cellEdits = $state<Record<string, string>>({});

	function isActiveCol(col: number) {
		return col < activeCols;
	}
	function isActiveRow(row: number) {
		return row < activeRows;
	}

	function isEdited(row: number, col: number): boolean {
		const key = `${row},${col}`;
		if (!(key in cellEdits)) return false;
		const colDef = localColumns[col];
		if (!colDef) return false;
		const original = data[row]?.[colDef.key];
		return cellEdits[key] !== (original != null ? String(original) : '');
	}

	function getCellValue(row: number, col: number): string {
		const key = `${row},${col}`;
		if (key in cellEdits) return cellEdits[key];
		const colDef = localColumns[col];
		if (!colDef) return '';
		const v = data[row]?.[colDef.key];
		return v != null ? String(v) : '';
	}

	// ── History ───────────────────────────────────────────────────────────────

	interface EditOp {
		row: number;
		col: number;
		oldValue: string;
		newValue: string;
	}
	let undoStack: EditOp[][] = [];
	let redoStack: EditOp[][] = [];
	let activeBatch: EditOp[] | null = null;

	function beginBatch() {
		activeBatch = [];
	}
	function endBatch() {
		if (activeBatch?.length) {
			undoStack.push(activeBatch);
			redoStack = [];
		}
		activeBatch = null;
	}

	function setCellValue(row: number, col: number, value: string) {
		const oldValue = getCellValue(row, col);
		cellEdits[`${row},${col}`] = value;
		const colDef = localColumns[col];
		if (colDef) onchange?.(row, colDef.key, value);
		const op: EditOp = { row, col, oldValue, newValue: value };
		if (activeBatch) {
			activeBatch.push(op);
		} else {
			undoStack.push([op]);
			redoStack = [];
		}
	}

	function applyOps(ops: EditOp[], direction: 'undo' | 'redo') {
		const ordered = direction === 'undo' ? [...ops].reverse() : ops;
		for (const op of ordered) {
			const val = direction === 'undo' ? op.oldValue : op.newValue;
			cellEdits[`${op.row},${op.col}`] = val;
			const colDef = localColumns[op.col];
			if (colDef) onchange?.(op.row, colDef.key, val);
		}
	}

	function undo() {
		const batch = undoStack.pop();
		if (!batch) return;
		applyOps(batch, 'undo');
		redoStack.push(batch);
	}

	function redo() {
		const batch = redoStack.pop();
		if (!batch) return;
		applyOps(batch, 'redo');
		undoStack.push(batch);
	}

	function colWidth(col: number): number {
		return localColumns[col]?.width ?? DEFAULT_CELL_WIDTH;
	}

	function colX(col: number): number {
		let x = 0;
		for (let i = 0; i < col; i++) x += colWidth(i);
		return x;
	}

	let totalWidth = $derived(() => {
		let w = 0;
		for (let i = 0; i < displayCols; i++) w += colWidth(i);
		return w;
	});

	let canvasHeight = $derived(Math.max(0, viewportHeight - HEADER_HEIGHT));

	function addColumn(atIndex: number) {
		const newCol: Column = {
			key: `field_${atIndex}`,
			label: `Column ${atIndex + 1}`,
			width: DEFAULT_CELL_WIDTH
		};
		localColumns = [...localColumns, newCol];
		oncolumnadd?.(newCol);
	}

	function cellFromEvent(e: MouseEvent): { row: number; col: number } | null {
		const rect = canvasElm.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		let col = -1,
			cx = 0;
		for (let i = 0; i < displayCols; i++) {
			cx += colWidth(i);
			if (x < cx) {
				col = i;
				break;
			}
		}
		const row = Math.floor((y + scrollTop) / DEFAULT_CELL_HEIGHT);
		if (col < 0 || row < 0 || row >= displayRows) return null;
		return { row, col };
	}

	function commitEdit() {
		if (editCell) {
			if (!readonly) setCellValue(editCell.row, editCell.col, inputValue);
			editCell = null;
		}
	}

	// ── Bulk actions ──────────────────────────────────────────────────────────

	function deleteSelection() {
		if (!sel || readonly) return;
		beginBatch();
		for (let row = sel.r1; row <= sel.r2; row++) {
			for (let col = sel.c1; col <= sel.c2; col++) {
				if (isActiveCol(col) && isActiveRow(row)) setCellValue(row, col, '');
			}
		}
		endBatch();
	}

	function selectionToCSV(): string {
		if (!sel) return '';
		const lines: string[] = [];
		for (let row = sel.r1; row <= sel.r2; row++) {
			const cells: string[] = [];
			for (let col = sel.c1; col <= sel.c2; col++) {
				const v = getCellValue(row, col);
				cells.push(
					v.includes(',') || v.includes('\n') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
				);
			}
			lines.push(cells.join(','));
		}
		return lines.join('\n');
	}

	async function copySelection() {
		await navigator.clipboard.writeText(selectionToCSV());
	}

	async function cutSelection() {
		await navigator.clipboard.writeText(selectionToCSV());
		deleteSelection();
	}

	function parseCSV(text: string): string[][] {
		const rows: string[][] = [];
		for (const line of text.split(/\r?\n/)) {
			if (!line) continue;
			const cells: string[] = [];
			let i = 0;
			while (i < line.length) {
				if (line[i] === '"') {
					let val = '';
					i++;
					while (i < line.length) {
						if (line[i] === '"' && line[i + 1] === '"') {
							val += '"';
							i += 2;
						} else if (line[i] === '"') {
							i++;
							break;
						} else val += line[i++];
					}
					cells.push(val);
					if (line[i] === ',') i++;
				} else {
					const end = line.indexOf(',', i);
					if (end === -1) {
						cells.push(line.slice(i));
						break;
					}
					cells.push(line.slice(i, end));
					i = end + 1;
				}
			}
			rows.push(cells);
		}
		return rows;
	}

	async function pasteFromClipboard() {
		if (readonly || !sel) return;
		const text = await navigator.clipboard.readText();
		const rows = parseCSV(text);
		beginBatch();
		for (let r = 0; r < rows.length; r++) {
			for (let c = 0; c < rows[r].length; c++) {
				const row = sel.r1 + r,
					col = sel.c1 + c;
				if (row < displayRows && col < displayCols && isActiveCol(col))
					setCellValue(row, col, rows[r][c]);
			}
		}
		endBatch();
	}

	// ── WebGL setup ───────────────────────────────────────────────────────────

	const VERT_SRC = `
		attribute vec2 a_position;
		uniform vec2 u_resolution;
		void main() {
			vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
			gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
		}
	`;
	const FRAG_SRC = `
		precision mediump float;
		uniform vec4 u_color;
		void main() { gl_FragColor = u_color; }
	`;

	function pushLine(verts: number[], x0: number, y0: number, x1: number, y1: number) {
		if (y0 === y1) {
			const top = y0 - 0.5,
				bot = y0 + 0.5;
			verts.push(x0, top, x1, top, x0, bot, x1, top, x1, bot, x0, bot);
		} else {
			const left = x0 - 0.5,
				right = x0 + 0.5;
			verts.push(left, y0, right, y0, left, y1, right, y0, right, y1, left, y1);
		}
	}

	let gl: WebGLRenderingContext | null = null;
	let aPosition = -1;
	let uResolution: WebGLUniformLocation | null = null;
	let uColor: WebGLUniformLocation | null = null;
	let buffer: WebGLBuffer | null = null;

	function initGL() {
		gl = canvasElm.getContext('webgl', { premultipliedAlpha: false, antialias: false })!;
		gl.disable(gl.BLEND);
		const vert = gl.createShader(gl.VERTEX_SHADER)!;
		gl.shaderSource(vert, VERT_SRC);
		gl.compileShader(vert);
		const frag = gl.createShader(gl.FRAGMENT_SHADER)!;
		gl.shaderSource(frag, FRAG_SRC);
		gl.compileShader(frag);
		const program = gl.createProgram()!;
		gl.attachShader(program, vert);
		gl.attachShader(program, frag);
		gl.linkProgram(program);
		gl.useProgram(program);
		aPosition = gl.getAttribLocation(program, 'a_position');
		uResolution = gl.getUniformLocation(program, 'u_resolution');
		uColor = gl.getUniformLocation(program, 'u_color');
		buffer = gl.createBuffer();
	}

	$effect(() => {
		const tw = totalWidth();
		if (!canvasHeight || !tw) return;
		if (!gl) initGL();

		const dpr = window.devicePixelRatio ?? 1;
		const pw = tw * dpr,
			ph = canvasHeight * dpr;

		if (canvasElm.width !== pw || canvasElm.height !== ph) {
			canvasElm.width = pw;
			canvasElm.height = ph;
			canvasElm.style.width = `${tw}px`;
			canvasElm.style.height = `${canvasHeight}px`;
		}

		const firstRow = Math.floor(scrollTop / DEFAULT_CELL_HEIGHT);
		const lastRow = Math.min(
			firstRow + Math.ceil(canvasHeight / DEFAULT_CELL_HEIGHT) + 2,
			displayRows
		);
		const yOff = -(scrollTop % DEFAULT_CELL_HEIGHT) * dpr;

		const verts: number[] = [];
		pushLine(verts, 0, 0, pw, 0);
		pushLine(verts, 0, 0, 0, ph);
		for (let col = 0; col <= displayCols; col++)
			pushLine(verts, colX(col) * dpr, 0, colX(col) * dpr, ph);
		for (let row = firstRow + 1; row <= lastRow; row++) {
			const y = (row - firstRow) * DEFAULT_CELL_HEIGHT * dpr + yOff;
			pushLine(verts, 0, y, pw, y);
		}

		const [lr, lg, lb] = parseColor(theme('--adg-grid-line', '#d1fae5'));
		const [br, bg, bb] = parseColor(theme('--adg-cell-bg', '#ffffff'));

		gl!.uniform4f(uColor, lr, lg, lb, 1.0);
		gl!.uniform2f(uResolution, pw, ph);
		gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
		gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(verts), gl!.DYNAMIC_DRAW);
		gl!.enableVertexAttribArray(aPosition);
		gl!.vertexAttribPointer(aPosition, 2, gl!.FLOAT, false, 0, 0);
		gl!.viewport(0, 0, pw, ph);
		gl!.clearColor(br, bg, bb, 1.0);
		gl!.clear(gl!.COLOR_BUFFER_BIT);
		gl!.drawArrays(gl!.TRIANGLES, 0, verts.length / 2);
	});

	// 2D text + overlays
	$effect(() => {
		const tw = totalWidth();
		const animT = skeletonAnimTime; // always read so Svelte tracks it during shimmer
		if (!canvasHeight || !textCanvasElm || !tw) return;

		const dpr = window.devicePixelRatio ?? 1;
		const pw = tw * dpr,
			ph = canvasHeight * dpr;

		if (textCanvasElm.width !== pw || textCanvasElm.height !== ph) {
			textCanvasElm.width = pw;
			textCanvasElm.height = ph;
			textCanvasElm.style.width = `${tw}px`;
			textCanvasElm.style.height = `${canvasHeight}px`;
		}

		// Read theme colors once per render
		const colorInactiveCol = theme('--adg-inactive-col-bg', '#f0fdf9');
		const colorInactiveRow = theme('--adg-inactive-bg', '#f8fffe');
		const colorText = theme('--adg-text', '#1f2937');
		const colorPrimary = theme('--adg-primary', '#047857');

		const ctx = textCanvasElm.getContext('2d')!;
		ctx.clearRect(0, 0, pw, ph);
		ctx.scale(dpr, dpr);

		const firstRow = Math.floor(scrollTop / DEFAULT_CELL_HEIGHT);
		const lastRow = Math.min(
			firstRow + Math.ceil(canvasHeight / DEFAULT_CELL_HEIGHT) + 2,
			displayRows
		);
		const yOff = -(scrollTop % DEFAULT_CELL_HEIGHT);

		// Inactive column fill
		for (let col = activeCols; col < displayCols; col++) {
			ctx.fillStyle = colorInactiveCol;
			ctx.fillRect(colX(col) + 1, 0, colWidth(col) - 1, canvasHeight);
		}
		// Inactive row fill
		const inactiveY = (Math.min(activeRows, lastRow) - firstRow) * DEFAULT_CELL_HEIGHT + yOff;
		if (inactiveY < canvasHeight) {
			ctx.fillStyle = colorInactiveRow;
			ctx.fillRect(0, inactiveY, tw, canvasHeight - inactiveY);
		}

		// Skeleton loading rows — animated shimmer wave while waiting for data
		if (loading) {
			const barFractions = [0.68, 0.52, 0.61, 0.44, 0.72, 0.57, 0.48, 0.65];
			const skelCount = Math.ceil(canvasHeight / DEFAULT_CELL_HEIGHT) + 1;
			// Derive skeleton bar color from primary (very faint tint)
			const skelBase = colorAlpha(colorPrimary, 0.06);
			const skelBar = colorAlpha(colorPrimary, 0.1);

			for (let i = 0; i < skelCount; i++) {
				const row = activeRows + i;
				if (row >= displayRows) break;
				const rowY = (row - firstRow) * DEFAULT_CELL_HEIGHT + yOff;
				if (rowY + DEFAULT_CELL_HEIGHT <= 0 || rowY >= canvasHeight) continue;

				ctx.fillStyle = skelBase;
				ctx.fillRect(0, rowY + 1, tw, DEFAULT_CELL_HEIGHT - 1);

				for (let col = 0; col < activeCols; col++) {
					const frac = barFractions[(row + col) % barFractions.length];
					const barW = Math.max(0, colWidth(col) * frac - 12);
					ctx.fillStyle = skelBar;
					ctx.fillRect(colX(col) + 8, rowY + 9, barW, 10);
				}
			}

			const skelStartY = Math.max(0, (activeRows - firstRow) * DEFAULT_CELL_HEIGHT + yOff);
			if (skelStartY < canvasHeight) {
				const shimmerX = ((animT % 1200) / 1200) * (tw + 400) - 200;
				const shimmerGrad = ctx.createLinearGradient(shimmerX - 200, 0, shimmerX + 200, 0);
				shimmerGrad.addColorStop(0, 'rgba(255,255,255,0)');
				shimmerGrad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
				shimmerGrad.addColorStop(1, 'rgba(255,255,255,0)');
				ctx.fillStyle = shimmerGrad;
				ctx.fillRect(0, skelStartY, tw, canvasHeight - skelStartY);
			}
		}

		// Selection region — suppressed when a cell is actively being edited
		// (the input's own outline serves as the visual indicator)
		if (sel && !editCell) {
			const sx = colX(sel.c1);
			const sw = colX(sel.c2) + colWidth(sel.c2) - sx;
			const sy = (sel.r1 - firstRow) * DEFAULT_CELL_HEIGHT + yOff;
			const sh = (sel.r2 - sel.r1 + 1) * DEFAULT_CELL_HEIGHT;
			ctx.fillStyle = colorAlpha(colorPrimary, 0.08);
			ctx.fillRect(sx + 1, sy + 1, sw - 1, sh - 1);
			ctx.strokeStyle = colorAlpha(colorPrimary, 0.65);
			ctx.lineWidth = 1.5;
			ctx.strokeRect(sx + 1.75, sy + 1.75, sw - 2.5, sh - 2.5);
		}

		// Edited cell highlights
		for (let row = firstRow; row < lastRow; row++) {
			for (let col = 0; col < activeCols; col++) {
				if (!isEdited(row, col)) continue;
				const cx = colX(col),
					cy = (row - firstRow) * DEFAULT_CELL_HEIGHT + yOff;
				ctx.fillStyle = 'rgba(245, 158, 11, 0.10)';
				ctx.fillRect(cx + 1, cy + 1, colWidth(col) - 1, DEFAULT_CELL_HEIGHT - 1);
				const tx = cx + colWidth(col) - 1,
					ty = cy + 1,
					ts = 5;
				ctx.fillStyle = '#f59e0b';
				ctx.beginPath();
				ctx.moveTo(tx - ts, ty);
				ctx.lineTo(tx, ty);
				ctx.lineTo(tx, ty + ts);
				ctx.closePath();
				ctx.fill();
			}
		}

		// Cell text
		ctx.font = '13px system-ui, sans-serif';
		ctx.fillStyle = colorText;
		ctx.textBaseline = 'middle';
		for (let row = firstRow; row < lastRow; row++) {
			for (let col = 0; col < activeCols; col++) {
				if (editCell?.row === row && editCell?.col === col) continue;
				const value = getCellValue(row, col);
				if (!value) continue;
				const maxW = colWidth(col) - 16;
				let text = value;
				if (ctx.measureText(text).width > maxW) {
					let lo = 0,
						hi = text.length;
					while (lo < hi) {
						const mid = (lo + hi + 1) >> 1;
						if (ctx.measureText(text.slice(0, mid) + '\u2026').width <= maxW) lo = mid;
						else hi = mid - 1;
					}
					text = text.slice(0, lo) + '\u2026';
				}
				ctx.fillText(
					text,
					colX(col) + 8,
					(row - firstRow) * DEFAULT_CELL_HEIGHT + yOff + DEFAULT_CELL_HEIGHT / 2
				);
			}
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
	});

	$effect(() => {
		if (editCell && cellInputElm) cellInputElm.focus();
	});

	// ── Mouse interaction ─────────────────────────────────────────────────────

	// True when the mousedown landed on the already-selected single cell (second click → edit).
	let clickWasOnSelectedCell = false;

	function handleMousedown(e: MouseEvent) {
		if (e.button !== 0) return;
		commitEdit();
		const cell = cellFromEvent(e);
		if (!cell) return;
		// Record whether we're clicking the already-selected single cell.
		clickWasOnSelectedCell = !!(
			!e.shiftKey &&
			sel &&
			sel.r1 === sel.r2 &&
			sel.c1 === sel.c2 &&
			cell.row === sel.r1 &&
			cell.col === sel.c1
		);
		pointerDown = true;
		if (e.shiftKey && selStart) {
			selEnd = cell;
		} else {
			selStart = cell;
			selEnd = cell;
		}
	}

	function handleMousemove(e: MouseEvent) {
		if (!pointerDown) return;
		const cell = cellFromEvent(e);
		if (cell) selEnd = cell;
	}

	function handleMouseup(e: MouseEvent) {
		if (!pointerDown) return;
		pointerDown = false;
		const cell = cellFromEvent(e);
		if (cell) selEnd = cell;
		// Second click on the already-selected single active cell → enter edit mode.
		if (
			!readonly &&
			clickWasOnSelectedCell &&
			sel &&
			sel.r1 === sel.r2 &&
			sel.c1 === sel.c2 &&
			isActiveCol(sel.c1) &&
			isActiveRow(sel.r1)
		) {
			editCell = { row: sel.r1, col: sel.c1 };
			inputValue = getCellValue(sel.r1, sel.c1);
		}
		clickWasOnSelectedCell = false;
		scrollEl.focus();
	}

	// ── Keyboard ──────────────────────────────────────────────────────────────

	function handleScrollKeydown(e: KeyboardEvent) {
		if (!sel) return;
		// While a cell is open for editing the input handles all keys; nothing should bubble here.
		if (editCell) return;
		const { r1, c1, r2, c2 } = sel;

		// NOTE:
		// Maybe this should be a switch-case.
		// Not sure if it really matters here from a performance perspective.
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			deleteSelection();
			return;
		}
		if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
			e.preventDefault();
			copySelection();
			return;
		}
		if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
			e.preventDefault();
			cutSelection();
			return;
		}
		if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
			e.preventDefault();
			pasteFromClipboard();
			return;
		}
		if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
			e.preventDefault();
			if (e.shiftKey) redo();
			else undo();
			return;
		}
		if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) {
			e.preventDefault();
			redo();
			return;
		}

		// Enter / F2 → open the selected single cell for editing
		if (
			(e.key === 'Enter' || e.key === 'F2') &&
			!readonly &&
			r1 === r2 &&
			c1 === c2 &&
			isActiveRow(r1) &&
			isActiveCol(c1)
		) {
			e.preventDefault();
			editCell = { row: r1, col: c1 };
			inputValue = getCellValue(r1, c1);
			return;
		}

		// Arrow key navigation (moves the single-cell selection)
		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
			e.preventDefault();
			let row = r1,
				col = c1;
			if (e.key === 'ArrowUp') row = Math.max(0, r1 - 1);
			if (e.key === 'ArrowDown') row = Math.min(activeRows - 1, r2 + 1);
			if (e.key === 'ArrowLeft') col = Math.max(0, c1 - 1);
			if (e.key === 'ArrowRight') col = Math.min(activeCols - 1, c2 + 1);
			selStart = { row, col };
			selEnd = { row, col };
		}
	}

	function navigateTo(row: number, col: number) {
		commitEdit();
		row = Math.max(0, Math.min(activeRows - 1, row));
		col = Math.max(0, Math.min(activeCols - 1, col));
		selStart = { row, col };
		selEnd = { row, col };
		editCell = { row, col };
		inputValue = getCellValue(row, col);
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (!editCell) return;
		const { row, col } = editCell;
		switch (e.key) {
			case 'Enter':
				e.preventDefault();
				navigateTo(row + 1, col);
				break;
			case 'Tab':
				e.preventDefault();
				navigateTo(row, col + (e.shiftKey ? -1 : 1));
				break;
			case 'ArrowUp':
				e.preventDefault();
				navigateTo(row - 1, col);
				break;
			case 'ArrowDown':
				e.preventDefault();
				navigateTo(row + 1, col);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				navigateTo(row, col - 1);
				break;
			case 'ArrowRight':
				e.preventDefault();
				navigateTo(row, col + 1);
				break;
			case 'Escape':
				commitEdit();
				scrollEl.focus();
				break;
		}
	}

	function handleInputBlur() {
		commitEdit();
	}
</script>

<!-- tabindex makes the scroll container focusable for keydown events -->
<div
	class="adg-scroll"
	bind:this={scrollEl}
	bind:clientHeight={viewportHeight}
	onscroll={() => (scrollTop = scrollEl.scrollTop)}
	onkeydown={handleScrollKeydown}
	tabindex="0"
	role="grid"
	aria-label="Data grid"
>
	<div class="adg-header" style="width: {totalWidth()}px; height: {HEADER_HEIGHT}px;">
		{#each { length: displayCols } as _, i}
			{@const active = isActiveCol(i)}
			<button
				class="adg-header-cell"
				class:inactive={!active}
				style="left: {colX(i)}px; width: {colWidth(i)}px; height: {HEADER_HEIGHT}px;"
				onclick={() => !active && !readonly && addColumn(i)}
				tabindex={active ? -1 : 0}
			>
				{#if active}{localColumns[i].label}
				{:else if i === activeCols}<span class="adg-add-col">+</span>
				{/if}
			</button>
		{/each}
	</div>

	<div
		class="adg-spacer"
		style="height: {displayRows * DEFAULT_CELL_HEIGHT}px; width: {totalWidth()}px;"
	>
		<div class="adg-canvas-wrap" style="height: {canvasHeight}px; top: {HEADER_HEIGHT}px;">
			<canvas
				class="adg-cvs"
				bind:this={canvasElm}
				onmousedown={handleMousedown}
				onmousemove={handleMousemove}
				onmouseup={handleMouseup}
			></canvas>
			<canvas class="adg-text" bind:this={textCanvasElm}></canvas>
		</div>

		{#if editCell}
			<input
				class="adg-cell-input"
				bind:this={cellInputElm}
				bind:value={inputValue}
				onkeydown={handleInputKeydown}
				onblur={handleInputBlur}
				style="
					left: {colX(editCell.col) + 1}px;
					top: {editCell.row * DEFAULT_CELL_HEIGHT + 1}px;
					width: {colWidth(editCell.col) - 2}px;
					height: {DEFAULT_CELL_HEIGHT - 2}px;
				"
			/>
		{/if}
	</div>
</div>

<style>
	/* ── Default theme tokens (override from outside via CSS variables) ──────── */
	.adg-scroll {
		--adg-primary: #047857; /* emerald-700 */
		--adg-grid-line: #d1fae5; /* emerald-100 */
		--adg-border: #a7f3d0; /* emerald-200 */
		--adg-header-bg: #ecfdf5; /* emerald-50  */
		--adg-header-text: #065f46; /* emerald-800 */
		--adg-cell-bg: #ffffff;
		--adg-text: #1f2937; /* gray-800    */
		--adg-inactive-bg: #f8fffe;
		--adg-inactive-col-bg: #f0fdf9;
		--adg-radius: 10px;
	}

	/* ── Container ───────────────────────────────────────────────────────────── */
	.adg-scroll {
		overflow: auto;
		height: var(--adg-height, 400px);
		width: 100%;
		position: relative;
		overscroll-behavior: none;
		outline: none;
		border-radius: var(--adg-radius);
		border: 1px solid var(--adg-border);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.05),
			0 4px 16px rgba(4, 120, 87, 0.07);
	}

	.adg-scroll:focus-visible {
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.05),
			0 4px 16px rgba(4, 120, 87, 0.07),
			0 0 0 3px color-mix(in srgb, var(--adg-primary) 25%, transparent);
	}

	/* ── Header ──────────────────────────────────────────────────────────────── */
	.adg-header {
		position: sticky;
		top: 0;
		left: 0;
		z-index: 2;
		background: var(--adg-header-bg);
		border-bottom: 1px solid var(--adg-border);
		box-sizing: border-box;
	}

	.adg-header-cell {
		position: absolute;
		top: 0;
		box-sizing: border-box;
		padding: 0 10px;
		display: flex;
		align-items: center;
		gap: 4px;
		font:
			600 12px/1 system-ui,
			sans-serif;
		letter-spacing: 0.025em;
		text-transform: uppercase;
		color: var(--adg-header-text);
		border: none;
		border-right: 1px solid var(--adg-border);
		background: var(--adg-header-bg);
		overflow: hidden;
		white-space: nowrap;
		cursor: default;
		text-align: left;
		transition:
			background 120ms ease,
			color 120ms ease;
	}

	.adg-header-cell.inactive {
		background: var(--adg-inactive-col-bg);
		color: color-mix(in srgb, var(--adg-header-text) 40%, transparent);
		cursor: pointer;
		justify-content: center;
	}

	.adg-header-cell.inactive:hover {
		background: color-mix(in srgb, var(--adg-primary) 10%, transparent);
		color: var(--adg-primary);
	}

	.adg-add-col {
		font-size: 20px;
		font-weight: 300;
		line-height: 1;
		opacity: 0.6;
		transition: opacity 120ms ease;
	}

	.adg-header-cell.inactive:hover .adg-add-col {
		opacity: 1;
	}

	/* ── Canvas layers ───────────────────────────────────────────────────────── */
	.adg-spacer {
		position: relative;
	}

	.adg-canvas-wrap {
		position: sticky;
		left: 0;
	}

	.adg-cvs {
		display: block;
		pointer-events: auto;
		user-select: none;
	}

	.adg-text {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
	}

	/* ── Edit input ──────────────────────────────────────────────────────────── */
	.adg-cell-input {
		position: absolute;
		box-sizing: border-box;
		background: var(--adg-cell-bg);
		border: none;
		outline: 2px solid var(--adg-primary);
		outline-offset: -1px;
		border-radius: 4px;
		color: var(--adg-text);
		font:
			13px system-ui,
			sans-serif;
		padding: 0 8px;
		caret-color: var(--adg-primary);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--adg-primary) 15%, transparent);
	}
</style>
