# Async Nunjucks (async-plugin-nunjucks)

This is Work in Progress and not yet ready

A plugin for the Nunjucks templating engine that transparently allows templates to work with asynchronous context properties and functions, plugins and filters. It fetches data in parallel in a non-blocking manner while ensuring that dependent data wait for their prerequisites to complete.

This approach significantly reduces overall rendering time for templates with multiple asynchronous operations.

## Table of Contents

1. [How It Works](#how-it-works)
2. [Features](#features)
3. [Installation](#installation)
4. [Usage](#usage)
   - [Basic Setup](#basic-setup)
   - [Example](#example)
5. [API Reference](#api-reference)
   - [AsyncEnvironment](#asyncenvironment)
   - [renderAsync](#renderasync)
   - [renderStringAsync](#renderstringasync)
6. [Async Filter Support](#async-filter-support)
7. [Async Plugin Support](#async-plugin-support)
8. [Performance Considerations](#performance-considerations)
9. [Error Handling](#error-handling)
10. [Compatibility](#compatibility)
11. [License](#license)

## How It Works

Async Nunjucks processes template segments in parallel, potentially out of order, while respecting dependencies between operations. The independently rendered parts are then assembled in the correct sequence to produce the final output.

## Features

- Parallel non-blocking resolution of multiple async operations for improved performance
- Correct handling of dependent async operations
- Support for various asynchronous data types in the context object:
  - Async getters
  - Promise variables
  - Async functions
  - Async iterables
- Asynchronous filter support
- Asynchronous extension support

## Installation

To install Async Nunjucks with the compatible version of Nunjucks, run the following command:

```bash
npm install async-plugin-nunjucks nunjucks@3.2.4
```

## Usage

### Basic Setup

```javascript
const { AsyncEnvironment } = require('async-plugin-nunjucks');

const env = new AsyncEnvironment();
```

### Note on Async Tags

It is advisable not to use the async versions of the following Nunjucks tags, as they will prevent parallel rendering:

- `asyncEach`
- `asyncAll`
- `asyncMacro`

Instead, use the standard synchronous versions of these tags (`each`, `for`, `macro`) in combination with async values in your context object. Async Nunjucks will handle the asynchronous resolution automatically while maintaining parallel execution where possible.

### Example

This example demonstrates the use of different types of async data, including dependent operations:

```javascript
const { AsyncEnvironment } = require('async-plugin-nunjucks');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const context = {
  // Async getter using Object.defineProperty
  get currentTime() {
    return (async () => {
      await delay(500);  // 500ms delay
      return new Date().toISOString();
    })();
  },

  // Promise variable
  weatherPromise: (async () => {
    await delay(1000);  // 1000ms delay
    return { temp: 22, condition: 'Sunny' };
  })(),

  // Async function to fetch user
  async fetchUser(id) {
    await delay(1500);  // 1500ms delay
    return { id, name: 'John Doe', email: 'john@example.com' };
  },

  // Async function to fetch user's posts
  async fetchUserPosts(userId) {
    await delay(1000);  // 1000ms delay
    return [
      { id: 1, title: 'First post', content: 'Hello world!' },
      { id: 2, title: 'Second post', content: 'Async is awesome!' },
    ];
  }
};

const template = `
Time: {{ currentTime }}
Weather: {{ (await weatherPromise).temp }}°C, {{ (await weatherPromise).condition }}

{% set user = await fetchUser(1) %}
User: {{ user.name }}

Posts by {{ user.name }}:
{% for post in await fetchUserPosts(user.id) %}
  - {{ post.title }}
{% endfor %}
`;

async function renderTemplate() {
  const env = new AsyncEnvironment();
  console.time('Render time');
  const result = await env.renderStringAsync(template, context);
  console.timeEnd('Render time');
  console.log(result);
}

renderTemplate().catch(console.error);
```

In this example:
1. `currentTime`, `weatherPromise`, and `fetchUser(1)` start executing in parallel.
2. `fetchUser(1)` completes after 1500ms, and its result is stored using `{% set user = await fetchUser(1) %}`.
3. `fetchUserPosts(user.id)` starts executing after `fetchUser(1)` completes, demonstrating dependent async operation handling.
4. The total render time is approximately 2500ms (1500ms for `fetchUser` + 1000ms for `fetchUserPosts`), despite having operations that total 4000ms if run sequentially.

## API Reference

### AsyncEnvironment

```javascript
const env = new AsyncEnvironment(loader, options);
```
Creates a new Async Nunjucks environment. Accepts the same parameters as the standard Nunjucks Environment.

### renderAsync

```javascript
const result = await env.renderAsync(templateName, context);
```
Asynchronously renders a template from a file.

### renderStringAsync

```javascript
const result = await env.renderStringAsync(templateString, context);
```
Asynchronously renders a template from a string.

## Async Filter Support

The async filters work like regular Nunjucks filters, but return a Promise instead of a direct value. For example:

```javascript
env.addFilter('uppercase', async (str) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  return str.toUpperCase();
});
```

Use in template:

```nunjucks
{{ "hello world" | uppercase }}
```

## Async Plugin Support

The asynchronous plugins work like regular Nunjucks plugins, but the `run` method returns a Promise. For example:

```javascript
class AsyncFetchExtension {
  tags = ['asyncFetch'];

  parse(parser, nodes, lexer) {
    const tok = parser.nextToken();
    const args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);
    return new nodes.CallExtensionAsync(this, 'run', args);
  }

  async run(context, url) {
    const response = await fetch(url);
    return response.json();
  }
}

env.addExtension('AsyncFetch', new AsyncFetchExtension());
```

Usage in template:

```nunjucks
{% asyncFetch "https://api.example.com/data" %}
```

## Note on Async Tags
It is advisable not to use the `asyncEach` and `asyncAll` tags, as they may prevent parallel rendering:

Instead, use the standard synchronous versions of these tags (each, for) in combination with async values in your context object. Async Nunjucks will handle the asynchronous resolution automatically while maintaining parallel execution where possible.

## Compatibility

Async Nunjucks is compatible with Nunjucks 3.2.4 version.

The Async Nunjucks plugin leverages functionality that is not part of the official Nunjucks plugin API.
As a result, this plugin may break in future versions of Nunjucks if these internal APIs or behaviors change.

## License

Async Nunjucks is released under the MIT License.