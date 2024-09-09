import * as nunjucks from 'nunjucks';

namespace AsyncRuntime {
	function asyncContextOrFrameLookup(context: nunjucks.Context, resolvedCtx: any, frame: nunjucks.runtime.Frame, name: string) {
		var val = frame.lookup(name);
		if (val !== undefined) {
			return val;
		}

		if (name in context.env.globals && !(name in context.ctx)) {
			return context.env.globals[name];
		} else {
			const res = resolvedCtx[name];
			resolvedCtx[name] = res;
			return res;
		}
	}

	function asyncMemberLookup(obj: any, resolvedObj: any, val: string | number) {
		if (obj === undefined || obj === null) {
			return undefined;
		}

		if (typeof obj[val] === 'function') {
			const func = (...args: any[]) => obj[val].apply(obj, args);
			resolvedObj[val] = func;
			return func;
		}

		resolvedObj[val] = obj[val];
		return obj[val];
	}
}