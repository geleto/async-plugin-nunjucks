import * as nunjucks from 'nunjucks';
import { ASTWalker } from './ASTWalker';
import { AsyncCompiler } from './AsyncCompiler';
import { asyncRuntime } from './AsyncRuntime';
import { AsyncExtension } from './AsyncEnvironment';

export class MonkeyPatcher {
	private static monkeyPatched = false;

	constructor(private astWalker: ASTWalker, private asyncExtension: AsyncExtension) { }

	patch(): () => void {
		if (MonkeyPatcher.monkeyPatched) {
			return () => { };
		}
		MonkeyPatcher.monkeyPatched = true;

		const unpatchParseAsRoot = this.patchParseAsRoot();
		const unpatchClass = this.patchClass(AsyncCompiler, nunjucks.compiler.Compiler);
		const unpatchRuntime = this.patchRuntime();

		return () => {
			unpatchParseAsRoot();
			unpatchClass();
			unpatchRuntime();
			MonkeyPatcher.monkeyPatched = false;
		};
	}

	private patchParseAsRoot() {
		// Store the original parseAsRoot function
		const originalParseAsRoot = nunjucks.parser.Parser.prototype.parseAsRoot;

		// Patch parseAsRoot to get the AST for processing
		const walker = this.astWalker;
		const extenstion = this.asyncExtension;
		nunjucks.parser.Parser.prototype.parseAsRoot = function (): nunjucks.nodes.Root {
			const ast = originalParseAsRoot.call(this);
			// Check if the environment has the async extension and only then process the AST
			if ((this.extensions as nunjucks.Extension[]).includes(extenstion)) {
				walker.insertEmptyLineAtStart(ast);
			}
			return ast;
		};

		// Return a function that undoes the changes
		return () => {
			nunjucks.parser.Parser.prototype.parseAsRoot = originalParseAsRoot;
		};
	}

	private patchClass(sourceClass: any, targetClass: any): () => void {
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

	private patchRuntime() {
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
}