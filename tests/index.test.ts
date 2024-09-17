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

		const template = '{% set user = fetchUser(1) %}User: {% if user %}{{ user.name }}{% else %}Not found{% endif %}';
		const result = await env.renderStringAsync(template, context);
		expect(result).to.equal('User: Not found');
	});

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
});