import * as nunjucks from 'nunjucks';
import type { nunjucksPluginApi } from 'nunjucks-plugin-api';

export class AddEmptyLineExtension implements nunjucks.Extension {
	tags = ['raw'];
	private nodeTypes!: nunjucksPluginApi.NodeTypes;

	parse(_parser: nunjucksPluginApi.Parser, nodes: nunjucksPluginApi.NodeTypes) {//}, lexer: nunjucksPluginApi.Lexer) {
		// Store the node types for later use
		this.nodeTypes = nodes;
		// We don't actually need to parse anything here
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
}

// Example usage
const env = new nunjucks.Environment();
env.addExtension('AddEmptyLineExtension', new AddEmptyLineExtension());

// Test the extension
const template = 'Hello,\nworld!\nThis is a test.';
const rendered = env.renderString(template, {});
console.log(rendered);