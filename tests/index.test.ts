/*import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('Math operations', () => {
	describe('add function', () => {
		it('should add two numbers correctly', () => {
			expect(2 + 3).to.equal(5);
		});
	});
});*/


import { expect } from 'chai';
import * as nunjucks from 'nunjucks';
import { AddEmptyLineExtension } from 'async-plugin-nunjucks';

describe('AddEmptyLineExtension', () => {
	let env: nunjucks.Environment;

	beforeEach(() => {
		env = new nunjucks.Environment();
		env.addExtension('AddEmptyLineExtension', new AddEmptyLineExtension());
	});

	it('should add an empty line at the beginning of a single-line template', () => {
		const template = 'Hello, {{ name }}!';
		const result = env.renderString(template, { name: 'World' });
		expect(result).to.equal('\nHello, World!');
	});
});