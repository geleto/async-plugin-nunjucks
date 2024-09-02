/* eslint-disable no-underscore-dangle */

/*
Use case: The class is given Nunjucks template AST.
It needs to extract all identifiers used in the template
these identifiers can be added to the context before rendering the template.

Extract only the identifiers that I can put in the context:
* Simple identifiers
* Dot notation expressions (which should be exported as a single identifier, e.g. 'user.name' as one identifier)
* Simple bracket notation expressions (which should be treated similarly to dot notation, e.g. 'user["name"]' as one identifier)
* Identifiers used
* 	control structures (if, for, etc.)
* 	function calls
* 	filters
* 	expressions
* 	array indexing (e.g. 'userId' in {{ users[userId].name }})
* 	macro calls (but not the macro name itself)

Composite Identifiers:
A Composite Identifier is a reference composed of multiple parts, each dependent on the previous one.
These parts can include properties, methods, functions, or array indices, and they must be evaluated
in a specific order to correctly resolve the final value. The process involves:

* Bracketed Identifiers and Function Call Arguments: First, resolve any identifiers or expressions inside
  brackets or function calls, as these provide dynamic keys, indices, or results needed for the next steps.
  Example: In `orders[orderId].getItem(itemNo)`, resolve `orderId` and `itemNo` first.

* Expressions: If the path involves expressions, intermediate identifiers may need to be created
  based on the results of those expressions.
  Example: In `total[discount + tax]`, compute `discount + tax` into an intermediate identifier (e.g., `discountTax`)
  before using it to access the `total` object.

* Resolved Identifiers: Once the values are known, resolve the composite identifiers:
  `orders[orderId]` where `orderId` has been computed
  `orders[orderId].items[itemNo]` where both `orderId` and `itemNo` are known
  `getOrder(orderId)` where `orderId` is known
  `total[discount + tax]` where `discount + tax` has been computed and stored in an intermediate identifier
  `users[0]` because the index is a constant value

Do not extract:
* Filter names (but still extract if there is a identifier that is being filtered: {{ user.name | upper }} - I want 'user.name' but not 'upper')
* Identifiers that are declared within the template using {% set %} statements
* Loop identifiers in for loops, e.g. {% for item in items %} because we've already retrieved the array needed for the loop
* Macro names when they are called

Notes:
* For nested structures, extract the top-level identifier (e.g. 'user' from {{ user.name }})
* For macro calls, extract the identifiers being passed in, not the macro name. For example, in {{ macroName(user, item.name) }}, extract 'user' and 'item', but not 'macroName'

Handling aliases and path modifications (TODO - this is wrong and will change, especially for set statements and for loops):
* Identifiers set with 'as' are aliases and need to be replaced with their original names:
  e.g., {% for user as u %} - 'u' should be replaced with 'user' in extracted identifiers
* In 'set' scope - the set identifier is added as alias to the identifier it is set to.
  The identifier is then replaced with the set alias value in the scope of the 'set' statement.
* Identifiers in 'include' statements with 'with' contexts need their paths adjusted:
  e.g., {% include "template.html" with user.manager as manager %} - 'manager' becomes 'user.manager'
* Macro parameters need to be handled similarly to 'as' identifiers:
  e.g., {% macro renderUser(user) %}{{ user.name }}{% endmacro %}
  When extracting from within the macro, 'user' should be replaced with the identifier passed when the macro is called

Other considerations for name modifications:
* Resolving identifiers in nested macro calls or nested include statements
* Adjusting paths for identifiers used in custom tags or functions, if they modify the scope
* Be aware of scope nesting and how it affects identifier resolution, especially with multiple levels of macros or includes
*/

import { nodes } from 'nunjucks';
//import { objectStringify } from './utils';
import { assert } from './utils';

export class IdentifierExtractor {
	private indentLevel: number = 0;
	private aliasStack: Array<Record<string, string>> = [{}];
	private extractCallback: ((identifier: string, node: nodes.Node) => void) | undefined;

	private log(level: 'debug' | 'info' | 'error' | 'warn', message: string, ...args: unknown[]): void {
		const indent = '  '.repeat(this.indentLevel);
		console.log(`${level.toUpperCase()}: ${indent}${message}`, ...args);
	}

	private resetState(): void {
		this.aliasStack = [{}];
		this.indentLevel = 0;
	}

