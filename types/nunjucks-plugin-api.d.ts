import * as nunjucks from 'nunjucks';


declare module 'nunjucks' {
	export const parser: {
		parser: Parser;
		Parser: typeof Parser;
	}

	export class Parser {
		constructor(tokens: any);
		init(tokens: any): void;

		extensions: Extension[];
		tokens: any;
		peeked: any;
		breakOnBlocks: null | string[];
		dropLeadingWhitespace: boolean;

		nextToken(withWhitespace?: boolean): Token;
		peekToken(): Token;
		pushToken(tok: Token): void;
		error(msg: string, lineno: number, colno: number): Error;
		fail(msg: string, lineno?: number, colno?: number): never;
		skip(type: string): boolean;
		expect(type: string): Token;
		skipValue(type: string, val: string): boolean;
		skipSymbol(val: string): boolean;
		advanceAfterBlockEnd(name?: string): Token;
		advanceAfterVariableEnd(): void;
		parseFor(): nodes.For | nodes.AsyncEach | nodes.AsyncAll;
		parseMacro(): nodes.Macro;
		parseCall(): nodes.Output;
		parseWithContext(): boolean | null;
		parseImport(): nodes.Import;
		parseFrom(): nodes.FromImport;
		parseBlock(): nodes.Block;
		parseExtends(): nodes.Extends;
		parseInclude(): nodes.Include;
		parseIf(): nodes.If;
		parseSet(): nodes.Set;
		parseSwitch(): nodes.Switch;
		parseStatement(): nodes.Node | null;
		parseRaw(tagName?: string): nodes.Output;
		parsePostfix(node: nodes.Node): nodes.Node;
		parseExpression(): Expression;
		parseInlineIf(): Expression;
		parseOr(): Expression;
		parseAnd(): Expression;
		parseNot(): Expression;
		parseIn(): Expression;
		parseIs(): Expression;
		parseCompare(): Expression;
		parseConcat(): Expression;
		parseAdd(): Expression;
		parseSub(): Expression;
		parseMul(): Expression;
		parseDiv(): Expression;
		parseFloorDiv(): Expression;
		parseMod(): Expression;
		parsePow(): Expression;
		parseUnary(noFilters?: boolean): Expression;
		parsePrimary(noPostfix?: boolean): Expression;
		parseFilterName(): nodes.Symbol;
		parseFilterArgs(node: Expression): nodes.NodeList;
		parseFilter(node: Expression): Expression;
		parseFilterStatement(): nodes.Output;
		parseAggregate(): nodes.Node | null;
		parseSignature(tolerant?: boolean, noParens?: boolean): nodes.NodeList | null;
		parseUntilBlocks(...blockNames: string[]): nodes.NodeList;
		parseNodes(): nodes.Node[];
		parse(): nodes.NodeList;
		parseAsRoot(): nodes.Root;
	}

	namespace nodes {
		class Node {
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

			constructor(lineno: number, colno: number);
			init(lineno: number, colno: number, ...args: any[]): void;
			findAll(type: Function, results?: any[]): any[];
			iterFields(func: (val: any, fieldName: string) => void): void;
		}

		export class Value extends Node {
			value: any;
			constructor(lineno: number, colno: number, value: any);
			get typename(): string;
			get fields(): string[];
		}

		export class NodeList extends Node {
			children: Node[];
			constructor(lineno: number, colno: number, nodes?: Node[]);
			get typename(): string;
			get fields(): string[];
			init(lineno: number, colno: number, nodes?: Node[]): void;
			addChild(node: Node): void;
		}

		export class Root extends NodeList {
			constructor(lineno: number, colno: number, nodes?: Node[]);
		}

		export class Literal extends Value {
			constructor(lineno: number, colno: number, value: any);
		}

		export class Symbol extends Value {
			constructor(lineno: number, colno: number, value: string);
		}

		export class Group extends NodeList {
			constructor(lineno: number, colno: number, nodes?: Node[]);
		}

		export class ArrayNode extends NodeList {
			constructor(lineno: number, colno: number, nodes?: Node[]);
		}

		export class Pair extends Node {
			key: Node;
			value: Node;
			constructor(lineno: number, colno: number, key: Node, value: Node);
		}

		export class Dict extends NodeList {
			constructor(lineno: number, colno: number, nodes?: Node[]);
		}

		export class LookupVal extends Node {
			target: Node;
			val: Node;
			constructor(lineno: number, colno: number, target: Node, val: Node);
		}

		export class If extends Node {
			cond: Node;
			body: Node;
			else_: Node;
			constructor(lineno: number, colno: number, cond: Node, body: Node, else_: Node);
		}

		export class IfAsync extends If {
			constructor(lineno: number, colno: number, cond: Node, body: Node, else_: Node);
		}

