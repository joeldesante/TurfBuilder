/**
 * Sends a file to a presigned storage URL with a PUT and reports progress.
 * `fetch` cannot report upload progress, so this uses XMLHttpRequest.
 * Rejects with a message that is safe to show the user.
 */
export function putFile(
	url: string,
	file: Blob,
	contentType: string,
	onProgress?: (percent: number) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.setRequestHeader('Content-Type', contentType);

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				onProgress?.(100);
				resolve();
			} else {
				reject(new Error('The upload failed. Try again.'));
			}
		};
		xhr.onerror = () =>
			reject(new Error('Could not reach storage. Check your connection and try again.'));

		xhr.send(file);
	});
}
