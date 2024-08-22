import * as nunjucks from 'nunjucks';
import type { nunjucksPluginApi } from 'nunjucks-plugin-api';

interface TemplateCache {
	[key: string]: nunjucks.Template;
}

class CustomEnvironment extends nunjucks.Environment {
	private templateCache: TemplateCache;

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		// Use the provided loader or default to environment-specific loaders
		super(loader || CustomEnvironment.getDefaultLoader(), opts);
		this.templateCache = {}; // Custom cache for modified templates
	}

	// Determine the default loader based on the environment
	private static getDefaultLoader(): nunjucks.ILoaderAny {
		if (typeof window !== 'undefined') {
			// Running in a browser, use WebLoader
			return new nunjucks.WebLoader('/templates', { async: true });
		} else {
			// Running in Node.js, use FileSystemLoader
			return new nunjucks.FileSystemLoader('views');
		}
	}

	// Asynchronously render a template from a file with AST modification and caching
	async renderAsync(templateName: string, context: object): Promise<string> {
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

		// Use renderStringAsync to handle the rest (parsing, AST modification, caching, and rendering)
		return this.renderStringAsync(templateName, templateSource.src, context);
	}

	// Asynchronously render a template from a string with AST modification and caching
	async renderStringAsync(templateName: string, templateString: string, context: object): Promise<string> {
		// Check if the template is already cached
		if (this.templateCache[templateName]) {
			const compiledTemplate = this.templateCache[templateName];
			return this.renderTemplate(compiledTemplate, context);
		}

		// Parse the template string into an AST
		const lexer = new nunjucks.lexer.Lexer();
		const parser = new nunjucks.Parser(this.extensions);
		const tokens = lexer.lex(templateString);
		const ast = parser.parse(tokens);

		// Modify the AST to insert an empty line at the start
		this.insertEmptyLineAtStart(ast);

		// Compile the modified AST into a renderable function
		const compiledTemplate = nunjucks.compiler.compile(ast, this);

		// Cache the compiled template
		this.templateCache[templateName] = compiledTemplate;

		// Render the compiled function with the provided context
		return this.renderTemplate(compiledTemplate, context);
	}

	// Render a compiled template with context
	private renderTemplate(template: nunjucks.Template, context: object): string {
		return template.render(context);
	}

	// Insert an empty line at the start of the AST
	private insertEmptyLineAtStart(ast: any): void {
		const templateDataNode = new nunjucks.nodes.TemplateData('\n');
		const outputNode = new nunjucks.nodes.Output(templateDataNode.lineno, templateDataNode.colno, [templateDataNode]);
		ast.children.unshift(outputNode); // Insert at the beginning of the children array
	}

	// Get the template source asynchronously depending on the loader type
	private async getTemplateSourceAsync(loader: nunjucks.ILoaderAny, templateName: string): Promise<nunjucks.LoaderSource | null> {
		if ((loader as nunjucks.ILoaderAsync).async) {
			// If the loader is asynchronous, use await directly
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
			// If the loader is synchronous, directly return the result
			try {
				return (loader as nunjucks.ILoader).getSource(templateName);
			} catch (error) {
				throw new Error(`Failed to load template: ${error.message}`);
			}
		}
	}

	// Retrieve the first loader from the environment
	private getLoader(): nunjucks.ILoaderAny {
		return Array.isArray(this.loaders) ? this.loaders[0] : this.loaders;
	}
}



/*export class AddEmptyLineExtension implements nunjucks.Extension {
	tags = ['raw'];
	private nodeTypes!: nunjucksPluginApi.NodeTypes;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	parse(parser: any, nodes: any) {
		this.doParse(parser as nunjucksPluginApi.Parser, nodes as nunjucksPluginApi.NodeTypes);
	}
	private doParse(_parser: nunjucksPluginApi.Parser, nodes: nunjucksPluginApi.NodeTypes) {//}, lexer: nunjucksPluginApi.Lexer) {
		// Store the node types for later use
		this.nodeTypes = nodes;
		// We don't actually need to parse anything here
		console.log(this.nodeTypes);
		return null;
	}

	postprocess(ast: nunjucksPluginApi.nodes.Node) {//}, env: nunjucks.Environment) {
		const { Output, TemplateData } = this.nodeTypes;

		// Helper function to create a new line node
		const createNewlineNode = (lineno: number, colno: number): nunjucksPluginApi.nodes.Node => {
			return new Output(
				lineno,
				colno,
				[new TemplateData(lineno, colno, '\n')]
			);
		};

		// Helper function to recursively traverse and modify the AST
		const traverseAndModify = (node: nunjucksPluginApi.nodes.Node) => {
			if (node.type === 'NodeList') {
				const newChildren: nunjucksPluginApi.nodes.Node[] = [];

				if (!node.children) return;

				for (const child of node.children) {
					newChildren.push(child);
					// Add a new line node after each child, except for the last one
					if (child !== node.children[node.children.length - 1]) {
						const newlineNode = createNewlineNode(child.lineno, child.colno);
						newChildren.push(newlineNode);
					}
				}
				node.children = newChildren;
			}

			// Recursively process child nodes
			if ('children' in node) {
				if (!node.children) return;

				for (const child of node.children) {
					traverseAndModify(child);
				}
			}
		};

		// Start the traversal from the root of the AST
		traverseAndModify(ast);

		return ast;
	}
}*/

// Example usage
const env = new nunjucks.Environment();
env.addExtension('AddEmptyLineExtension', new AddEmptyLineExtension());

// Test the extension
const template = 'Hello,\nworld!\nThis is a test.';
const rendered = env.renderString(template, {});
console.log(rendered);