	extractIdentifiers(ast: nodes.Root, callback: typeof this.extractCallback) {
		this.extractCallback = callback;
	}

	private extractFromNode(node: nodes.Node): Record<string, string> | null {
		if (!node) {
			this.log('debug', 'Skipping undefined node');
			return null;
		}

		this.log('debug', `Processing node: ${node.typename}`);
		this.indentLevel++;

		let aliases: Record<string, string> | null = null;
		switch (node.typename) {
			case 'Output':
				if (node.children) {
					this.traverseAndExtractIdentifiers(node.children);
				}
				break;
			case 'For':
			case 'AsyncAll':
			case 'AsyncEach':
				this.handleForLoop(node);
				break;
			case 'If':
				this.handleIfStatement(node);
				break;
			case 'Filter':
				this.handleFilter(node);
				break;
			case 'LookupVal':
				this.handleLookupVal(node);
				break;
			case 'Symbol':
				this.handleSymbol(node);
				break;
			case 'Include':
				this.handleInclude(node);
				break;
			case 'Macro':
				this.handleMacro(node);
				break;
			case 'Set':
				aliases = this.handleSet(node);
				break;
			case 'Block':
				this.traverseAndExtractIdentifiers(node);
				break;
			case 'Extends':
				if (node.template) {
					this.traverseAndExtractIdentifiers(node.template);
				}
				break;
			case 'FunCall':
				this.handleFunCall(node);
				break;
			case 'Import':
			case 'FromImport':
			case 'Dict':
				this.traverseAndExtractIdentifiers(node);
				break;
			case 'Pair':
				this.handlePair(node);
				break;
		}

		aliases = aliases ?? {};
		this.withAlias(aliases, () => {
			if (node.children) {
				for (let i = 0; i < node.children.length; i++) {
					const nodeAliases = this.extractFromNode(node.children[i]);
					if (nodeAliases) {
						Object.assign(aliases ?? {}, nodeAliases);//add the node aliases to the current aliases
					}
				}
			}
			this.handleKeywordArguments(node);
		}, true);//the true flag indicates that the aliases object can change

		this.indentLevel--;
		return aliases;
	}

	//similar to extractFromNode, but works on branches that do not have loops, set, macro, if, output, aliases ...
	//more universal, simple, handles very few special cases
	private traverseAndExtractIdentifiers(node: nodes.Node | nodes.Node[]): void {
		if (Array.isArray(node)) {
			node.forEach(n => {
				this.traverseAndExtractIdentifiers(n);
			});
		} else if (typeof node === 'object' && node !== null) {
			switch (node.typename) {
				case 'LookupVal': {
					if (this.isOnlyIdentifier(node)) {
						const varName = this.extractOnlyIdentifierName(node);
						if (varName) {
							this.extractItentifier(varName, node);
						}
					}
					break;
				}
				case 'Literal':
					// Skip literals
					break;
				case 'Symbol': {
					const varName = this.getAlias(node.value as string);
					if (varName) {
						this.extractItentifier(varName, node);
					}
					break;
				}
				case 'Pair':
					this.handlePair(node);
					break;
				case 'FunCall':
					this.handleFunCall(node);
					break;
				default:
					// Recursively traverse all node properties
					Object.entries(node).forEach(([key, value]) => {
						if (key === 'name') {
							const parentType = node.typename;
							// Skip filter names or direct function names, but traverse others
							if (parentType === 'Filter' || (parentType === 'FunCall' && !node.target)) {
								//do not add filter and other non-identifier 'name' properties
								return;
							}

							// If the name is part of a FunCall with a target (e.g., user.info.getName)
							// Traverse only the identifier path (e.g., 'user.info')
							if (parentType === 'FunCall' && node.target) {
								this.traverseAndExtractIdentifiers(node.target);
								return;
							}
							return;
						}
						if (Array.isArray(value) || typeof value === 'object') {
							this.traverseAndExtractIdentifiers(value as nodes.Node | nodes.Node[]);
						}
					});
			}
		}
	}

