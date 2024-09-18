import * as nunjucks from 'nunjucks';

/**
 * These functions are usually used with string values,
 * but they can also be used with promises or async buffers(array of strings, functions and arrays)
 * Both Promises and async buffers will eventually be resolved to a string,
 * if promise - await the promise
 * if array - store the function at the end og the array to be called when the array elements before it are concatenated
 */
export const asyncRuntime = {
	suppressValue: function (val: string | Promise<any> | any[] | null | undefined, autoescape: boolean) {
		if (Array.isArray(val)) {
			if (autoescape) {
				//append the function to the array, so it will be called after the elements before it are joined
				val.push((value: string) => {
					return (this as any).super_suppressValue(value, true);
				})
			}
			return val;
		}
		if (val && typeof (val as any).then === 'function') {
			//it's a promise, return a promise that suppresses the value when resolved
			return (async (val: Promise<any>) => {
				return (this as any).super_suppressValue(await val, autoescape);
			})(val as Promise<any>);
		}
		return (this as any).super_suppressValue(val, autoescape);
	},

	ensureDefined: function (val: string | Promise<any> | any[] | null | undefined, lineno: number, colno: number) {
		if (Array.isArray(val)) {
			//append the function to the array, so it will be called after the elements before it are joined
			val.push((value: string) => {
				return (this as any).super_ensureDefined(value, lineno, colno);
			})
			return val;
		}
		if (val && typeof (val as any).then === 'function') {
			//it's a promise, return a promise that suppresses the value when resolved
			return (async (val: Promise<any>) => {
				return (this as any).super_ensureDefined(await val, lineno, colno);
			})(val as Promise<any>);
		}
		return (this as any).super_ensureDefined(val, lineno, colno);
	},

	asyncSafeString: function (val: string | Promise<any> | any[] | null | undefined) {
		if (Array.isArray(val)) {
			//append the function to the array, so it will be called after the elements before it are joined
			val.push((value: string) => {
				return new nunjucks.runtime.SafeString(value);
			})
			return val;
		}
		if (val && typeof (val as any).then === 'function') {
			//it's a promise, return a promise that suppresses the value when resolved
			return (async (val: Promise<any>) => {
				return new nunjucks.runtime.SafeString(await val);
			})(val as Promise<any>);
		}
		return new nunjucks.runtime.SafeString(val as string);
	}
}