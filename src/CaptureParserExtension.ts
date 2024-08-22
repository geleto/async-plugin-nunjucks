import * as nunjucks from 'nunjucks';
import type { nunjucksPluginApi } from 'nunjucks-plugin-api';

export class CaptureParserExtension implements nunjucks.Extension {
	tags: string[] = [];

	private _parser!: nunjucksPluginApi.Parser;
	private _lexer!: nunjucksPluginApi.Lexer;
	private _nodes!: nunjucksPluginApi.NodeTypes;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	parse(parser: any, nodes: any, lexer: any) {
		this._parser = parser as nunjucksPluginApi.Parser;
		this._lexer = lexer as nunjucksPluginApi.Lexer;
		this._nodes = nodes as nunjucksPluginApi.NodeTypes;
		return null;
	}

	get parser() {
		return this._parser;
	}

	get lexer() {
		return this._lexer;
	}

	get nodes() {
		return this._nodes;
	}
}