	private extractAliasIdentifiers(node: nodes.Node | nodes.Node[]): string[] {
		if (!node) {
			return [];
		}

		if (Array.isArray(node)) {
			return node.flatMap(n => this.extractAliasIdentifiers(n));
		}

		if (node.typename === 'Symbol') {
			return [node.value as string];
		}

		if ('children' in node && Array.isArray(node.children)) {
			return this.extractAliasIdentifiers(node.children);
		}

		if ('value' in node && typeof node.value === 'string') {
			return [node.value];
		}

		// Recursively check all properties of the node
		return Object.values(node)
			.flatMap(value =>
				typeof value === 'object' ? this.extractAliasIdentifiers(value as nodes.Node) : []
			);
	}

	private handleForLoop(node: nodes.Node): void {
		this.log('debug', 'Handling for loop');
		if (node.name && node.arr && node.body) {
			this.traverseAndExtractIdentifiers(node.arr);// Extract identifiers from the iterable expression
			const loopVars = this.extractAliasIdentifiers(node.name);

			// Create aliases to exclude loop identifiers
			const aliases: Record<string, string> = { loop: '!' };//disable the loop identifier
			for (const varName of loopVars) {
				aliases[varName] = '!';
			}

			// Process loop body with loop identifiers excluded
			this.withAlias(aliases, () => {
				this.extractFromNode(node.body as nodes.Node);
			});
		} else {
			this.log('warn', 'Incomplete For loop node');
		}
	}

	private handleIfStatement(node: nodes.Node): void {
		this.log('debug', 'Handling if statement');
		if (node.cond) {
			this.traverseAndExtractIdentifiers(node.cond);
		}
		if (node.body) {
			this.extractFromNode(node.body);
		}
		if (node.else_) {
			this.extractFromNode(node.else_);
		}
	}

	private handleFilter(node: nodes.Node): void {
		this.log('debug', 'Handling filter');
		if (node.name) {
			// Don't extract filter name as a identifier
		}
		if (node.args) {
			this.traverseAndExtractIdentifiers(node.args);
		}
		if (node.target) {
			this.traverseAndExtractIdentifiers(node.target);
		}
	}

	private handleFunCall(node: nodes.Node): void {
		this.log('debug', 'Handling function call');
		if (node.name) {
			this.extractFromFunctionName(node.name);
		}
		if (node.args) {
			this.traverseAndExtractIdentifiers(node.args);
		}
		if (node.kwargs) {
			this.traverseAndExtractIdentifiers(node.kwargs as nodes.Node);
		}
	}

	private extractFromFunctionName(node: nodes.Node) {
		// Do not extract the function name as a identifier, unless the path to the function is a identifier
		// path.to.function() - extract 'path.to'
		if (node.target && node.val) {
			this.traverseAndExtractIdentifiers(node.target);
			//do not extract from node.val - it is the function name
		}
	}

	private handleLookupVal(node: nodes.Node): void {
		this.log('debug', 'Handling lookup value');
		this.traverseAndExtractIdentifiers(node);
	}

	private handleSymbol(node: nodes.Node): void {
		this.log('debug', 'Handling symbol');
		const varName = node.value as string;
		this.extractItentifier(this.getAlias(varName), node);
	}

	private handleInclude(node: nodes.Node): void {
		this.log('debug', 'Handling include');
		if (node.template) {
			this.traverseAndExtractIdentifiers(node.template);
		}
		if (node.context) {
			this.traverseAndExtractIdentifiers(node.context);
		}
	}

	private handleMacro(node: nodes.Node): void {
		this.log('debug', 'Handling macro', node.name);
		// @todo - add identifier extraction from withing the macro, from each place it's called
	}

	private handleSet(node: nodes.Node): Record<string, string> | null {
		this.log('debug', 'Handling set statement');

		if (node.value && typeof node.value === 'object') {
			const isSimpleAssignment = this.isOnlyIdentifier(node.value);
			if (!isSimpleAssignment) {
				this.traverseAndExtractIdentifiers(node.value);
			}
		}

		const setIdentifiers = this.extractAliasIdentifiers(node.targets as nodes.Node[]);
		if (setIdentifiers.length > 0) {
			const setAliases = setIdentifiers.reduce<Record<string, string>>((aliases, setName) => {
				if (node.value && typeof node.value === 'object' && this.isOnlyIdentifier(node.value)) {
					// the set just references a identifier, no expressions, filters, etc...
					const varName = this.extractOnlyIdentifierName(node.value);
					if (varName) {
						aliases[setName] = varName;//substitute the set identifier with the actual identifier
					}
				} else {
					aliases[setName] = '!';
				}
				return aliases;
			}, {});

			this.withAlias(setAliases, () => {
				if (node.body) {
					this.extractFromNode(node.body);
				}
			});

			return setAliases;
		}

		return null;
	}