		export class InlineIf extends Node {
			cond: Node;
			body: Node;
			else_: Node;
			constructor(lineno: number, colno: number, cond: Node, body: Node, else_: Node);
		}

		export class For extends Node {
			arr: Node;
			name: Node;
			body: Node;
			else_: Node;
			constructor(lineno: number, colno: number, arr: Node, name: Node, body: Node, else_: Node);
		}

		export class AsyncEach extends For {
			constructor(lineno: number, colno: number, arr: Node, name: Node, body: Node, else_: Node);
		}

		export class AsyncAll extends For {
			constructor(lineno: number, colno: number, arr: Node, name: Node, body: Node, else_: Node);
		}

		export class Macro extends Node {
			name: Node;
			args: Node;
			body: Node;
			constructor(lineno: number, colno: number, name: Node, args: Node, body: Node);
		}

		export class Caller extends Macro {
			constructor(lineno: number, colno: number, name: Node, args: Node, body: Node);
		}

		export class Import extends Node {
			template: Node;
			target: Node;
			withContext: boolean;
			constructor(lineno: number, colno: number, template: Node, target: Node, withContext: boolean);
		}

		export class FromImport extends Node {
			template: Node;
			names: NodeList;
			withContext: boolean;
			constructor(lineno: number, colno: number, template: Node, names: NodeList, withContext: boolean);
			get typename(): string;
			get fields(): string[];
			init(lineno: number, colno: number, template: Node, names: NodeList, withContext: boolean): void;
		}

		export class FunCall extends Node {
			name: Node;
			args: NodeList;
			constructor(lineno: number, colno: number, name: Node, args: NodeList);
		}

		export class Filter extends FunCall {
			constructor(lineno: number, colno: number, name: Node, args: NodeList);
		}

		export class FilterAsync extends Filter {
			symbol: Node;
			constructor(lineno: number, colno: number, name: Node, args: NodeList, symbol: Node);
		}

		export class KeywordArgs extends Dict {
			constructor(lineno: number, colno: number, nodes?: Node[]);
		}

		export class Block extends Node {
			name: Node;
			body: Node;
			constructor(lineno: number, colno: number, name: Node, body: Node);
		}

		export class Super extends Node {
			blockName: Node;
			symbol: Node;
			constructor(lineno: number, colno: number, blockName: Node, symbol: Node);
		}

		export class TemplateRef extends Node {
			template: Node;
			constructor(lineno: number, colno: number, template: Node);
		}

		export class Extends extends TemplateRef {
			constructor(lineno: number, colno: number, template: Node);
		}

		export class Include extends Node {
			template: Node;
			ignoreMissing: boolean;
			constructor(lineno: number, colno: number, template: Node, ignoreMissing: boolean);
		}

		export class Set extends Node {
			//targets: NodeList;
			value: Node;
			constructor(lineno: number, colno: number, targets: NodeList, value: Node);
		}

		export class Switch extends Node {
			expr: Node;
			cases: NodeList;
			default: Node;
			constructor(lineno: number, colno: number, expr: Node, cases: NodeList, default_: Node);
		}

		export class Case extends Node {
			cond: Node;
			body: Node;
			constructor(lineno: number, colno: number, cond: Node, body: Node);
		}

		export class Output extends NodeList {
			constructor(lineno: number, colno: number, nodes?: Node[]);
		}

		export class Capture extends Node {
			body: Node;
			constructor(lineno: number, colno: number, body: Node);
		}

		export class TemplateData extends Literal {
			constructor(lineno: number, colno: number, value: any);
		}

		export class UnaryOp extends Node {
			target: Node;
			constructor(lineno: number, colno: number, target: Node);
		}

		export class BinOp extends Node {
			left: Node;
			right: Node;
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
			expr: Node;
			ops: CompareOperand[];
			constructor(lineno: number, colno: number, expr: Node, ops: CompareOperand[]);
		}

		export class CompareOperand extends Node {
			expr: Node;
			type: string;
			constructor(lineno: number, colno: number, expr: Node, type: string);
		}

		export class CallExtension extends Node {
			extName: string;
			prop: string;
			args: NodeList;
			contentArgs: Node[];
			constructor(ext: { __name?: string } | string, prop: string, args: NodeList, contentArgs: Node[]);
		}

		export class CallExtensionAsync extends CallExtension {
			constructor(ext: { __name?: string } | string, prop: string, args: NodeList, contentArgs: Node[]);
		}
	}

	type NodeTypes = typeof nodes;

	class Expression extends Node { }

	class Tokenizer { }

	interface Lexer {
		//tokenize(src: string): Token[];
		lex(src: string, opts: nunjucks.ConfigureOptions): Tokenizer;
	}

	interface Token {
		type: string;
		value: string;
		lineno: number;
		colno: number;
	}
}

declare const nodes: nunjucks.NodeTypes;