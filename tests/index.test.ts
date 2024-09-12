import { expect } from 'chai';
import * as nunjucks from 'nunjucks';
import { AsyncEnvironment } from '../dist/index';

describe('Async env', () => {
	let env: AsyncEnvironment;

	beforeEach(() => {
		env = new AsyncEnvironment();
	});

	// Test for async getter
	it('should correctly render an async getter', async () => {
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