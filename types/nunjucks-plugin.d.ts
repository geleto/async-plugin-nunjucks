declare module 'nunjucks/src/lexer' {
	export const TOKEN_STRING: 'string';
	export const TOKEN_WHITESPACE: 'whitespace';
	export const TOKEN_DATA: 'data';
	export const TOKEN_BLOCK_START: 'block-start';
	export const TOKEN_BLOCK_END: 'block-end';
	export const TOKEN_VARIABLE_START: 'variable-start';
	export const TOKEN_VARIABLE_END: 'variable-end';
	export const TOKEN_COMMENT: 'comment';
	export const TOKEN_LEFT_PAREN: 'left-paren';
	export const TOKEN_RIGHT_PAREN: 'right-paren';
	export const TOKEN_LEFT_BRACKET: 'left-bracket';
	export const TOKEN_RIGHT_BRACKET: 'right-bracket';
	export const TOKEN_LEFT_CURLY: 'left-curly';
	export const TOKEN_RIGHT_CURLY: 'right-curly';
	export const TOKEN_OPERATOR: 'operator';
	export const TOKEN_COMMA: 'comma';
	export const TOKEN_COLON: 'colon';
	export const TOKEN_TILDE: 'tilde';
	export const TOKEN_PIPE: 'pipe';
	export const TOKEN_INT: 'int';
	export const TOKEN_FLOAT: 'float';
	export const TOKEN_BOOLEAN: 'boolean';
	export const TOKEN_NONE: 'none';
	export const TOKEN_SYMBOL: 'symbol';
	export const TOKEN_SPECIAL: 'special';
	export const TOKEN_REGEX: 'regex';

	export interface Token {
		type: string;
		value: string;
		lineno: number;
		colno: number;
	}

	export class Tokenizer {
		constructor(str: string, opts?: any);
		nextToken(): Token | null;
		isFinished(): boolean;
		forwardN(n: number): void;
		forward(): void;
		backN(n: number): void;
		back(): void;
		current(): string;
		currentStr(): string;
		previous(): string;
	}

	export function lex(src: string, opts?: any): Tokenizer;
}

declare module 'nunjucks/src/parser' {
	import type * as lexer from 'nunjucks/src/lexer';
	import type * as nodes from 'nunjucks/src/nodes';

	export class Parser {
		constructor(tokens: lexer.Tokenizer);

		private tokens: lexer.Tokenizer;
		private peeked: lexer.Token | null;
		private breakOnBlocks: string[] | null;
		private dropLeadingWhitespace: boolean;
		public extensions: any[];

		init(tokens: lexer.Tokenizer): void;

		nextToken(withWhitespace?: boolean): lexer.Token | null;

		peekToken(): lexer.Token | null;

		pushToken(tok: lexer.Token): void;

		error(msg: string, lineno?: number, colno?: number): Error;

		fail(msg: string, lineno?: number, colno?: number): void;

		skip(type: string): boolean;

		expect(type: string): lexer.Token;

		skipValue(type: string, val: string): boolean;

		skipSymbol(val: string): boolean;

		advanceAfterBlockEnd(name?: string): lexer.Token;

		advanceAfterVariableEnd(): void;

		parseFor(): nodes.Node;

		parseMacro(): nodes.Node;

		parseCall(): nodes.Node;

		parseWithContext(): boolean | null;

		parseImport(): nodes.Node;

		parseFrom(): nodes.Node;

		parseBlock(): nodes.Node;

		parseExtends(): nodes.Node;

		parseInclude(): nodes.Node;

		parseIf(): nodes.Node;

		parseSet(): nodes.Node;

		parseSwitch(): nodes.Node;

		parseStatement(): nodes.Node | null;

		parseRaw(tagName?: string): nodes.Node;

		parsePostfix(node: nodes.Node): nodes.Node;

		parseExpression(): nodes.Node;

		parseInlineIf(): nodes.Node;

		parseOr(): nodes.Node;

		parseAnd(): nodes.Node;

		parseNot(): nodes.Node;

		parseIn(): nodes.Node;

		parseIs(): nodes.Node;

		parseCompare(): nodes.Node;

		parseConcat(): nodes.Node;

		parseAdd(): nodes.Node;

