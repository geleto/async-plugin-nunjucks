import { expect } from 'chai';
import * as nunjucks from 'nunjucks';
import { AsyncEnvironment } from '../dist/index';

describe('Async env', () => {
	let env: nunjucks.Environment;

	beforeEach(() => {
		env = new AsyncEnvironment();
	});

	it('should add an empty line at the beginning of a single-line template', () => {
		const template = 'Hello, {{ name }}!';
		const result = env.renderString(template, { name: 'World' });
		expect(result).to.equal('\nHello, World!');
	});
});