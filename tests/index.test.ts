import { expect } from 'chai';
import * as nunjucks from 'nunjucks';
import { AsyncEnvironment } from '../dist/index';

describe('Async env', () => {
	let env: AsyncEnvironment;

	beforeEach(() => {
		env = new AsyncEnvironment();
	});

	it('should add an empty line at the beginning of a single-line template', async () => {
		const template = 'Hello, {{ name }}!';
		const context = { name: 'World' };
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('\nHello, World!');
	});

	// Test for async getter
	it('should correctly render an async getter', async () => {
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

		const context = {
			get currentTime() {
				return (async () => {
					await delay(50);  // Reduced delay
					return new Date().toISOString();
				})();
			}
		};

		const template = 'Current time is: {{ currentTime }}';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.match(/^Current time is: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
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

		const template = 'The weather is {{ (await weatherPromise).temp }}°C and {{ (await weatherPromise).condition }}.';
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
	});
});


describe('Regular env', () => {

	let env: nunjucks.Environment;

	beforeEach(() => {
		env = new nunjucks.Environment();
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
			expect(result).to.equal('Hello, User 123!');
			done();
		});
	});
});