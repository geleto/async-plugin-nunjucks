import type { nunjucksPluginApi } from 'nunjucks-plugin-api';

export class ASTWalker {
	private nodes: nunjucksPluginApi.NodeTypes;

	constructor(nodes: nunjucksPluginApi.NodeTypes) {
		this.nodes = nodes;
	}

	// Insert an empty line at the start of the AST
	insertEmptyLineAtStart(ast: nunjucksPluginApi.nodes.Node): void {
		const templateDataNode = new this.nodes.TemplateData(0, 0, '\n');
		const outputNode = new this.nodes.Output(0, 0, [templateDataNode]);
		if (!ast.children) {
			throw new Error('Invalid AST has no children');
		}
		ast.children.unshift(outputNode); // Insert at the beginning of the children array
	}
}
