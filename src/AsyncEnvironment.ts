import * as nunjucks from 'nunjucks';
import { ASTWalker } from './ASTWalker';
import { MonkeyPatcher } from './MonkeyPatcher'

//A dummy extension, only async environments have it, used to identify them
export class AsyncExtension implements nunjucks.Extension {
	tags: string[] = [];
	parse() { }
}

type NestedStringArray = (string | NestedStringArray)[];


export class AsyncEnvironment extends nunjucks.Environment {
	//TODO: this in separate object in the template
	//a new parameter to template.render
	//it will count activeAwaits, store async errors, etc...
	private activeAwaits = 0;//@todo - AsyncEnvironment must be stateless
	private completionResolver: (() => void) | null = null;
	private monkeyPatcher: MonkeyPatcher;

	constructor(loader?: nunjucks.ILoaderAny | nunjucks.ILoaderAny[], opts?: nunjucks.ConfigureOptions) {
		super(loader, opts);
		const extension = new AsyncExtension();
		this.addExtension('AsyncExtension', extension);
		this.monkeyPatcher = new MonkeyPatcher(new ASTWalker(), extension);
	}

	private async asyncRender(template: string, context: object, namedTemplate: boolean): Promise<string> {
		const undoPatch = this.monkeyPatcher.patch();
		try {
			const res = await new Promise<string>((resolve, reject) => {
				let callback = (err: Error | null, res: string | null) => {
					if (err || res === null) {
						reject(err ?? new Error('No render result'));
					} else {
						resolve(res);
					}
				}

				if (namedTemplate)
					this.render(template, context, callback);
				else
					this.renderString(template, context, callback);
			});
			return res;
		}
		finally {
			undoPatch();
		}
	}

	async renderAsync(templateName: string, context: object): Promise<string> {
		return this.asyncRender(templateName, context, true);
	}

	async renderStringAsync(templateString: string, context: object): Promise<string> {
		return this.asyncRender(templateString, context, false);
	}

	flattentBuffer(arr: NestedStringArray): string {
		const result = arr.reduce<string>((acc, item) => {
			if (Array.isArray(item)) {
				return acc + this.flattentBuffer(item);
			}
			if (typeof item === 'function') {
				return ((item as any)(acc) ?? '');
			}
			return acc + (item ?? '');
		}, '');
		return result;
	}

	startAsync(): void {
		this.activeAwaits++;
	}

	//this should always be called from the try 'finally' block
	endAsync(): void {
		this.activeAwaits--;
		if (this.activeAwaits === 0 && this.completionResolver) {
			this.completionResolver();
			this.completionResolver = null;
		}
	}

	async waitAll(): Promise<void> {
		if (this.activeAwaits === 0) {
			return Promise.resolve();
		}
		return new Promise<void>(resolve => {
			this.completionResolver = resolve;
		});
	}
}