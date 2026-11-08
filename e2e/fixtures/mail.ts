import { expect } from '@playwright/test';

/**
 * Reads the mail the app sent, from the Mailpit container in
 * docker-compose.test.yml (the setup project points the app's SMTP transport
 * at it).
 */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

export interface Mail {
	id: string;
	subject: string;
	to: string[];
	html: string;
	text: string;
}

interface Summary {
	ID: string;
	Subject: string;
	To: { Address: string }[];
	Created: string;
}

async function search(query: string): Promise<Summary[]> {
	const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}`);
	if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
	return ((await res.json()) as { messages: Summary[] }).messages;
}

async function read(id: string): Promise<Mail> {
	const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
	const m = (await res.json()) as { ID: string; Subject: string; To: { Address: string }[]; HTML: string; Text: string };
	return { id: m.ID, subject: m.Subject, to: m.To.map((t) => t.Address), html: m.HTML, text: m.Text };
}

/**
 * The newest message to `to` (whose subject contains `subject`, when given),
 * waiting up to 30 seconds for it to arrive.
 */
export async function waitForMail(to: string, { subject }: { subject?: string } = {}): Promise<Mail> {
	let found: Summary | undefined;
	await expect(async () => {
		const messages = await search(`to:"${to}"`);
		found = messages.find((m) => !subject || m.Subject.includes(subject));
		expect(found, `a message to ${to}${subject ? ` about "${subject}"` : ''}`).toBeTruthy();
	}).toPass({ timeout: 30_000 });
	return read(found!.ID);
}

/** How many messages have been sent to `to` so far. */
export async function mailCount(to: string): Promise<number> {
	return (await search(`to:"${to}"`)).length;
}

/** The first link in the message whose URL contains `contains`. */
export function linkIn(mail: Mail, contains: string): string {
	const links = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'));
	const link = links.find((l) => l.includes(contains));
	if (!link) throw new Error(`No link containing "${contains}" in "${mail.subject}": ${links.join(', ')}`);
	return link;
}
