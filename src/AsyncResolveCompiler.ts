import * as nunjucks from 'nunjucks';
import { compiler, runtime, nodes } from 'nunjucks';

export class AsyncResolveCompiler extends compiler.Compiler {
	private runningResolves: Promise<any>[] = [];

	constructor(name: string, throwOnUndefined: boolean) {
		super(name, throwOnUndefined);
	}

	compileSymbol(node: nodes.Node, frame: runtime.Frame) {
		var name = node.value;
		var v = frame.lookup(name as string);

		if (v) {
			this._emit(v);
		} else {
			this._emit('runtime.asyncContextOrFrameLookup(' +
				'context, env.resolvedContext, frame, "' + name + '")');
		}
	}
}