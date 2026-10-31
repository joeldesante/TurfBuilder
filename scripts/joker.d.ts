// Joker ships a declaration file that is a script, not a module, so TypeScript
// cannot import it. This declares the part the setup spec uses.
declare module '@amilajack/joker' {
	interface JokerResult {
		code: number;
		stdout: string;
		stderr: string;
	}

	export default class Joker {
		env(key: string, value: string | undefined): Joker;
		timeout(ms: number): Joker;
		run(cmd: string): Joker;
		stdin(data: string): Joker;
		expect(fn: (result: JokerResult) => void): Joker;
		end(): Promise<unknown>;
	}
}
