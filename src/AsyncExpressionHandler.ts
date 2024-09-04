import * as nunjucks from 'nunjucks';
import { compiler, runtime, nodes } from 'nunjucks';

type AsyncCompiledExpression = (env: nunjucks.Environment, context: object, frame: runtime.Frame, rnt: typeof runtime) => Promise<any>;

/**
 * Use a differnet compiler for each template
 */
export class AsyncExpressionHandler extends compiler.Compiler {
	private runningExpressions: Promise<any>[] = [];

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
		return new Function('context', 'env', 'runtime',
			`return (async () => {
        ${code}
        return expressionResult;
      })();`
		) as AsyncCompiledExpression;
	}

	evaluate(compiledFunc: AsyncCompiledExpression, env: nunjucks.Environment, context: object, frame: runtime.Frame, rnt: typeof runtime) {
		const expressionPromise = compiledFunc(env, context, frame, rnt);
		this.runningExpressions.push(expressionPromise);
		return expressionPromise;
	}

	async waitAllExpressions(): Promise<void> {
		await Promise.all(this.runningExpressions);
		this.runningExpressions = []; // Clear the array after all expressions are resolved
	}
}