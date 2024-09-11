import * as nunjucks from 'nunjucks';
import { ASTWalker } from './ASTWalker';
import { AsyncResolveCompiler } from './AsyncResolveCompiler';

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
	static patchedMethods = false;
	resolvedContext: any = {};//a hack to store the resolved context

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		super(loader, opts);

		if (!AsyncEnvironment.patchedMethods) {
			AsyncEnvironment.patchedMethods = true;

			console.log('Patching methods');
			this.patchMethods();
		}
		this.addExtension('AsyncExtension', AsyncEnvironment.asyncExtension);
	}

	patchMethods() {
		//patch parseAsRoot to get the AST for processing
		const originalParseAsRoot = nunjucks.parser.Parser.prototype.parseAsRoot;
		nunjucks.parser.Parser.prototype.parseAsRoot = function (): nunjucks.nodes.Root {
			const ast = originalParseAsRoot.call(this);
			//check if the environment has the async extension and only then process the AST
			if ((this.extensions as nunjucks.Extension[]).includes(AsyncEnvironment.asyncExtension)) {
				AsyncEnvironment.astWalker.insertEmptyLineAtStart(ast);
			}
			return ast;
		};

		//const unpatch = this.monkeyPatchClass(nunjucks, 'Compiler', AsyncResolveCompiler);

		console.log('Patching compiler');
		this.monkeyPatchOverrides(AsyncResolveCompiler, nunjucks.compiler.Compiler.prototype);

		/*nunjucks.compiler.compile = function (src: string, asyncFilters: string[], extensions: nunjucks.Extension[], name: string, opts: Record<string, any> = {}): nunjucks.Template {
			var c;
			if (extensions.includes(AsyncEnvironment.asyncExtension)) {
				c = new AsyncResolveCompiler(name, opts.throwOnUndefined);
			}
			else {
				c = new nunjucks.compiler.Compiler(name, opts.throwOnUndefined);
			}
			// Run the extension preprocessors against the source.
			const preprocessors = (extensions || []).map(ext => ext.preprocess).filter(f => !!f);

			const processedSrc = preprocessors.reduce((s, processor) => processor(s), src);

			c.compile(transformer.transform(
				nunjucks.parser.parse(processedSrc, extensions, opts),
				asyncFilters,
				name
			));
			return c.getCode();
		}*/
	}


	// Asynchronously render a template from a file with AST modification and caching
	async renderAsync(templateName: string, context: object): Promise<string> {
		this.resolvedContext = {};
		//use promise to render
		return new Promise((resolve, reject) => {
			this.render(templateName, context, (err, res) => {
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
		this.resolvedContext = {};
		return new Promise((resolve, reject) => {
			this.renderString(templateString, context, (err, res) => {
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

	private flattenResuls(results: any[]): any {
		if (Array.isArray(results)) {
			return results.map(this.flattenResuls.bind(this)).join('');
		}
		return results;
	}

	private monkeyPatchOverrides(sourceClass: any, targetPrototype: any) {
		const propertyNames = Object.getOwnPropertyNames(sourceClass.prototype);
		for (const name of propertyNames) {
			if (name !== 'constructor' && typeof sourceClass.prototype[name] === 'function') {
				const originalMethod = targetPrototype[name];
				targetPrototype[name] = function (this: any, ...args: any[]) {
					return sourceClass.prototype[name].apply(this, args);
				};
				// Optionally, store the original method if needed
				targetPrototype[name].original = originalMethod;
			}
		}
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
