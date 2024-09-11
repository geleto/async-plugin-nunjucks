import * as nunjucks from 'nunjucks';
import { ASTWalker } from './ASTWalker';
import { AsyncCompiler } from './AsyncCompiler';

//A dummy extension, only async environments have it, used to identify them
export class AsyncExtension implements nunjucks.Extension {
	tags: string[] = [];
	parse() {
	}
}

type NestedStringArray = (string | NestedStringArray)[];

export class AsyncEnvironment extends nunjucks.Environment {
	private static asyncExtension = new AsyncExtension();
	private static astWalker = new ASTWalker();
	static monkeyPatched = false;

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		super(loader, opts);

		this.addExtension('AsyncExtension', AsyncEnvironment.asyncExtension);
	}

	// Asynchronously render a template from a file with AST modification and caching
	async renderAsync(templateName: string, context: object): Promise<string> {
		let undoPatch: () => void;
		if (!AsyncEnvironment.monkeyPatched) {
			AsyncEnvironment.monkeyPatched = true;
			undoPatch = this.monkeyPatch();
		}
		return new Promise((resolve, reject) => {
			this.render(templateName, context, (err, res) => {
				if (undoPatch) {
					undoPatch();
				}
				//the returned value in res is actually a NestedStringArray
				if (err || res === null) {
					reject(err ?? new Error('No render result'));
				}
				else {
					//resolve(res);
					resolve(this.flattenNestedArray(res as unknown as NestedStringArray));
				}
			});
		});
	}

	async renderStringAsync(templateString: string, context: object): Promise<string> {
		let undoPatch: () => void;
		if (!AsyncEnvironment.monkeyPatched) {
			AsyncEnvironment.monkeyPatched = true;
			undoPatch = this.monkeyPatch();
		}
		return new Promise((resolve, reject) => {
			this.renderString(templateString, context, (err, res) => {
				if (undoPatch) {
					undoPatch();
				}
				if (err || res === null) {
					reject(err ?? new Error('No render result'));
				}
				else {
					resolve(this.flattenNestedArray(res as unknown as NestedStringArray));
				}
			});
		});
	}

	private flattenResuls(results: any[]): any {
		if (Array.isArray(results)) {
			return results.map(this.flattenResuls.bind(this)).join('');
		}
		return results;
	}

	private monkeyPatch() {
		const unpatchParseAsRoot = this.monkeyPatchParseAsRoot();
		const unpatchClass = this.monkeyPatchClass(AsyncCompiler, nunjucks.compiler.Compiler.prototype);
		return () => {
			unpatchParseAsRoot();
			unpatchClass();
		};
	}

	private monkeyPatchParseAsRoot() {
		// Store the original parseAsRoot function
		const originalParseAsRoot = nunjucks.parser.Parser.prototype.parseAsRoot;

		// Patch parseAsRoot to get the AST for processing
		nunjucks.parser.Parser.prototype.parseAsRoot = function (): nunjucks.nodes.Root {
			const ast = originalParseAsRoot.call(this);
			// Check if the environment has the async extension and only then process the AST
			if ((this.extensions as nunjucks.Extension[]).includes(AsyncEnvironment.asyncExtension)) {
				AsyncEnvironment.astWalker.insertEmptyLineAtStart(ast);
			}
			return ast;
		};

		// Return a function that undoes the changes
		return () => {
			nunjucks.parser.Parser.prototype.parseAsRoot = originalParseAsRoot;
		};
	}

	private monkeyPatchClass(sourceClass: any, targetPrototype: any): () => void {
		const overrides: { name: string; original: Function | undefined }[] = [];

		const propertyNames = Object.getOwnPropertyNames(sourceClass.prototype);
		for (const name of propertyNames) {
			if (name !== 'constructor' && typeof sourceClass.prototype[name] === 'function') {
				const originalMethod = targetPrototype[name];
				overrides.push({ name, original: originalMethod });

				targetPrototype[name] = function (this: any, ...args: any[]) {
					return sourceClass.prototype[name].apply(this, args);
				};
			}
		}

		// Return the undo function
		return () => {
			for (const override of overrides) {
				if (override.original === undefined) {
					delete targetPrototype[override.name];
				} else {
					targetPrototype[override.name] = override.original;
				}
			}
		};
	}

	flattenNestedArray(arr: NestedStringArray): string {
		const result = arr.reduce<string>((acc, item) => {
			if (Array.isArray(item)) {
				return acc + this.flattenNestedArray(item);
			}
			return acc + item;
		}, '');
		return result;
	}
}
