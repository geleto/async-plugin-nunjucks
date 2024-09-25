import * as nunjucks from 'nunjucks';

export class StringLoader implements nunjucks.ILoader {
	private templates = new Map<string, string>();

	getSource(name: string): nunjucks.LoaderSource {
		if (!this.templates.has(name)) {
			throw new Error(`Template ${name} not found`);
		}

		return {
			src: this.templates.get(name)!,
			path: name,
			noCache: false
		};
	}

	addTemplate(name: string, content: string): void {
		this.templates.set(name, content);
	}
}