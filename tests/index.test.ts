import { expect } from 'chai';
import * as nunjucks from 'nunjucks';
import { AsyncEnvironment } from '../dist/index';

describe('Async env', () => {
	let env: AsyncEnvironment;

	beforeEach(() => {
		env = new AsyncEnvironment();
	});

	// Test for async getter
	/*it('should correctly render an async getter', async () => {
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

		const context = {
			get currentTime() {
				return (async () => {
					await delay(50);  // Reduced delay
					return '2024-09-12T17:12:123Z';
				})();
			}
		};

		const template = 'Current time is: {{ currentTime }}';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('Current time is: 2024-09-12T17:12:123Z');
	});

	// Test for async promise variable
	it('should correctly resolve an async Promise variable', async () => {
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

		const context = {
			weatherPromise: (async () => {
				await delay(100);  // Reduced delay
				return { temp: 22, condition: 'Sunny' };
			})()
		};

		const template = 'The weather is {{ weatherPromise.temp }}°C and {{ weatherPromise.condition }}.';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('The weather is 22°C and Sunny.');
	});

	// Test for async function
	it('should correctly resolve an async function', async () => {
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

		const context = {
			async fetchUser(id: number) {
				await delay(150);  // Reduced delay
				return { id, name: 'John Doe', email: 'john@example.com' };
			}
		};

		const template = '{% set user = await fetchUser(1) %}User: {{ user.name }} ({{ user.email }})';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('User: John Doe (john@example.com)');
	});

	// Test for dependent async functions (user and user's posts)
	it('should correctly resolve dependent async functions', async () => {
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

		const context = {
			async fetchUser(id: number) {
				await delay(100);  // Reduced delay
				return { id, name: 'John Doe' };
			},
			async fetchUserPosts(userId: number) {
				await delay(50);  // Reduced delay
				return [
					{ id: 1, title: 'First post', content: 'Hello world!' },
					{ id: 2, title: 'Second post', content: 'Async is awesome!' },
				];
			}
		};

		const template = `
		{% set user = await fetchUser(1) %}
		User: {{ user.name }}
		Posts:
		{% for post in await fetchUserPosts(user.id) %}
		  - {{ post.title }}: {{ post.content }}
		{% endfor %}
		`;

		const result = await env.renderStringAsync(template, context);
		expect(result.trim()).to.equal(`
		User: John Doe
		Posts:
		  - First post: Hello world!
		  - Second post: Async is awesome!
		`.trim());
	});

	// Test for handling async function with missing data
	it('should handle async functions that return null or undefined', async () => {
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

		const context = {
			async fetchUser(id: number) {
				await delay(100);  // Reduced delay
				return null;  // Simulate no user found
			}
		};

		const template = '{% set user = await fetchUser(1) %}User: {{ user ? user.name : "Not found" }}';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('User: Not found');
	});*/
});

describe('await filter tests', () => {

	let env: nunjucks.Environment;

	beforeEach(() => {
		env = new nunjucks.Environment();
		// Implement 'await' filter for resolving promises in templates
		env.addFilter('await', function (promise: Promise<any>, callback: (err: Error | null, result?: any) => void) {
			promise.then(result => {
				callback(null, result);
			}).catch(err => {
				callback(err);
			});
		}, true);
	});

	it('should handle custom async filter with global async function', (done) => {
		// Add global async function
		env.addGlobal('fetchUser', async (id: number) => {
			// Simulate async operation
			await new Promise(resolve => setTimeout(resolve, 10));
			return { id, name: `User ${id}` };
		});

		const template = '{% set user = fetchUser(123) | await %}Hello, {{ user.name }}!';

		env.renderString(template, {}, (err, result) => {
			if (err) return done(err);
			expect(result).to.equal('Hello, User 123!');
			done();
		});
	});

	it('should handle asyncEach with records of promises', (done) => {
		// Add global function to fetch records
		env.addGlobal('getRecords', () => {
			// Return an array of promises (each record is a promise)
			return [
				new Promise(resolve => setTimeout(() => resolve('Record 1'), 10)),
				new Promise(resolve => setTimeout(() => resolve('Record 2'), 20)),
				new Promise(resolve => setTimeout(() => resolve('Record 3'), 15))
			];
		});

		const template = `{%- set records = getRecords() -%}
		{%- asyncEach rec in records -%}
		{{ rec | await }}{% if not loop.last %}\n{% endif %}
		{%- endeach %}`;

		env.renderString(template, {}, (err, result) => {
			if (err) return done(err);
			expect((result as string).trim()).to.equal('Record 1\nRecord 2\nRecord 3');
			done();
		});
	});
});