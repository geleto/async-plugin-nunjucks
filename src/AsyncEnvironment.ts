import * as nunjucks from 'nunjucks';
import { ASTWalker } from './ASTWalker';
import { AsyncCompiler } from './AsyncCompiler';
import { asyncRuntime } from './AsyncRuntime';


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
	private static monkeyPatched = false;

	//TODO: this in separate object in the template
	//a new parameter to template.render
	//it will count activeAwaits, store async errors, etc...
	private asyncErrors: Error[] = [];
	private activeAwaits = 0;//@todo - AsyncEnvironment must be stateless
	private completionResolver: (() => void) | null = null;

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		super(loader, opts);

		this.addExtension('AsyncExtension', AsyncEnvironment.asyncExtension);
	}

	private async asyncRender(template: string, context: object, namedTemplate: boolean): Promise<string> {
		let undoPatch: (() => void) | undefined;
		if (!AsyncEnvironment.monkeyPatched) {
			AsyncEnvironment.monkeyPatched = true;
			undoPatch = this.monkeyPatch();
		}
		try {
			this.asyncErrors = [];
			const res = await new Promise<NestedStringArray>((resolve, reject) => {
				let callback = (err: Error | null, res: string | null) => {
					if (err || res === null) {
						reject(err ?? new Error('No render result'));
					} else {
						resolve(res as any as NestedStringArray);
					}
				}

				if (namedTemplate)
					this.render(template, context, callback);
				else
					this.renderString(template, context, callback);
			});
			//await this.waitAll();
			return this.flattenNestedArray(res);
		}
		catch (err) {
			//non-async error
			//await this.waitAll();
			throw err;
		}
		finally {
			if (undoPatch) {
				undoPatch();
				AsyncEnvironment.monkeyPatched = false;
			}
			if (this.asyncErrors.length > 0) {
				throw this.asyncErrors[0];
			}
		}
	}

	async renderAsync(templateName: string, context: object): Promise<string> {
		return this.asyncRender(templateName, context, true);
	}

	async renderStringAsync(templateString: string, context: object): Promise<string> {
		return this.asyncRender(templateString, context, false);
	}

	private monkeyPatch() {
		const unpatchParseAsRoot = this.monkeyPatchParseAsRoot();
		const unpatchClass = this.monkeyPatchClass(AsyncCompiler, nunjucks.compiler.Compiler);
		const unpatchRuntime = this.monkeyPatchRuntime();
		return () => {
			unpatchParseAsRoot();
			unpatchClass();
			unpatchRuntime();
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
		const targetPrototype = targetClass.prototype;
		const sourcePrototype = sourceClass.prototype;

		// Override prototype methods and store originals in 'super_' prefixed methods
		const propertyNames = Object.getOwnPropertyNames(sourcePrototype);
		for (const name of propertyNames) {
			if (name !== 'constructor' && name !== 'init') {
				const value = sourcePrototype[name];
				if (typeof value === 'function') {
					// Store the original method in 'super_' prefixed property
					if (typeof targetPrototype[name] === 'function') {
						targetPrototype[`super_${name}`] = targetPrototype[name];
					}
					targetPrototype[name] = value;
				}
			}
		}

		// Override the 'init' method
		const originalInit = targetPrototype.init;
		targetPrototype.init = function (this: any, ...args: any[]) {
			// Create a new instance of sourceClass
			if (this instanceof sourceClass) {
				return;
			}
			const sourceInstance = new sourceClass(...args);

			// Copy non-function instance properties from sourceInstance to 'this'
			for (const prop in sourceInstance) {
				if (typeof sourceInstance[prop] !== 'function') {
					this[prop] = sourceInstance[prop];
				}
			}

			if (originalInit) {
				originalInit.apply(this, args);
			}
		};

		// Return the undo function
		return () => {
			// Restore methods from 'super_' prefixed methods and delete them
			Object.getOwnPropertyNames(targetPrototype).forEach((name) => {
				if (name.startsWith('super_')) {
					const originalName = name.substring(6); // Remove 'super_' prefix
					if (targetPrototype[name] !== undefined) {
						targetPrototype[originalName] = targetPrototype[name];
					} else {
						delete targetPrototype[originalName];
					}
					delete targetPrototype[name]; // Delete the 'super_' method
				}
			});

			// Restore the original init method
			targetPrototype.init = originalInit;
		};
	}

	private monkeyPatchRuntime() {
		//for all properties in both asyncRuntime and nunjucks.runtime
		//prepend the one in nunjucks.runtime with super_
		for (const key in asyncRuntime) {
			if ((nunjucks.runtime as any)[key]) {
				(nunjucks.runtime as any)[`super_${key}`] = (nunjucks.runtime as any)[key];
			}
			(nunjucks.runtime as any)[key] = (asyncRuntime as any)[key];
		}
		//return undo function that restores all properties that start with super_ in nunjucks.runtime
		return () => {
			for (const key in asyncRuntime) {
				const original = (nunjucks.runtime as any)[`super_${key}`];
				if (original) {
					(nunjucks.runtime as any)[key] = original;
					delete (nunjucks.runtime as any)[`super_${key}`];
				} else {
					delete (nunjucks.runtime as any)[key];
				}
			}
		};
	}

	flattenNestedArray(arr: NestedStringArray): string {
		const result = arr.reduce<string>((acc, item) => {
			if (Array.isArray(item)) {
				return acc + this.flattenNestedArray(item);
			}
			if (typeof item === 'function') {
				return ((item as any)(acc) ?? '');
			}
			return acc + (item ?? '');
		}, '');
		return result;
	}

	startAwait(): void {
		this.activeAwaits++;
	}

	//this should always be called from the try 'finally' block
	endAwait(): void {
		this.activeAwaits--;
		if (this.activeAwaits === 0 && this.completionResolver) {
			this.completionResolver();
			this.completionResolver = null;
		}
	}

	private onAsyncError(error: Error, lineno: number, colno: number) {
		this.asyncErrors.push(error);
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
