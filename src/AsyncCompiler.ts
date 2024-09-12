import * as nunjucks from 'nunjucks';
import { compiler, runtime, nodes } from 'nunjucks';

var useAsync = true;

//This class is moneky patched over the original nunjucks.Compiler by overriding the methods
//Do not add properties to this class, do not use super
export class AsyncCompiler extends nunjucks.compiler.Compiler {

	_emit(code: string) {
		if (useAsync) {
			const replaces = [
				{
					find: `var ${this.buffer} = "";`,
					replace: `var ${this.buffer} = []; var ${this.buffer}_index = 0;`
				},
				{
					find: `${this.buffer} += `,
					replace: `${this.buffer}[${this.buffer}_index++] = `
				}
			];

			for (const replacement of replaces) {
				let index = 0;
				while ((index = code.indexOf(replacement.find, index)) !== -1) {
					code = code.slice(0, index) + replacement.replace + code.slice(index + replacement.find.length);
					index += replacement.replace.length;
				}
			}
		}

		this.codebuf.push(code);
	}

	emitAwaitBegin() {
		if (useAsync) {
			this._emit('(await(async ()=>{env.startAwait();try{return await ');
		}
	}

	emitAwaitEnd() {
		if (useAsync) {
			this._emit(';}finally{env.endAwait();}})())');
		}
	}

	emitAppendToBufferBegin() {
		if (useAsync) {
			this._emit(`(async ()=>{var index = ${this.buffer}_index++;${this.buffer}[index] = `);
		}
		else {
			this._emit(`${this.buffer} += `);
		}
	}

	emitAppendToBufferEnd() {
		if (useAsync) {
			this._emit('})();');
		}
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
				this.emitAppendToBufferBegin();
				this._emit('runtime.suppressValue(');

				if (this.throwOnUndefined) {
					this._emit('runtime.ensureDefined(');
				}

				this.compile(child, frame);

				if (this.throwOnUndefined) {
					this._emit(`,${node.lineno},${node.colno})`);
				}

				this._emit(', env.opts.autoescape);\n');

				this.emitAppendToBufferEnd();
			}
		});
	}

	compileSymbol(node: nunjucks.nodes.Node, frame: nunjucks.runtime.Frame) {
		var name = node.value;
		var v = frame.lookup(name as string);

		if (v) {
			this._emit(v);
		} else {
			if (useAsync) {
				this.emitAwaitBegin();
			}
			this._emit('runtime.contextOrFrameLookup(' +
				'context, frame, "' + name + '")');
			if (useAsync) {
				this.emitAwaitEnd();
			}
		}
	}

	compileLookupVal(node: nunjucks.nodes.Node, frame: nunjucks.runtime.Frame) {
		if (useAsync) {
			this.emitAwaitBegin();
		}
		this._emit('runtime.memberLookup((');
		this._compileExpression(node.target as nunjucks.nodes.Node, frame);
		this._emit('),');
		this._compileExpression(node.val as nunjucks.nodes.Node, frame);
		this._emit(')');
		if (useAsync) {
			this.emitAwaitEnd();
		}
	}

	compileLiteral(node: nunjucks.nodes.Node) {
		if (typeof node.value === 'string') {
			let val = node.value.replace(/\\/g, '\\\\');
			val = val.replace(/"/g, '\\"');
			val = val.replace(/\n/g, '\\n');
			val = val.replace(/\r/g, '\\r');
			val = val.replace(/\t/g, '\\t');
			val = val.replace(/\u2028/g, '\\u2028');
			this.codebuf.push(`"${val}"`);//no _emit with find and replace for literals
		} else if (node.value === null) {
			this._emit('null');
		} else {
			this._emit((node.value as any).toString());
		}
	}

	//@todo - test
	compileCallExtension(node: nunjucks.nodes.Node, frame: nunjucks.runtime.Frame, async: boolean) {
		var args = node.args;
		var contentArgs = node.contentArgs;
		var autoescape = typeof node.autoescape === 'boolean' ? node.autoescape : true;

		if (!async) {
			this.emitAppendToBufferBegin();
			this._emit(`runtime.suppressValue(`);
			this.emitAwaitBegin();
		}

		this._emit(`env.getExtension("${node.extName}")["${node.prop}"](`);
		this._emit('context');

		if (args || contentArgs) {
			this._emit(',');
		}

		if (args && args.children !== undefined) {
			if (!(args instanceof nodes.NodeList)) {
				this.fail('compileCallExtension: arguments must be a NodeList, ' +
					'use `parser.parseSignature`');
			}

			args.children.forEach((arg, i) => {
				// Tag arguments are passed normally to the call. Note
				// that keyword arguments are turned into a single js
				// object as the last argument, if they exist.
				this._compileExpression(arg, frame);

				if (i !== ((args as nodes.Node).children as nodes.Node[]).length - 1 || contentArgs.length) {
					this._emit(',');
				}
			});
		}

		if (contentArgs.length) {
			contentArgs.forEach((arg: any, i: number) => {
				if (i > 0) {
					this._emit(',');
				}

				if (arg) {
					this._emitLine('function(cb) {');
					this._emitLine('if(!cb) { cb = function(err) { if(err) { throw err; }}}');
					const id = this._pushBuffer();

					this._withScopedSyntax(() => {
						this.compile(arg, frame);
						this._emitLine(`cb(null, ${id});`);
					});

					this._popBuffer();
					this._emitLine(`return ${id};`);
					this._emitLine('}');
				} else {
					this._emit('null');
				}
			});
		}

		if (async) {
			const res = this._tmpid();
			this._emitLine(', ' + this._makeCallback(res));
			this._emitLine(
				`${this.buffer} += runtime.suppressValue(${res}, ${autoescape} && env.opts.autoescape);`);
			this._addScopeLevel();
		} else {
			this._emit(')');
			this.emitAwaitEnd();
			this._emit(`, ${autoescape} && env.opts.autoescape);\n`);
			this.emitAppendToBufferEnd();
		}
	}
}