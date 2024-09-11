import * as nunjucks from 'nunjucks';
import { compiler, runtime, nodes } from 'nunjucks';

//@todo - SafeString with arrays, async suppressValue, async ensureDefined
//see also markSafe, callWrap, makeKeywordArgs

var useAsync = true;

//This class is moneky patched over the original nunjucks.Compiler by overriding the methods
//Do not add properties to this class, as they will not be available in the original class
//Do not use super, as the methods are directly copied to the  nunjucks.Compiler class
export class AsyncCompiler extends nunjucks.compiler.Compiler {

	/*constructor(name: string, throwOnUndefined: boolean) {
		super(name, throwOnUndefined);
	}*/

	_emit(code: string) {
		const replaces = [
			{
				find: `var ${this.buffer} = "";`,
				replace: `var ${this.buffer} = []; var ${this.buffer}_index = 0;`
			},
			{
				find: `${this.buffer} += `,
				replace: `${this.buffer}[${this.buffer}_index++] = `
			},
			/*{
				find: `${this.buffer} =`,
				replace: `${this.buffer}[${this.buffer}_index++] =`,
				ignorePrefix: 'var '
			},*/
			/*{
				find: `${this.buffer});`,
				replace: `${this.buffer}[${this.buffer}_index]);`,
				ignorePrefix: 'cb(null, '
			}*/
		];

		for (const replacement of replaces) {
			let index = 0;
			while ((index = code.indexOf(replacement.find, index)) !== -1) {
				if ('ignorePrefix' in replacement) {
					const prefixStart = Math.max(0, index - (replacement.ignorePrefix as string).length);
					const prefix = code.slice(prefixStart, index);

					if (prefix === replacement.ignorePrefix) {
						index += replacement.find.length;
						continue;
					}
				}

				code = code.slice(0, index) + replacement.replace + code.slice(index + replacement.find.length);
				index += replacement.replace.length;
			}
		}

		this.codebuf.push(code);
	}

	compileOutput(node: nunjucks.nodes.Node, frame: nunjucks.runtime.Frame) {
		const children = node.children as nunjucks.nodes.Node[];
		children.forEach(child => {
			// TemplateData is a special case because it is never
			// autoescaped, so simply output it for optimization
			if (child instanceof nodes.TemplateData) {
				if (child.value) {
					this._emit(`${this.buffer} += `);
					this.compileLiteral(child);//, frame);
					this._emitLine(';');
				}
			} else {
				if (useAsync) {
					this._emit(
						`(async ()=>{
						var index = ${this.buffer}_index++;
						${this.buffer}[index] = runtime.suppressValue(`
					);
				}
				else {
					this._emit(`${this.buffer} += runtime.suppressValue(`);
				}

				if (this.throwOnUndefined) {
					this._emit('runtime.ensureDefined(');
				}

				this.compile(child, frame);

				if (this.throwOnUndefined) {
					this._emit(`,${node.lineno},${node.colno})`);
				}

				this._emit(', env.opts.autoescape);\n');

				if (useAsync) {
					this._emit('})();');
				}
			}
		});
	}

	/*compileSymbol(node: nunjucks.nodes.Node, frame: nunjucks.runtime.Frame) {
		var name = node.value;
		var v = frame.lookup(name as string);

		if (v) {
			this._emit(v);
		} else {
			this._emit('runtime.contextOrFrameLookup(' +
				'context, frame, "' + name + '")');
		}
	}

	compileLookupVal(node: nunjucks.nodes.Node, frame: nunjucks.runtime.Frame) {
		if (node.isAsync) {
			this._emit('async(${})=>{ (await ');
		}
		this._emit('runtime.memberLookup((');
		this._compileExpression(node.target as nunjucks.nodes.Node, frame);
		this._emit('),');
		this._compileExpression(node.val as nunjucks.nodes.Node, frame);
		this._emit(')');
		if (node.isAsync) {
			this._emit(')}()');
		}
	}*/
}