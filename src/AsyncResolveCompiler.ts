import * as nunjucks from 'nunjucks';
import { compiler, runtime, nodes } from 'nunjucks';

//@todo - SafeString with arrays, async suppressValue, async ensureDefined
//see also markSafe, callWrap, makeKeywordArgs

//This class is moneky patched over the original nunjucks.Compiler by overriding the methods
//Do not add properties to this class, as they will not be available in the original class
//Do not use super, as the methods are directly copied to the  nunjucks.Compiler class
export class AsyncResolveCompiler extends nunjucks.compiler.Compiler {

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
			{
				find: `${this.buffer} =`,
				replace: `${this.buffer}[${this.buffer}_index++] =`,
				ignorePrefix: 'var '
			},
			{
				find: `${this.buffer});`,
				replace: `${this.buffer}[${this.buffer}_index]);`,
				ignorePrefix: 'cb(null, '
			}
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
}