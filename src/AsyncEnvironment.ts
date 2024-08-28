import * as nunjucks from 'nunjucks';
import { AsyncExtension } from './AsyncExtension';
import { ASTWalker } from './ASTWalker';

export class AsyncEnvironment extends nunjucks.Environment {
	private static asyncExtension = new AsyncExtension();
	private static astWalker = new ASTWalker();
	static initializedParseAsRoot = false;

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		super(loader, opts);

		if (!AsyncEnvironment.initializedParseAsRoot) {
			AsyncEnvironment.initializedParseAsRoot = true;
			const originalParseAsRoot = nunjucks.Parser.prototype.parseAsRoot;
			nunjucks.Parser.prototype.parseAsRoot = function (): nunjucks.nodes.Root {
				const ast = originalParseAsRoot.call(this);
				//check if the environment has the async extension and only then process the AST
				const extensions = this.extensions as nunjucks.Extension[];
				for (const ext of extensions) {
					if (ext === AsyncEnvironment.asyncExtension) {
						AsyncEnvironment.astWalker.insertEmptyLineAtStart(ast);
						return ast;
					}
				}
				AsyncEnvironment.astWalker.insertEmptyLineAtStart(ast);
				return ast;
			};
		}
		this.addExtension('AsyncExtension', AsyncEnvironment.asyncExtension);
	}

	// Asynchronously render a template from a file with AST modification and caching
	async renderAsync(templateName: string, context: object): Promise<string> {
		//use promise to render
		return new Promise((resolve, reject) => {
			this.render(templateName, context, (err, res) => {
				if (err || res === null) {
					reject(err ?? new Error('No render result'));
				}
				else {
					resolve(res);
				}
			});
		});
	}

	async renderStringAsync(templateString: string, context: object): Promise<string> {
		return new Promise((resolve, reject) => {
			this.renderString(templateString, context, (err, res) => {
				if (err || res === null) {
					reject(err ?? new Error('No render result'));
				}
				else {
					resolve(res);
				}
			});
		});
	}
}
