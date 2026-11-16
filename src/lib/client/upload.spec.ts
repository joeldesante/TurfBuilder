import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { putFile } from './upload';

class FakeXhr {
	static last: FakeXhr;
	method = '';
	url = '';
	headers: Record<string, string> = {};
	body: unknown;
	status = 200;
	upload: {
		onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void;
	} = {};
	onload?: () => void;
	onerror?: () => void;
	constructor() {
		FakeXhr.last = this;
	}
	open(method: string, url: string) {
		this.method = method;
		this.url = url;
	}
	setRequestHeader(name: string, value: string) {
		this.headers[name] = value;
	}
	send(body: unknown) {
		this.body = body;
	}
}

beforeEach(() => {
	vi.stubGlobal('XMLHttpRequest', FakeXhr);
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('putFile', () => {
	it('puts the file to the url with the content type', async () => {
		const file = new Blob(['a,b']);
		const done = putFile('https://signed.example/put', file, 'text/csv');
		FakeXhr.last.onload?.();
		await done;

		expect(FakeXhr.last.method).toBe('PUT');
		expect(FakeXhr.last.url).toBe('https://signed.example/put');
		expect(FakeXhr.last.headers['Content-Type']).toBe('text/csv');
		expect(FakeXhr.last.body).toBe(file);
	});

	it('reports progress as a whole percent, ending at 100', async () => {
		const onProgress = vi.fn();
		const done = putFile('u', new Blob(['x']), 'text/csv', onProgress);
		FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 3 });
		FakeXhr.last.onload?.();
		await done;

		expect(onProgress.mock.calls.map((c) => c[0])).toEqual([33, 100]);
	});

	it('rejects when storage answers with an error status', async () => {
		const done = putFile('u', new Blob(['x']), 'text/csv');
		FakeXhr.last.status = 403;
		FakeXhr.last.onload?.();

		await expect(done).rejects.toThrow('The upload failed');
	});

	it('rejects when the network fails', async () => {
		const done = putFile('u', new Blob(['x']), 'text/csv');
		FakeXhr.last.onerror?.();

		await expect(done).rejects.toThrow('Could not reach storage');
	});
});
