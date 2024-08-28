import { nodes } from 'nunjucks';

export class ASTWalker {

	constructor() {
	}

	// Insert an empty line at the start of the AST
	insertEmptyLineAtStart(ast: nodes.Node): void {
		const templateDataNode = new nodes.TemplateData(0, 0, '\n');
		const outputNode = new nodes.Output(0, 0, [templateDataNode]);
		if (!ast.children) {
			throw new Error('Invalid AST has no children');
		}
		ast.children.unshift(outputNode); // Insert at the beginning of the children array
	}
}
