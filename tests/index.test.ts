import { expect } from 'chai';
import * as nunjucks from 'nunjucks';
import { AsyncEnvironment } from '../dist/index';
import { assert } from 'console';
import { unescape } from 'he';

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

		it('should handle a chain of dependent async functions', async () => {
			const context = {
				async fetchUserId() {
					await delay(50);
					return 1;
				},
				async fetchUserName(id: number) {
					await delay(50);
					return id === 1 ? 'John Doe' : 'Jane Doe';
				},
				async fetchUserPosts(name: string) {
					await delay(50);
					return name === 'John Doe' ? ['Post 1', 'Post 2'] : ['Post A', 'Post B'];
				}
			};

			const template = `
			{%- set userId = fetchUserId() %}
			{%- set userName = fetchUserName(userId) %}
			{%- set userPosts = fetchUserPosts(userName) %}
			User: {{ userName }}
			Posts: {{ userPosts | join(', ') }}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			User: John Doe
			Posts: Post 1, Post 2
			`);
		});

		// New test: Complex dependent async functions
		it('should handle complex dependent async functions', async () => {
			const context = {
				async fetchUserId() {
					await delay(50);
					return 1;
				},
				async fetchUserName(id: number) {
					await delay(50);
					return id === 1 ? 'John Doe' : 'Jane Doe';
				},
				async fetchUserRole(name: string) {
					await delay(50);
					return name === 'John Doe' ? 'Admin' : 'User';
				},
				async fetchPermissions(role: string) {
					await delay(50);
					return role === 'Admin' ? ['read', 'write', 'delete'] : ['read'];
				}
			};

			const template = `
			{%- set userId = fetchUserId() %}
			{%- set userName = fetchUserName(userId) %}
			{%- set userRole = fetchUserRole(userName) %}
			{%- set permissions = fetchPermissions(userRole) %}
			User: {{ userName }}
			Role: {{ userRole }}
			Permissions: {{ permissions | join(', ') }}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			User: John Doe
			Role: Admin
			Permissions: read, write, delete
			`);
		});

		// New test: Handling async functions with multiple dependencies
		it('should handle async functions with multiple dependencies', async () => {
			const context = {
				async fetchUser(id: number) {
					await delay(50);
					return { id, name: 'John Doe' };
				},
				async fetchDepartment(id: number) {
					await delay(50);
					return { id, name: 'IT' };
				},
				async generateReport(user: any, department: any) {
					await delay(50);
					return `Report for ${user.name} in ${department.name}`;
				}
			};

			const template = `
			{%- set user = fetchUser(1) %}
			{%- set department = fetchDepartment(2) %}
			{%- set report = generateReport(user, department) %}
			{{ report }}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`
			Report for John Doe in IT
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

	describe('Async Functions in Expressions', () => {
		it('should handle async functions in filter expressions', async () => {
			env.addFilter('uppercase', async (str: string) => {
				await delay(50);
				return str.toUpperCase();
			});//note that this is not declared as async filter with the regular callback method, it just returns a promise

			const context = {
				async uppercase(str: string) {
					await delay(50);
					return str.toUpperCase();
				}
			};
			const template = '{{ "hello" | uppercase }}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('HELLO');
		});

		it('should handle async functions in if expressions', async () => {
			const context = {
				async isAdmin() {
					await delay(50);
					return true;
				}
			};
			const template = '{{ "Admin" if isAdmin() else "User" }}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('Admin');
		});
	});

	describe('Async Functions in Control Structures', () => {
		it('should handle async functions in for loops', async () => {
			const context = {
				async getItems() {
					await delay(50);
					return ['a', 'b', 'c'];
				}
			};
			const template = '{% for item in getItems() %}{{ item }}{% endfor %}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('abc');
		});

		it('should handle async functions in set statements', async () => {
			const context = {
				async getValue() {
					await delay(50);
					return 42;
				}
			};
			const template = '{% set x = getValue() %}{{ x }}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('42');
		});
	});

	describe('Async Functions in Template Structure', () => {
		it('should handle async functions in macro calls', async () => {
			const context = {
				async fetchTitle(id: number) {
					await delay(50);
					return id === 1 ? 'Hello' : 'World';
				}
			};
			const template = `
			{%- macro header(id) -%}
				H:{{ fetchTitle(id) }}
			{%- endmacro -%}
			{{ header(1) }} {{ header(2) }}`;
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal(`H:Hello H:World`);
		});

		it('should handle async functions in macro call arguments', async () => {
			const context = {
				async fetchTitle() {
					await delay(50);
					return 'Async Title';
				},
				async fetchContent() {
					await delay(50);
					return 'Async Content';
				}
			};

			const template = `
			{% macro article(title, content) %}
			<article>
				<h1>{{ title }}</h1>
				<p>{{ content }}</p>
			</article>
			{% endmacro %}

			{{ article(fetchTitle(), fetchContent()) }}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(unescape(result.trim())).to.equal(`
			<article>
				<h1>Async Title</h1>
				<p>Async Content</p>
			</article>
			`.trim());
		});

		it('should handle async macro call arguments with dependent function in macro body', async () => {
			const context = {
				async fetchUser(id: number) {
					await delay(50);
					return { id, name: `User ${id}` };
				},
				async fetchUserPosts(userId: number) {
					await delay(50);
					return [`Post 1 by User ${userId}`, `Post 2 by User ${userId}`];
				}
			};

			const template = `
			{%- macro userProfile(user) -%}
			<div class="user-profile">
				<h2>{{ user.name }}</h2>
				<h3>Posts:</h3>
				<ul>
				{%- for post in fetchUserPosts(user.id) %}
					<li>{{ post }}</li>
				{%- endfor %}
				</ul>
			</div>
			{%- endmacro %}

			{{ userProfile(fetchUser(1)) }}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(unescape(result.trim())).to.equal(`
			<div class="user-profile">
				<h2>User 1</h2>
				<h3>Posts:</h3>
				<ul>
					<li>Post 1 by User 1</li>
					<li>Post 2 by User 1</li>
				</ul>
			</div>
			`.trim());
		});

		it('should handle multiple async macro call arguments', async () => {
			const context = {
				async fetchHeader() {
					await delay(50);
					return 'Async Header';
				},
				async fetchFooter() {
					await delay(50);
					return 'Async Footer';
				},
				async fetchContent() {
					await delay(50);
					return 'Async Content';
				}
			};

			const template = `
			{% macro page(header, content, footer) %}
			<div class="page">
				<header>{{ header }}</header>
				<main>{{ content }}</main>
				<footer>{{ footer }}</footer>
			</div>
			{% endmacro %}

			{{ page(fetchHeader(), fetchContent(), fetchFooter()) }}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(unescape(result.trim())).to.equal(`
			<div class="page">
				<header>Async Header</header>
				<main>Async Content</main>
				<footer>Async Footer</footer>
			</div>
			`.trim());
		});

		it('should handle nested async macro calls', async () => {
			const context = {
				async fetchUser(id: number) {
					await delay(50);
					return { id, name: `User ${id}` };
				},
				async fetchUserRole(userId: number) {
					await delay(50);
					return userId % 2 === 0 ? 'Admin' : 'User';
				}
			};

			const template = `
			{% macro userRole(userId) %}
			{{ fetchUserRole(userId) }}
			{% endmacro %}

			{% macro userProfile(user) %}
			<div class="user-profile">
				<h2>{{ user.name }}</h2>
				<p>Role: {{ userRole(user.id) }}</p>
			</div>
			{% endmacro %}

			{{ userProfile(fetchUser(1)) }}
			{{ userProfile(fetchUser(2)) }}
			`;

			const result = await env.renderStringAsync(template, context);
			expect(unescape(result.trim())).to.equal(`
			<div class="user-profile">
				<h2>User 1</h2>
				<p>Role: User</p>
			</div>
			<div class="user-profile">
				<h2>User 2</h2>
				<p>Role: Admin</p>
			</div>
			`.trim());
		});

		it('should handle async functions in include statements', async () => {
			// Note: This test assumes that AsyncEnvironment supports async getTemplate
			// If it doesn't, this test would need to be adjusted or removed
			const context = {
				async getTemplate() {
					await delay(50);
					return 'Hello, {{ name }}!';
				},
				name: 'World'
			};
			const template = '{% include getTemplate() %}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('Hello, World!');
		});
	});

	describe('Complex Async Scenarios', () => {
		it('should handle async functions returning complex objects', async () => {
			const context = {
				async getUser() {
					await delay(50);
					return { name: 'John', roles: ['admin', 'user'] };
				}
			};
			const template = '{{ getUser().name }} is {{ getUser().roles[0] }}';
			const result = await env.renderStringAsync(template, context);
			expect(result).to.equal('John is admin');
		});

		it('should handle error propagation in async calls', async () => {
			const context = {
				async errorFunc() {
					await delay(50);
					throw new Error('Async error');
				}
			};
			const template = '{{ errorFunc() }}';

			try {
				await env.renderStringAsync(template, context);
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error).to.be.an('error');
				expect((error as any).message).to.equal('Async error');
			}
		});
	});
});