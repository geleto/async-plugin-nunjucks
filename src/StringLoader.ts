import * as nunjucks from 'nunjucks';

export class StringLoader implements nunjucks.ILoader {
	private cache: Map<string, string>;

	constructor() {
		this.cache = new Map<string, string>();
	}

	getSource(name: string): nunjucks.LoaderSource {
		if (!this.cache.has(name)) {
			throw new Error(`Template ${name} not found in cache`);
		}

		return {
			src: this.cache.get(name)!,
			path: name,
			noCache: false
		};
	}

	addTemplate(name: string, content: string): void {
		this.cache.set(name, content);
	}
}