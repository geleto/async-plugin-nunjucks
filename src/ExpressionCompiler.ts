import * as nunjucks from 'nunjucks';
import { compiler, runtime, nodes } from 'nunjucks';

type CompiledExpression = (env: nunjucks.Environment, context: object, frame: runtime.Frame, rnt: typeof runtime) => any;

export class ExpressionCompiler extends compiler.Compiler {
	constructor(name: string, throwOnUndefined: boolean) {
		super(name, throwOnUndefined);
	}

	compileExpression(node: nodes.Node, frame = new runtime.Frame()) {
		this.codebuf = [];
		this.buffer = 'expressionResult';

		this._emit('var expressionResult = ');
		this._compileExpression(node, frame);
		this._emit(';');

		const code = this.getCode();
		return new Function('context', 'env', 'runtime', code + '; return expressionResult;');
	}

	evaluate(compiledFunc: CompiledExpression, env: nunjucks.Environment, context: object, frame: runtime.Frame, rnt: typeof runtime) {
		return compiledFunc(env, context, frame, rnt);
	}
}