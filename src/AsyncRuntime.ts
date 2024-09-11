import * as nunjucks from 'nunjucks';

namespace AsyncRuntime {
	//@todo - async await support
	function contextOrFrameLookup(context: nunjucks.Context, frame: nunjucks.runtime.Frame, name: string) {
		var val = frame.lookup(name);
		return val !== undefined ? val : context.lookup(name);
	}

	//@todo - async await support
	function memberLookup(obj: any, val: string | number) {
		if (obj === undefined || obj === null) {
			return undefined;
		}

		if (typeof obj[val] === 'function') {
			return (...args: any[]) => obj[val].apply(obj, args);
		}

		return obj[val];
	}
}