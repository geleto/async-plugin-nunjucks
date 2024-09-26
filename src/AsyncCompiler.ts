import * as nunjucks from 'nunjucks';
import { compiler, runtime, nodes } from 'nunjucks';
import { assert } from './utils';

var useAsync = true;

//This class is moneky patched over the original nunjucks.Compiler by overriding the methods
//Do not add properties to this class (this can be fixed if needed)
//instead of super().someFunction() use super_someFunction()
//This would not have been necessary if nunjucks allowed to override the compiler class
export class AsyncCompiler extends nunjucks.compiler.Compiler {
	bufferStack: string[] = [];
	insideAsyncDepth = 0;
	_emit(code: string) {
		//assert(!code.includes('[object Object]'));
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

	//wrap await calls in this, maybe we should only env.startAsync()/endAsync() the async blocks
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
	emitAsyncBlockBegin(argumentNames: string[] = []) {
		if (useAsync) {
			argumentNames.push('frame');
			this._emit(`(async (${argumentNames.join(',')})=>{`);
			this._emit('env.startAsync();');
			this.insideAsyncDepth++;
		}
	}

	emitAsyncBlockEnd(argumentNames: string[] = []) {
		if (useAsync) {
			argumentNames.push('frame');
			this._emitLine(`})(${argumentNames.join(',')})`);
			this.insideAsyncDepth--;
			if (this.insideAsyncDepth == 0) {
				this._emitLine('.catch(e=>{cb(runtime.handleError(e, lineno, colno))})');
			}
			this._emitLine('.finally(()=>{env.endAsync();})');
		}
	}

	emitAsyncValueBegin(argumentNames: string[] = []) {
		if (useAsync) {
			argumentNames.push('frame');
			this._emitLine(`${this.insideAsyncDepth > 0 ? 'await ' : ''}(async (${argumentNames.join(',')})=>{`);
			this._emitLine('env.startAsync();');
			this._emit('return ');
			this.insideAsyncDepth++;
		}
	}

	emitAsyncValueEnd(argumentNames: string[] = []) {
		if (useAsync) {
			argumentNames.push('frame');
			this._emitLine(`})(${argumentNames.join(',')})`);
			this.insideAsyncDepth--;
			if (this.insideAsyncDepth == 0) {
				this._emitLine('.catch(e=>{cb(runtime.handleError(e, lineno, colno))})');
			}
			this._emitLine('.finally(()=>{env.endAsync();})');
		}
	}

	emitAddToBufferBegin(argumentNames: string[] = []) {
		if (useAsync) {
			argumentNames.push('frame');
			this._emitLine(`(async (${argumentNames.join(',')})=>{`);
			this._emitLine('env.startAsync();');
			this._emitLine(`var index = ${this.buffer}_index++;`);
			this._emit(`${this.buffer}[index] = `);
			this.insideAsyncDepth++;
		}
		else {
			this._emit(`${this.buffer} += `);
		}
	}

	emitAddToBufferEnd(argumentNames: string[] = []) {
		if (useAsync) {
			argumentNames.push('frame');
			this._emitLine(`})(${argumentNames.join(',')})`);
			this.insideAsyncDepth--;
			if (this.insideAsyncDepth == 0) {
				this._emitLine('.catch(e=>{cb(runtime.handleError(e, lineno, colno))})');
			}
			this._emitLine('.finally(()=>{env.endAsync();})');
		}
	}

	emitBufferBlockBegin(argumentNames: string[] = []) {
		if (useAsync) {
			// Start the async closure
			this.emitAsyncBlockBegin(argumentNames);

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

	emitBufferBlockEnd(argumentNames: string[] = []) {
		if (useAsync) {
			// End the async closure
			this.emitAsyncBlockEnd(argumentNames);

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
		this.emitBufferBlockBegin();//

		var _this10 = this;
		// Some of this code is ugly, but it keeps the generated code
		// as fast as possible. ForAsync also shares some of this, but
		// not much.

		var i = this._tmpid();
		var len = this._tmpid();
		var arr = this._tmpid();
		frame = frame.push();
		this._emitLine('frame = frame.push();');
		this._emit("var " + arr + " = ");
		this._compileExpression(node.arr, frame);
		this._emitLine(';');
		this._emit("if(" + arr + ") {");
		this._emitLine(arr + ' = runtime.fromIterator(' + arr + ');');

		// If multiple names are passed, we need to bind them
		// appropriately
		if (node.name instanceof nunjucks.nodes.Array) {
			this._emitLine("var " + i + ";");

			// The object could be an arroy or object. Note that the
			// body of the loop is duplicated for each condition, but
			// we are optimizing for speed over size.
			this._emitLine("if(runtime.isArray(" + arr + ")) {");
			this._emitLine("var " + len + " = " + arr + ".length;");
			this._emitLine("for(" + i + "=0; " + i + " < " + arr + ".length; " + i + "++) {");

			this._emitLine('frame = frame.push();');//async
			this.emitBufferBlockBegin([i]);

			// Bind each declared var
			node.name.children.forEach(function (child, u) {
				var tid = _this10._tmpid();
				_this10._emitLine("var " + tid + " = " + arr + "[" + i + "][" + u + "];");
				//_this10._emitLine("frame.set(\"" + child + "\", " + arr + "[" + i + "][" + u + "]);");
				_this10._emitLine("frame.set(\"" + child.value + "\", " + arr + "[" + i + "][" + u + "]);");//fix nunjucks bug
				frame.set(node.name.children?.[u].value as string, tid);
			});
			this._emitLoopBindings(node, arr, i, len);
			this._withScopedSyntax(function () {
				_this10.compile(node.body, frame);
			});

			this.emitBufferBlockEnd([i]);
			this._emitLine('frame = frame.pop();');//async

			this._emitLine('}');
			this._emitLine('} else {');
			// Iterate over the key/values of an object
			var _node$name$children = node.name.children,
				key = _node$name$children[0],
				val = _node$name$children[1];
			var k = this._tmpid();
			var v = this._tmpid();
			frame.set(key.value as string, k);
			frame.set(val.value as string, v);
			this._emitLine(i + " = -1;");
			this._emitLine("var " + len + " = runtime.keys(" + arr + ").length;");
			this._emitLine("for(var " + k + " in " + arr + ") {");

			this._emitLine('frame = frame.push();');//async
			this.emitBufferBlockBegin([k]);

			this._emitLine(i + "++;");
			this._emitLine("var " + v + " = " + arr + "[" + k + "];");
			this._emitLine("frame.set(\"" + key.value + "\", " + k + ");");
			this._emitLine("frame.set(\"" + val.value + "\", " + v + ");");
			this._emitLoopBindings(node, arr, i, len);
			this._withScopedSyntax(function () {
				_this10.compile(node.body, frame);
			});

			this.emitBufferBlockEnd([k]);
			this._emitLine('frame = frame.pop();');//async

			this._emitLine('}');
			this._emitLine('}');
		} else {
			// Generate a typical array iteration
			var _v = this._tmpid();
			frame.set(node.name.value as string, _v);
			this._emitLine("var " + len + " = " + arr + ".length;");
			this._emitLine("for(var " + i + "=0; " + i + " < " + arr + ".length; " + i + "++) {");

			this._emitLine('frame = frame.push();');//async
			this.emitBufferBlockBegin([i]);

			this._emitLine("var " + _v + " = " + arr + "[" + i + "];");
			this._emitLine("frame.set(\"" + node.name.value + "\", " + _v + ");");
			this._emitLoopBindings(node, arr, i, len);
			this._withScopedSyntax(function () {
				_this10.compile(node.body, frame);
			});


			this.emitBufferBlockEnd([i]);
			this._emitLine('frame = frame.pop();');//async

			this._emitLine('}');
		}
		this._emitLine('}');
		if (node.else_) {
			this._emitLine('if (!' + len + ') {');
			this.compile(node.else_, frame);
			this._emitLine('}');
		}
		this._emitLine('frame = frame.pop();');

		this.emitBufferBlockEnd();//
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

	compileRoot(node: nunjucks.nodes.Root, frame: nunjucks.runtime.Frame) {
		if (frame) {
			this.fail('compileRoot: root node can\'t have frame');
		}

		frame = new nunjucks.runtime.Frame();

		this._emitFuncBegin(node, 'root');
		this._emitLine('var parentTemplate = null;');
		if (useAsync) {
			this._emitLine('var isIncluded = runtime.isIncluded();');
		}
		this._compileChildren(node, frame);

		if (useAsync) {
			this._emitLine('if(!isIncluded){');
			this._emitLine('env.waitAll().then(() => {');
			this._emitLine('  if(parentTemplate) {');
			this._emitLine('    parentTemplate.rootRenderFunc(env, context, frame, runtime, cb);');
			this._emitLine('  } else {');
			this._emitLine(`    cb(null, env.flattentBuffer(${this.buffer}));`);
			this._emitLine('  }');
			this._emitLine('}).catch(e => {');
			this._emitLine('cb(runtime.handleError(e, lineno, colno))');
			this._emitLine('});');
			this._emitLine('} else {');
		}
		this._emitLine('if(parentTemplate) {');
		this._emitLine('  parentTemplate.rootRenderFunc(env, context, frame, runtime, cb);');
		this._emitLine('} else {');
		this._emitLine(`  cb(null, ${this.buffer});`);
		this._emitLine('}');
		if (useAsync) {
			this._emitLine('}');
		}

		this._emitFuncEnd(true);

		this.inBlock = true;

		const blockNames: string[] = [];

		const blocks = node.findAll(nodes.Block);

		blocks.forEach((block, i) => {
			const name = block.name.value;

			if (blockNames.indexOf(name) !== -1) {
				throw new Error(`Block "${name}" defined more than once.`);
			}
			blockNames.push(name);

			this._emitFuncBegin(block, `b_${name}`);

			const tmpFrame = new nunjucks.runtime.Frame();
			this._emitLine('var frame = frame.push(true);');
			this.compile(block.body, tmpFrame);
			this._emitFuncEnd();
		});

		this._emitLine('return {');

		blocks.forEach((block, i) => {
			const blockName = `b_${block.name.value}`;
			this._emitLine(`${blockName}: ${blockName},`);
		});

		this._emitLine('root: root\n};');
	}

	/*_compileGetTemplate(node: nunjucks.nodes.Include, frame: nunjucks.runtime.Frame, eagerCompile: boolean, ignoreMissing: boolean) {
		const parentTemplateId = this._tmpid();
		const parentName = this._templateName();
		const cb = this._makeCallback(parentTemplateId);
		const eagerCompileArg = (eagerCompile) ? 'true' : 'false';
		const ignoreMissingArg = (ignoreMissing) ? 'true' : 'false';
		this._emit('env.getTemplate(');
		this._compileExpression(node.template, frame);
		this._emitLine(`, ${eagerCompileArg}, ${parentName}, ${ignoreMissingArg}, ${cb}`);
		return parentTemplateId;
	}*/

	compileInclude(node: nunjucks.nodes.Include, frame: nunjucks.runtime.Frame) {
		this._emitLine('var tasks = [];');
		this._emitLine('tasks.push(');
		this._emitLine('function(callback) {');
		if (useAsync) {
			this.emitAsyncBlockBegin();
		}
		const id = this._compileGetTemplate(node, frame, false, node.ignoreMissing);
		this._emitLine(`callback(null,${id});`);
		this._emitLine('});');
		if (useAsync) {
			this.emitAsyncBlockEnd();
		}
		this._emitLine('});');

		const id2 = this._tmpid();
		this._emitLine('tasks.push(');
		this._emitLine('function(template, callback){');
		this._emitLine('runtime.pushInclude();');
		this._emitLine('template.render(context.getVariables(), frame, ' + this._makeCallback(id2));
		this._emitLine('runtime.popInclude();');
		this._emitLine('callback(null,' + id2 + ');});');
		this._emitLine('});');

		this._emitLine('tasks.push(');
		this._emitLine('function(result, callback){');
		this._emitLine(`${this.buffer} += result;`);
		this._emitLine('callback(null);');
		this._emitLine('});');
		this._emitLine('env.waterfall(tasks, function(){');
		this._addScopeLevel();
	}
}