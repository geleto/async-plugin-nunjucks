import * as nunjucks from 'nunjucks';
import { Parser } from 'nunjucks/src/parser';
import { Literal, Output } from 'nunjucks/src/nodes';

export class AddEmptyLineExtension implements nunjucks.Extension {
	tags = ['addEmptyLine'];

	parse(parser: Parser) {//}, lexer: Lexer) {
		// Get the token for the start of the tag
		const tok = parser.nextToken();

		if (!tok) {
			throw new Error('Unexpected end of template input');
		}

		// Create a new literal node containing a newline character
		const newlineNode = new Literal(tok.lineno, tok.colno, '\n');

		// Advance past the 'addEmptyLine' tag
		parser.advanceAfterBlockEnd(tok.value);

		// Return the newline node as the output of the extension
		return new Output(tok.lineno, tok.colno, [newlineNode]);
	}
}

// Example usage with a template string
const env = new nunjucks.Environment();
env.addExtension('AddEmptyLineExtension', new AddEmptyLineExtension());
const template = env.renderString('{% addEmptyLine %}Hello, world!', {});
console.log(template);