	private handlePair(node: nodes.Node): void {
		this.log('debug', 'Handling pair');

		if (node.key && node.key.typename !== 'Literal' && node.key.typename !== 'Symbol') {
			// Only traverse dynamic keys
			this.traverseAndExtractIdentifiers(node.key);
		}
		// Always traverse the value
		if (node.value && typeof node.value === 'object') {
			this.traverseAndExtractIdentifiers(node.value);
		}
	}

	private handleKeywordArguments(node: nodes.Node): void {
		if (node.kwargs) {
			this.log('debug', 'Handling keyword arguments');
			this.traverseAndExtractIdentifiers(node.kwargs as nodes.Node);
		}
	}

	//returns true if the node contains only identifier with no expressions
	private isOnlyIdentifier(node: nodes.Node): boolean {
		if (node.typename === 'Symbol') {
			return true;
		}
		if (node.typename === 'LookupVal') {
			// should only have 'target' and 'val' object properties
			// iterate over all object properties
			for (const key in node) {
				if (Object.hasOwn(node, key) && typeof node[key] === 'object' && key !== 'target' && key !== 'val') {
					return false;//e.g. 'left' and 'right' in expressions
				}
			}

			if (!node.target || !node.val) {
				return false;//invalid lookupVal
			}

			return this.isOnlyIdentifier(node.target) && node.val.typename === 'Literal';
		}
		return false;
	}

	private extractOnlyIdentifierName(node: nodes.Node): string {
		//@todo - bracket notation?
		if (node.typename === 'Symbol') {
			const value = node.value as string;
			return this.getAlias(value);
		} else if (node.typename === 'LookupVal' && node.target && node.val) {
			const fullPath = this.getOnlyIdentifierWithPath(node);
			const dotIndex = fullPath.indexOf('.');
			if (dotIndex !== -1) {
				const rootVar = fullPath.substring(0, dotIndex);
				return this.getAlias(rootVar) + fullPath.substring(dotIndex);
			} else {
				return this.getAlias(fullPath);
			}
		}
		return '';
	}

	private getOnlyIdentifierWithPath(node: nodes.Node): string {
		if (node.typename === 'Symbol') {
			return node.value as string;
		} else if (node.typename === 'LookupVal' && node.target && node.val) {
			const targetPath = this.getOnlyIdentifierWithPath(node.target);
			let valName = node.val.value as string;
			if (typeof valName === 'string' && (valName.includes('.') || valName.includes(' '))) {
				valName = `'${valName}'`;
			}

			return `${targetPath}.${valName}`;
		}
		return '';
	}

	private extractItentifier(name: string, node: nodes.Node): void {
		assert(name !== '.', `Invalid identifier name: ${name}`);

		if (this.isExcludedIdentifier(name)) {
			this.log('debug', 'Skipped excluded identifier:', name);
			return;
		}

		this.extractCallback?.(name, node);

		//this.identifiers.add(name);

		this.log('debug', 'Extracted identifier:', name);
	}

	private isExcludedIdentifier(name: string): boolean {
		const dotIndex = name.indexOf('.');
		return this.getAlias(dotIndex === -1 ? name : name.substring(0, dotIndex)) === '!';//'!'aliases indicate local identifiers (like loop identifiers)
	}

	private withAlias<T>(aliases: Record<string, string>, callback: () => T, aliasesObjectCanChange: boolean = false): T {
		if (!aliasesObjectCanChange && Object.keys(aliases).length === 0) {
			return callback();
		}
		this.aliasStack.push(aliases);
		this.log('debug', 'Pushed new alias:', aliases);
		try {
			return callback();
		} finally {
			const poppedAlias = this.aliasStack.pop();
			this.log('debug', 'Popped alias:', poppedAlias);
		}
	}

	private getAlias(varName: string): string {
		for (let i = this.aliasStack.length - 1; i >= 0; i--) {
			if (varName in this.aliasStack[i]) {
				const alias = this.aliasStack[i][varName];
				this.log('debug', `Resolved alias: ${varName} -> ${alias}`);
				return alias;
			}
		}
		return varName;
	}
}
