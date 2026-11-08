import { createHmac } from 'node:crypto';

/** Decodes RFC 4648 base32, as TOTP secrets are written in otpauth:// URIs. */
function base32(text: string): Buffer {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = '';
	for (const char of text.replace(/=+$/, '').toUpperCase()) {
		const value = alphabet.indexOf(char);
		if (value < 0) throw new Error(`Not base32: ${char}`);
		bits += value.toString(2).padStart(5, '0');
	}
	const bytes = [];
	for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
	return Buffer.from(bytes);
}

/** The current 6-digit code for a TOTP secret (RFC 6238: SHA-1, 30-second steps), like an authenticator app shows. */
export function totp(secret: string, at = Date.now()): string {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
	const hmac = createHmac('sha1', base32(secret)).update(counter).digest();
	const offset = hmac[hmac.length - 1] & 0xf;
	const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
	return String(code).padStart(6, '0');
}

/** The secret in an otpauth://totp/...?secret=... URI. */
export function secretOf(uri: string): string {
	const secret = new URL(uri).searchParams.get('secret');
	if (!secret) throw new Error(`No secret in ${uri}`);
	return secret;
}

/**
 * A code from the next 30-second window, waiting for it to start. A code is
 * accepted once, so a test that just used one (setting two-factor up) needs
 * the next one to sign in.
 */
export async function nextTotp(secret: string): Promise<string> {
	const wait = 30_000 - (Date.now() % 30_000) + 500;
	await new Promise((resolve) => setTimeout(resolve, wait));
	return totp(secret);
}
