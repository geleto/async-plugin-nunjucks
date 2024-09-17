import { expect } from 'chai';
import * as nunjucks from 'nunjucks';
import { AsyncEnvironment } from '../dist/index';
import { assert } from 'console';

describe('Async env', () => {
	let env: AsyncEnvironment;
	const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

	beforeEach(() => {
		env = new AsyncEnvironment();

	});

	// Test for async getter
	it('should correctly render an async getter', async () => {
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
	it('should correctly resolve an async function in output', async () => {
		const context = {
			async fetchUserName(id: number) {
				await delay(150);
				return 'John Doe';
			}
		};

		const template = 'User: {{ fetchUserName() }}';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('User: John Doe');
	});

	it('should correctly resolve an async function followed by member resolution in output', async () => {
		const context = {
			async fetchUser(id: number) {
				await delay(150);
				return { id, name: 'John Doe', email: 'john@example.com' };
			}
		};

		const template = 'User: {{ fetchUser(1).name }}';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('User: John Doe');
	});

	//should correctly resolve a member async function in output (@todo - see if there is an unneeded await for the function name)

	it('should correctly resolve an async function with set', async () => {
		const context = {
			async fetchUser(id: number) {
				await delay(150);
				return { id, name: 'John Doe', email: 'john@example.com' };
			}
		};

		const template = '{% set user = fetchUser(1) %}User: {{ user.name }} ({{ user.email }})';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('User: John Doe (john@example.com)');
	});

	// Test for dependent async functions (user and user's posts)
	it('should correctly resolve async functions with dependent arguments', async () => {
		const userPosts =
			[
				[
					{ id: 1, title: 'User #0 first post', content: 'Hello from user 0!' },
				],
				[
					{ id: 1, title: 'First post', content: 'Hello world!' },
					{ id: 2, title: 'Second post', content: 'Async is awesome!' }
				]
			];
		const context = {
			async fetchUser(id: number) {
				await delay(100);
				return { id, name: 'John Doe' };
			},
			async fetchUserPostsFirstTitle(userId: number) {
				await delay(50);
				assert(userId >= 0 && userId < userPosts.length);
				return userPosts[userId][0].title;
			}
		};

		const template = `
		{% set user = fetchUser(1) %}
		User: {{ user.name }}
		First title: {{ fetchUserPostsFirstTitle(user.id) }}
		`;

		const result = await env.renderStringAsync(template, context);
		expect(result.trim()).to.equal(`
		User: John Doe
		First title: First post
		`.trim());
	});

	it('should correctly handle async functions inside a for loop', async () => {
		const context = {
			ids: [1, 2, 3],
			async fetchData(id: number) {
				await delay(50 - 2 * id);
				return `Data for ID ${id}`;
			}
		};

		const template = `
		{%- for id in ids %}
		  - {{ fetchData(id) }}
		{%- endfor %}
		`;

		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal(`
		  - Data for ID 1
		  - Data for ID 2
		  - Data for ID 3
		`);
	});

	it('should correctly resolve async functions with dependent arguments inside a for loop', async () => {
		const userPosts =
			[
				[
					{ id: 1, title: 'User #0 first post', content: 'Hello from user 0!' },
				],
				[
					{ id: 1, title: 'First post', content: 'Hello world!' },
					{ id: 2, title: 'Second post', content: 'Async is awesome!' }
				]
			];
		const context = {
			async fetchUser(id: number) {
				await delay(100);
				return { id, name: 'John Doe' };
			},
			async fetchUserPosts(userId: number) {
				await delay(50);
				assert(userId >= 0 && userId < userPosts.length);
				return userPosts[userId];
			}
		};

		const template = `
		{%- set user = fetchUser(1) %}
		User: {{ user.name }}
		Posts:
		{%- for post in fetchUserPosts(user.id) %}
		  - {{ post.title }}: {{ post.content }}
		{%- endfor %}
		`;

		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal(`
		User: John Doe
		Posts:
		  - First post: Hello world!
		  - Second post: Async is awesome!
		`);
	});

	// Test for handling async function with missing data
	it('should handle async functions that return null or undefined', async () => {
		const context = {
			async fetchUser(id: number) {
				await delay(50);
				return null;  // Simulate no user found
			}
		};

		const template = '{% set user = fetchUser(1) %}User: {{ user ? user.name : "Not found" }}';
		const result = env.renderStringAsync(template, context);
		expect(result).to.equal('User: Not found');
	});
});

/*describe('await filter tests', () => {

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
});*/