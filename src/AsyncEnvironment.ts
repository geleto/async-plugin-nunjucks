import * as nunjucks from 'nunjucks';
import { CaptureParserExtension } from './CaptureParserExtension';
import { ASTWalker } from './ASTWalker';
import type { nunjucksPluginApi } from 'nunjucks-plugin-api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Compiler } = require('nunjucks/src/compiler');//an ugly hack to get the Compiler class

export class AsyncEnvironment extends nunjucks.Environment {
	private templateCache: { [key: string]: nunjucks.Template };
	private captureParserExtension: CaptureParserExtension;
	private astWalker!: ASTWalker;

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		super(loader || AsyncEnvironment.getDefaultLoader(), opts);
		this.templateCache = {};

		// Instantiate and add the custom extension
		this.captureParserExtension = new CaptureParserExtension();
		this.addExtension('CaptureParserExtension', this.captureParserExtension);

		this.astWalker = new ASTWalker(this.captureParserExtension.nodes);
	}

	// Asynchronously render a template from a file with AST modification and caching
	async renderAsync(templateName: string, context: object, options: nunjucks.ConfigureOptions = {}): Promise<string> {
		const loader = this.getLoader();

		// Check if the template is already cached
		if (this.templateCache[templateName]) {
			const compiledTemplate = this.templateCache[templateName];
			return this.renderTemplate(compiledTemplate, context);
		}

		// Load the template source asynchronously
		const templateSource = await this.getTemplateSourceAsync(loader, templateName);

		if (!templateSource) {
			throw new Error(`Template not found: ${templateName}`);
		}

		// Render the template with modifications
		return this.renderStringAsync(templateName, templateSource.src, context, options);
	}

	// Asynchronously render a template from a string with AST modification and caching
	async renderStringAsync(templateName: string, templateString: string, context: object, options: nunjucks.ConfigureOptions = {}): Promise<string> {

		// Check if the template is already cached
		if (this.templateCache[templateName]) {
			const compiledTemplate = this.templateCache[templateName];
			return this.renderTemplate(compiledTemplate, context);
		}

		templateString = this.preprocess(templateString);

		// Parse the template string into an AST
		const lexer = this.captureParserExtension.lexer;
		const tokens = lexer.tokenize(templateString);

		// A hackish way to create a new parser instance for our tokens with the constructor from the extracted parser
		//@todo - just import Parser from nunjucks src?
		let parser = this.captureParserExtension.parser;
		const parserConstructor = parser.constructor as new (tokens: nunjucksPluginApi.Token[]) => nunjucksPluginApi.Parser;
		parser = new parserConstructor(tokens);

		const ast = parser.parse(templateString, this.getExtensions(), options);

		// Modify the AST to insert an empty line at the start
		this.astWalker.insertEmptyLineAtStart(ast);

		// Compile the modified AST into a renderable function
		this.compile(ast, templateName, options);

		const compiledTemplate = nunjucks.compile(ast, this);

		// Cache the compiled template
		this.templateCache[templateName] = compiledTemplate;

		// Render the compiled function with the provided context
		return this.renderTemplate(compiledTemplate, context);
	}

	// Render a compiled template with context
	private renderTemplate(template: nunjucks.Template, context: object): string {
		return template.render(context);
	}

	// Get the template source asynchronously depending on the loader type
	private async getTemplateSourceAsync(loader: nunjucks.ILoaderAny, templateName: string): Promise<nunjucks.LoaderSource | null> {
		if ((loader as nunjucks.ILoaderAsync).async) {
			return new Promise((resolve, reject) => {
				(loader as nunjucks.ILoaderAsync).getSource(templateName, (err, source) => {
					if (err) {
						reject(err);
					} else {
						resolve(source);
					}
				});
			});
		} else {
			try {
				return (loader as nunjucks.ILoader).getSource(templateName);
			} catch (error) {
				throw new Error(`Failed to load template: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	private preprocess(src: string) {
		// Run the extension preprocessors against the source.
		const preprocessors: ((src: string) => string)[] = (this.getExtensions() || [])
			.filter((ext): ext is nunjucks.Extension & { preprocess: (src: string) => string } => 'preprocess' in ext)
			.map(ext => ext.preprocess);

		return preprocessors.reduce((s, processor) => processor(s), src);
	}

	private compile(ast: nunjucksPluginApi.nodes.NodeList, name: string, opts: nunjucks.ConfigureOptions = {}) {
		const c = new Compiler(name, 'throwOnUndefined' in opts ? opts.throwOnUndefined : false);
		c.compile(transformer.transform(
			parser.parse(
				ast,
				this.getExtensions(),
				opts),
			this.getAsyncFilrers(),
		));
		return c.getCode();
	}

	// Retrieve the first loader from the environment
	private getLoader(): nunjucks.ILoaderAny {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const loaders = (this as any).loaders;
		return Array.isArray(loaders) ? loaders[0] : loaders;
	}


	private getExtensions(): nunjucks.Extension[] {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (this as any).extensions;
	}

	// Static method to get the default loader based on the environment
	private static getDefaultLoader(): nunjucks.ILoaderAny {
		if (typeof window !== 'undefined') {
			return new nunjucks.WebLoader('/templates', { async: true });
		} else {
			return new nunjucks.FileSystemLoader('views');
		}
	}
}