		parseSub(): nodes.Node;

		parseMul(): nodes.Node;

		parseDiv(): nodes.Node;

		parseFloorDiv(): nodes.Node;

		parseMod(): nodes.Node;

		parsePow(): nodes.Node;

		parseUnary(noFilters?: boolean): nodes.Node;

		parsePrimary(noPostfix?: boolean): nodes.Node;

		parseFilterName(): nodes.Node;

		parseFilterArgs(node: nodes.Node): nodes.Node[];

		parseFilter(node: nodes.Node): nodes.Node;

		parseFilterStatement(): nodes.Node;

		parseAggregate(): nodes.Node | null;

		parseSignature(initialNodeOrNull?: nodes.Node | null, noParens?: boolean): nodes.NodeList;

		parseUntilBlocks(...blockNames: string[]): nodes.NodeList;

		parseNodes(): nodes.Node[];

		parse(): nodes.NodeList;

		parseAsRoot(): nodes.Node;
	}

	export function parse(src: string, extensions?: any[], opts?: any): nodes.Node;
}

declare module 'nunjucks/src/nodes' {
	class Node {
		constructor();
		type: string;
		value?: string | Node;
		params?: Node[];
		body?: Node;
		else_?: Node;
		name?: Node;
		target?: Node;
		args?: Node;
		kwargs?: Record<string, Node>;
		property?: Node;
		template?: Node;
		context?: Node;
		cond?: Node;
		else?: Node;
		arr?: Node;
		targets?: Node[];
		val?: Node;
		with?: Node;
		key?: Node;
		[key: string]: any;
		children?: Node[];
	}

	export class Value extends Node {
		get typename(): string;
		get fields(): string[];
	}

	export class NodeList extends Node {
		constructor(lineno: number, colno: number, nodes?: Node[]);
		children: Node[];
		get typename(): string;
		get fields(): string[];

		init(lineno: number, colno: number, nodes?: Node[]): void;
		addChild(node: Node): void;
	}

	export class Root extends NodeList {
		constructor(lineno: number, colno: number);
	}
	export class Literal extends Value {
		constructor(lineno: number, colno: number, value: any);
	}
	export class Symbol extends Value {
		constructor(lineno: number, colno: number, value: string);
	}
	export class Group extends NodeList {
		constructor(lineno: number, colno: number);
	}
	export class ArrayNode extends NodeList {
		constructor(lineno: number, colno: number);
	}
	export class Pair extends Node {
		constructor(lineno: number, colno: number, key: Node, value: Node);
	}
	export class Dict extends NodeList {
		constructor(lineno: number, colno: number);
	}
	export class LookupVal extends Node {
		constructor(lineno: number, colno: number, target: Node, val: Node);
	}
	export class If extends Node {
		constructor(lineno: number, colno: number, cond: Node, body: Node, else_?: Node);
	}
	export class IfAsync extends If {
		constructor(lineno: number, colno: number, cond: Node, body: Node, else_?: Node);
	}
	export class InlineIf extends Node {
		constructor(lineno: number, colno: number, cond: Node, body: Node, else_: Node);
	}
	export class For extends Node {
		constructor(lineno: number, colno: number, arr: Node, name: Node, body: Node, else_?: Node);
	}
	export class AsyncEach extends For {
		constructor(lineno: number, colno: number, arr: Node, name: Node, body: Node, else_?: Node);
	}
	export class AsyncAll extends For {
		constructor(lineno: number, colno: number, arr: Node, name: Node, body: Node, else_?: Node);
	}
	export class Macro extends Node {
		constructor(lineno: number, colno: number, name: Node, args: Node[], body: Node);
	}
	export class Caller extends Macro {
		constructor(lineno: number, colno: number, name: Node, args: Node[], body: Node);
	}
	export class Import extends Node {
		constructor(lineno: number, colno: number, template: Node, target: Node, withContext: boolean);
	}

	export class FromImport extends Node {
		constructor(lineno: number, colno: number, template: Node, names: NodeList, withContext: boolean);
		get typename(): string;
		get fields(): string[];
	}

