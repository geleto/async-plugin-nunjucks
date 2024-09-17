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

	describe('Basic Async Rendering', () => {
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
	});

	describe('Error Handling and Edge Cases', () => {
		// Test for handling async function with missing data
		it('should handle async functions that return null or undefined', async () => {
			const context = {
				async fetchUser(id: number) {
					await delay(50);
					return null;  // Simulate no user found
				}
			};

			const template = '{% set user = fetchUser(1) %}User: {% if user %}{{ user.name }}{% else %}Not found{% endif %}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('User: Not found');
		});
	});

	describe('Dependent Async Functions', () => {
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
			{%- set user = fetchUser(1) %}
			User: {{ user.name }}
			First title: {{ fetchUserPostsFirstTitle(user.id) }}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			User: John Doe
			First title: First post
			`);
		});
	});

	describe('Loops', () => {
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

		it('should handle async functions inside a simple for loop', async () => {
			const context = {
				items: [1, 2, 3],
				async getData(id: number) {
					await delay(50);
					return `Item ${id}`;
				}
			};

			const template = `
			{%- for item in items %}
			  - {{ getData(item) }}
			{%- endfor %}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			  - Item 1
			  - Item 2
			  - Item 3
			`);
		});

		it('should handle async functions with loop.index', async () => {
			const context = {
				items: ['a', 'b', 'c'],
				async transform(item: string, index: number) {
					await delay(50);
					return `${item.toUpperCase()}-${index}`;
				}
			};

			const template = `
			{%- for item in items %}
			  {{ transform(item, loop.index) }}
			{%- endfor %}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			  A-1
			  B-2
			  C-3
			`);
		});

		it('should handle nested for loops with async functions', async () => {
			const context = {
				users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
				async getPosts(userId: number) {
					await delay(50);
					return [`Post 1 by User ${userId}`, `Post 2 by User ${userId}`];
				}
			};

			const template = `
			{%- for user in users %}
			  {{ user.name }}:
			  {%- for post in getPosts(user.id) %}
				- {{ post }}
			  {%- endfor %}
			{%- endfor %}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			  Alice:
				- Post 1 by User 1
				- Post 2 by User 1
			  Bob:
				- Post 1 by User 2
				- Post 2 by User 2
			`);
		});

		it('should handle async functions in for...in...async loops', async () => {
			const context = {
				async getUsers() {
					await delay(50);
					return [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
				},
				async getRole(userId: number) {
					await delay(30);
					return userId === 1 ? 'Admin' : 'User';
				}
			};

			const template = `
			{%- for user in getUsers() %}
			  {{ user.name }}: {{ getRole(user.id) }}
			{%- endfor %}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			  Alice: Admin
			  Bob: User
			`);
		});

		it('should handle async functions with loop variables', async () => {
			const context = {
				items: ['a', 'b', 'c'],
				async processItem(item: string, index: number, first: boolean, last: boolean) {
					await delay(50);
					let result = `${item.toUpperCase()}-${index}`;
					if (first) result += ' (First)';
					if (last) result += ' (Last)';
					return result;
				}
			};

			const template = `
			{%- for item in items %}
			  {{ processItem(item, loop.index, loop.first, loop.last) }}
			{%- endfor %}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			  A-1 (First)
			  B-2
			  C-3 (Last)
			`);
		});
	});

	describe('Conditional Statements', () => {
		it('should handle async function in if condition', async () => {
			const context = {
				async isUserAdmin(id: number) {
					await delay(50);
					return id === 1;
				}
			};

			const template = '{% if isUserAdmin(1) %}Admin{% else %}Not admin{% endif %}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('Admin');

			const template2 = '{% if isUserAdmin(2) %}Admin{% else %}Not admin{% endif %}';
			const result2 = await env.renderStringAsync(template2, context);
			expect(result2).to.equal('Not admin');
		});

		it('should handle async promise in if condition', async () => {
			const context = {
				userStatus: Promise.resolve('active')
			};

			const template = '{% if userStatus == "active" %}User is active{% else %}User is not active{% endif %}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('User is active');
		});

		it('should handle multiple async conditions in if/else if/else', async () => {
			const context = {
				async getUserRole(id: number) {
					await delay(50);
					if (id === 1) return 'admin';
					if (id === 2) return 'moderator';
					return 'user';
				}
			};

			const template = `
			{%- if getUserRole(1) == "admin" -%}Admin user
			{%- elif getUserRole(2) == "moderator" -%}Moderator user
			{%- else -%}Regular user
			{%- endif -%}`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('Admin user');

			const template2 = `
			{%- if getUserRole(3) == "admin" -%}
				Admin user
			{%- elif getUserRole(2) == "moderator" -%}
				Moderator user
			{%- else -%}
				Regular user
			{%- endif -%}`;

			const result2 = await env.renderStringAsync(template2, context);
			expect(result2).to.equal('Moderator user');
		});

		it('should handle async functions inside if blocks', async () => {
			const context = {
				async isUserAdmin(id: number) {
					await delay(50);
					return id === 1;
				},
				async getUserName(id: number) {
					await delay(50);
					return id === 1 ? 'John' : 'Jane';
				}
			};

			const template = `
			{%- if isUserAdmin(1) -%}Hello, Admin {{ getUserName(1) }}!
			{%- else -%}Hello, User {{ getUserName(2) }}!
			{%- endif -%}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('Hello, Admin John!');

			const template2 = `
			{%- if isUserAdmin(2) -%}Hello, Admin {{ getUserName(2) }}!
			{%- else -%}Hello, User {{ getUserName(2) }}!
			{%- endif -%}`;

			const result2 = await env.renderStringAsync(template2, context);
			expect(result2).to.equal('Hello, User Jane!');
		});

		it('should handle nested if statements with async functions', async () => {
			const context = {
				async isUserActive(id: number) {
					await delay(50);
					return id % 2 === 0;
				},
				async getUserRole(id: number) {
					await delay(50);
					return id === 1 ? 'admin' : 'user';
				}
			};

			const template = `
        {%- if isUserActive(1) -%}
            {%- if getUserRole(1) == "admin" -%}Active Admin
            {%- else -%}Active User
            {%- endif -%}
        {%- else -%}Inactive User
        {%- endif -%}
        `;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('Inactive User');

			const template2 = `
        {%- if isUserActive(2) -%}
            {%- if getUserRole(2) == "admin" -%}Active Admin
            {%- else -%}Active User
            {%- endif -%}
        {%- else -%}Inactive User
        {%- endif -%}
        `;

			const result2 = await env.renderStringAsync(template2, context);
			expect(result2.trim()).to.equal('Active User');
		});
	})
});