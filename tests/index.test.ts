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

	it('should handle custom async filter with global async function', (done) => {
		// Implement custom async filter
		env.addFilter('async', function (promise: Promise<any>, callback: (err: Error | null, result?: any) => void) {
			promise.then(result => {
				callback(null, result);
			}).catch(err => {
				callback(err);
			});
		}, true);

		// Add global async function
		env.addGlobal('fetchUser', async (id: number) => {
			// Simulate async operation
			await new Promise(resolve => setTimeout(resolve, 10));
			return { id, name: `User ${id}` };
		});

		const template = '{% set user = fetchUser(123) | async %}Hello, {{ user.name }}!';

		env.renderString(template, {}, (err, result) => {
			if (err) return done(err);
			expect(result).to.equal('\nHello, User 123!');
			done();
		});
	});
});