	export class FunCall extends Node {
		constructor(lineno: number, colno: number, name: Node, args: Node[]);
	}
	export class Filter extends FunCall {
		constructor(lineno: number, colno: number, name: Node, args: Node[], kwargs: Node);
	}
	export class FilterAsync extends Filter {
		constructor(lineno: number, colno: number, name: Node, args: Node[], kwargs: Node);
	}
	export class KeywordArgs extends Dict {
		constructor(lineno: number, colno: number);
	}
	export class Block extends Node {
		constructor(lineno: number, colno: number, name: Node, body: Node);
	}
	export class Super extends Node {
		constructor(lineno: number, colno: number, blockName: string, symbol: Symbol);
	}
	export class TemplateRef extends Node {
		constructor(lineno: number, colno: number, template: Node);
	}
	export class Extends extends TemplateRef {
		constructor(lineno: number, colno: number, template: Node);
	}
	export class Include extends Node {
		constructor(lineno: number, colno: number, template: Node, ignoreMissing: boolean);
	}
	export class Set extends Node {
		constructor(lineno: number, colno: number, targets: Node[], value: Node);
	}
	export class Switch extends Node {
		constructor(lineno: number, colno: number, expr: Node, cases: Node[], default_?: Node);
	}
	export class Case extends Node {
		constructor(lineno: number, colno: number, cond: Node, body: Node);
	}
	export class Output extends NodeList {
		constructor(lineno: number, colno: number, children: Node[]);
	}
	export class Capture extends Node {
		constructor(lineno: number, colno: number, body: Node);
	}
	export class TemplateData extends Literal {
		constructor(lineno: number, colno: number, data: string);
	}
	export class UnaryOp extends Node {
		constructor(lineno: number, colno: number, target: Node);
	}
	export class BinOp extends Node {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class In extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Is extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Or extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class And extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Not extends UnaryOp {
		constructor(lineno: number, colno: number, target: Node);
	}
	export class Add extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Concat extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Sub extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Mul extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Div extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class FloorDiv extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Mod extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Pow extends BinOp {
		constructor(lineno: number, colno: number, left: Node, right: Node);
	}
	export class Neg extends UnaryOp {
		constructor(lineno: number, colno: number, target: Node);
	}
	export class Pos extends UnaryOp {
		constructor(lineno: number, colno: number, target: Node);
	}
	export class Compare extends Node {
		constructor(lineno: number, colno: number, expr: Node, ops: CompareOperand[]);
	}
	export class CompareOperand extends Node {
		constructor(lineno: number, colno: number, expr: Node, type: string);
	}
	export class CallExtension extends Node {
		constructor(ext: any, prop: string, args: NodeList, contentArgs: Node[]);
	}
	export class CallExtensionAsync extends CallExtension {
		constructor(ext: any, prop: string, args: NodeList, contentArgs: Node[]);
	}

	export function printNodes(node: Node, indent?: number): void;
}

declare module 'nunjucks/src/object' {
	import { EventEmitter } from 'events';

	export class Obj {
		constructor(...args: any[]);
		init(...args: any[]): void;
		get typename(): string;
		static extend(name: string, props: Record<string, any>): any;
	}

	export class EmitterObj extends EventEmitter {
		constructor(...args: any[]);
		init(...args: any[]): void;
		get typename(): string;
		static extend(name: string, props: Record<string, any>): any;
	}
}

/*declare module 'nunjucks' {
	import { Environment as BaseEnvironment } from 'nunjucks';
	import { Parser } from 'nunjucks/src/parser';
	import { Obj } from 'nunjucks/src/object';
	import * as nodes from 'nunjucks/src/nodes';

	export interface Extension {
		tags?: string[];
		parse?(parser: Parser, nodes: typeof nodes, lexer: typeof import('nunjucks/src/lexer')): nodes.Node;
	}

	export interface Environment extends BaseEnvironment {
		opts: ConfigureOptions;
		loaders: ILoader[];
		cache: { [name: string]: Template };
		extensions: { [name: string]: Extension };
		asyncFilters: string[];
		filters: { [name: string]: Function };
		globals: { [name: string]: any };

		addExtension(name: string, ext: Extension): void;
		removeExtension(name: string): void;
		getExtension(name: string): Extension;
		hasExtension(name: string): boolean;
	}
}*/