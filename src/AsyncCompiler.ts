import * as nunjucks from 'nunjucks';
import { compiler, runtime, nodes } from 'nunjucks';

var useAsync = true;

//This class is moneky patched over the original nunjucks.Compiler by overriding the methods
//Do not add properties to this class (this can be fixed if needed)
//instead of super().someFunction() use super_someFunction()
//This would not have been necessary if nunjucks allowed to override the compiler class
export class AsyncCompiler extends nunjucks.compiler.Compiler {
	bufferStack: string[] = [];
	insideAsyncDepth = 0;
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
				},
				{
					find: 'new SafeString',
					replace: `await runtime.asyncSafeString`
				},
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

	//wrap await calls in this, maybe we should only env.startAwait()/endAwait() the async blocks
	emitAwaitBegin() {
		if (useAsync) {
			this._emit('(await ');
		}
	}

	emitAwaitEnd() {
		if (useAsync) {
			this._emit(')');
		}
	}

	//an async block that does not have a value should be wrapped in this
	emitAsyncBlockBegin() {
		if (useAsync) {
			this._emit('(async ()=>{');
			this._emit('env.startAwait();');
			this.insideAsyncDepth++;
		}
	}

	emitAsyncBlockEnd() {
		if (useAsync) {
			this._emitLine('})()');
			this._emitLine('.catch(e =>{env.onAsyncError(e, lineno, colno)})');
			this._emitLine('.finally(()=>{env.endAwait();})');
			this.insideAsyncDepth--;
		}
	}

	emitAsyncValueBegin() {
		if (useAsync) {
			this._emitLine(`${this.insideAsyncDepth > 0 ? 'await ' : ''}(async ()=>{`);
			this._emitLine('env.startAwait();');
			this._emit('return ');
			this.insideAsyncDepth++;
		}
	}

	emitAsyncValueEnd() {
		if (useAsync) {
			this._emitLine('})()');
			this._emitLine('.catch(e =>{env.onAsyncError(e, lineno, colno)})');
			this._emitLine('.finally(()=>{env.endAwait();})');
			this.insideAsyncDepth--;
		}
	}

	emitAddToBufferBegin() {
		if (useAsync) {
			this._emitLine('(async ()=>{');
			this._emitLine('env.startAwait();');
			this._emitLine(`var index = ${this.buffer}_index++;`);
			this._emit(`${this.buffer}[index] = `);
			this.insideAsyncDepth++;
		}
		else {
			this._emit(`${this.buffer} += `);
		}
	}

	emitAddToBufferEnd() {
		if (useAsync) {
			this._emitLine('})()');
			this._emitLine('.catch(e =>{env.onAsyncError(e, lineno, colno)})');
			this._emitLine('.finally(()=>{env.endAwait();})');
			this.insideAsyncDepth--;
		}
	}

	emitBufferBlockBegin() {
		if (useAsync) {
			// Start the async closure
			this.emitAsyncBlockBegin();

			// Push the current buffer onto the stack
			this.bufferStack.push(this.buffer);

			// Create a new buffer array for the nested block
			const newBuffer = this._tmpid();

			// Initialize the new buffer and its index inside the async closure
			this._emitLine(`var ${newBuffer} = [];`);
			this._emitLine(`var ${newBuffer}_index = 0;`);

			// Append the new buffer to the parent buffer
			this._emitLine(`${this.buffer}[${this.buffer}_index++] = ${newBuffer};`);

			// Update the buffer reference
			this.buffer = newBuffer;
			// No need to update bufferIndex; we'll use `${this.buffer}_index` when needed
		}
	}

	emitBufferBlockEnd() {
		if (useAsync) {
			// End the async closure
			this.emitAsyncBlockEnd();

			// Restore the previous buffer from the stack
			this.buffer = this.bufferStack.pop() as string;
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
				this.emitAddToBufferBegin();
				this._emit(`${useAsync ? 'await ' : ''}runtime.suppressValue(`);

				if (this.throwOnUndefined) {
					this._emit(`${useAsync ? 'await ' : ''}runtime.ensureDefined(`);
				}

				this.compile(child, frame);

				if (this.throwOnUndefined) {
					this._emit(`,${node.lineno},${node.colno})`);
				}

				this._emit(', env.opts.autoescape);\n');

				this.emitAddToBufferEnd();
			}
		});
	}

	compileSymbol(node: nunjucks.nodes.Node, frame: nunjucks.runtime.Frame) {
		var name = node.value;
		var v = frame.lookup(name as string);

		if (v) {
			this._emit(v);
		} else {
			this.emitAwaitBegin();//@todo - omit this for function calls (parent instanceof nodes.FunCall && parent.name === node)
			this._emit('runtime.contextOrFrameLookup(' +
				'context, frame, "' + name + '")');
			if (useAsync) {
				this.emitAwaitEnd();
			}
		}
	}

	compileLookupVal(node: nunjucks.nodes.Node, frame: nunjucks.runtime.Frame) {
		this.emitAwaitBegin();
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
			this.emitAddToBufferBegin();
			this._emit(`${useAsync ? 'await ' : ''}runtime.suppressValue(`);
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

			this.emitAddToBufferBegin();

			//this._emitLine(
			//	`${this.buffer} += ${useAsync?'await ':''}runtime.suppressValue(${res}, ${autoescape} && env.opts.autoescape);`);

			this._emitLine(
				`${useAsync ? 'await ' : ''}runtime.suppressValue(${res}, ${autoescape} && env.opts.autoescape);`);

			this.emitAddToBufferEnd();

			this._addScopeLevel();


		} else {
			this._emit(')');
			this.emitAwaitEnd();
			this._emit(`, ${autoescape} && env.opts.autoescape);\n`);
			this.emitAddToBufferEnd();
		}
	}


	compileFunCall(node: nunjucks.nodes.FunCall, frame: nunjucks.runtime.Frame) {
		if (useAsync) {
			this.emitAsyncValueBegin();
		}

		this._emit('(lineno = ' + node.lineno +
			', colno = ' + node.colno + ', ');

		this.emitAwaitBegin();
		this._emit('runtime.callWrap(');
		// Compile it as normal.

		//if (node.name.typename === 'Symbol') {
		//	(this as any).super_compileSymbol(node.name, frame);//this will skip adding await for the function name
		//} else {
		this._compileExpression(node.name, frame);
		//}

		// Output the name of what we're calling so we can get friendly errors
		// if the lookup fails.
		this._emit(', "' + this._getNodeName(node.name).replace(/"/g, '\\"') + '", context, ');

		this._compileAggregate(node.args, frame, '[', '])');

		this._emit(')');

		this.emitAwaitEnd();

		if (useAsync) {
			this.emitAsyncValueEnd();
		}
	}

	compileFor(node: nunjucks.nodes.For, frame: nunjucks.runtime.Frame) {
		this.emitBufferBlockBegin();
		(this as any).super_compileFor(node, frame);
		this.emitBufferBlockEnd();
	}

	compileIf(node: nunjucks.nodes.If, frame: nunjucks.runtime.Frame, async: boolean) {
		this.emitBufferBlockBegin();
		(this as any).super_compileIf(node, frame);
		this.emitBufferBlockEnd();
	}

	compileFilter(node: nunjucks.nodes.Filter, frame: nunjucks.runtime.Frame) {
		this.emitAwaitBegin();
		(this as any).super_compileFilter(node, frame);
		this.emitAwaitEnd();
	}
}