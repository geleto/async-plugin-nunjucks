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

//@todo - move the monkey patching to a separate class
export class AsyncEnvironment extends nunjucks.Environment {
	private static asyncExtension = new AsyncExtension();
	private static astWalker = new ASTWalker();
	private activeAwaits = 0;
	private static monkeyPatched = false;
	private completionResolver: (() => void) | null = null;

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		super(loader, opts);

		this.addExtension('AsyncExtension', AsyncEnvironment.asyncExtension);
	}

	// Asynchronously render a template from a file with AST modification and caching
	async renderAsync(templateName: string, context: object): Promise<string> {
		let undoPatch: (() => void) | undefined;
		if (!AsyncEnvironment.monkeyPatched) {
			AsyncEnvironment.monkeyPatched = true;
			undoPatch = this.monkeyPatch();
		}

		try {
			const res = await new Promise<NestedStringArray>((resolve, reject) => {
				this.render(templateName, context, (err, res) => {
					if (err || res === null) {
						reject(err ?? new Error('No render result'));
					} else {
						resolve(res as unknown as NestedStringArray);
					}
				});
			});

			await this.waitAll();
			return this.flattenNestedArray(res);
		} finally {
			if (undoPatch) {
				undoPatch();
				AsyncEnvironment.monkeyPatched = false;
			}
		}
	}

	async renderStringAsync(templateString: string, context: object): Promise<string> {
		let undoPatch: (() => void) | undefined;
		if (!AsyncEnvironment.monkeyPatched) {
			AsyncEnvironment.monkeyPatched = true;
			undoPatch = this.monkeyPatch();
		}

		try {
			const res = await new Promise<NestedStringArray>((resolve, reject) => {
				this.renderString(templateString, context, (err, res) => {
					if (err || res === null) {
						reject(err ?? new Error('No render result'));
					} else {
						resolve(res as unknown as NestedStringArray);
					}
				});
			});

			await this.waitAll();
			return this.flattenNestedArray(res);
		} finally {
			if (undoPatch) {
				undoPatch();
				AsyncEnvironment.monkeyPatched = false;
			}
		}
	}

	private monkeyPatch() {
		const unpatchParseAsRoot = this.monkeyPatchParseAsRoot();
		const unpatchClass = this.monkeyPatchClass(AsyncCompiler, nunjucks.compiler.Compiler);
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

	private monkeyPatchClass(sourceClass: any, targetClass: any): () => void {
		const overrides: { name: string; originalValue: any; isMethod: boolean }[] = [];
		const targetPrototype = targetClass.prototype;
		const sourcePrototype = sourceClass.prototype;

		// Copy prototype methods and properties, excluding 'constructor' and 'init'
		const propertyNames = Object.getOwnPropertyNames(sourcePrototype);
		for (const name of propertyNames) {
			if (name !== 'constructor' && name !== 'init') {
				const value = sourcePrototype[name];
				const isMethod = typeof value === 'function';

				// Save the original value
				const originalValue = targetPrototype[name];
				overrides.push({ name, originalValue, isMethod });

				// Save the original method with 'super_' prefixed if it's a method
				if (isMethod && originalValue !== undefined) {
					targetPrototype[`super_${name}`] = originalValue;
				}

				// Copy the method or property
				targetPrototype[name] = value;
			}
		}

		// Monkey-patch the 'init' method to copy non-function instance properties from a new sourceClass instance
		const originalInit = targetPrototype.init;

		// Save the original 'init' method
		overrides.push({ name: 'init', originalValue: originalInit, isMethod: true });

		// Save the original 'init' method with 'super_' prefixed if it exists
		if (originalInit) {
			targetPrototype['super_init'] = originalInit;
		}

		// Create the patched 'init' method
		targetPrototype.init = function (this: any, ...args: any[]) {
			const sourceInitBackup = sourceClass.prototype.init;

			// Temporarily restore the original 'init' method on sourceClass.prototype
			if (sourceClass.prototype.init === targetPrototype.init) {
				sourceClass.prototype.init = originalInit;
			}

			try {
				// Create a new instance of sourceClass
				const sourceInstance = new sourceClass(...args);

				// Copy non-function instance properties from sourceInstance to 'this'
				Object.getOwnPropertyNames(sourceInstance).forEach((prop) => {
					const value = sourceInstance[prop];
					if (typeof value !== 'function') {
						this[prop] = value;
					}
				});
			} finally {
				// Restore the 'init' method on sourceClass.prototype
				sourceClass.prototype.init = sourceInitBackup;
			}

			// Then call the original target 'init' method, if it exists
			if (originalInit) {
				originalInit.apply(this, args);
			}
		};

		// Return the undo function
		return () => {
			for (const { name, originalValue, isMethod } of overrides) {
				if (originalValue === undefined) {
					delete targetPrototype[name];
				} else {
					targetPrototype[name] = originalValue;
				}

				// Remove the 'super_' version if it exists and it's a method
				if (isMethod && targetPrototype.hasOwnProperty(`super_${name}`)) {
					delete targetPrototype[`super_${name}`];
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

	startAwait(): void {
		this.activeAwaits++;
	}

	endAwait(): void {
		this.activeAwaits--;
		if (this.activeAwaits === 0 && this.completionResolver) {
			this.completionResolver();
			this.completionResolver = null;
		}
	}

	async waitAll(): Promise<void> {
		if (this.activeAwaits === 0) {
			return Promise.resolve();
		}
		return new Promise<void>(resolve => {
			this.completionResolver = resolve;
		});
	}
}
