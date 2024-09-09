import * as nunjucks from 'nunjucks';
import { ASTWalker } from './ASTWalker';

//A dummy extension, only async environments have it, used to identify them
export class AsyncExtension implements nunjucks.Extension {
	tags: string[] = [];
	parse() {

	}
}


export class AsyncEnvironment extends nunjucks.Environment {
	private static asyncExtension = new AsyncExtension();
	private static astWalker = new ASTWalker();
	static patchedMethods = false;
	resolvedContext: any = {};//a hack to store the resolved context

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		super(loader, opts);

		if (!AsyncEnvironment.patchedMethods) {
			AsyncEnvironment.patchedMethods = true;

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
			const extensions = this.extensions as nunjucks.Extension[];
			for (const ext of extensions) {
				if (ext === AsyncEnvironment.asyncExtension) {
					AsyncEnvironment.astWalker.insertEmptyLineAtStart(ast);
					return ast;
				}
			}
			return ast;
		};
	}


	// Asynchronously render a template from a file with AST modification and caching
	async renderAsync(templateName: string, context: object): Promise<string> {
		this.resolvedContext = {};
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
		this.resolvedContext = {};
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
