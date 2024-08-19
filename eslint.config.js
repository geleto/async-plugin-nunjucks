import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tseslintParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
	eslint.configs.recommended,
	{
		files: ['src/**/*.ts', 'src/**/*.tsx'],
		ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/out/**'],
		languageOptions: {
			parser: tseslintParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json',
				tsconfigRootDir: '.',
			},
			globals: {
				...globals.es2021,
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			'indent': ['error', 'tab', { SwitchCase: 1 }],
			'no-tabs': 'off',

			'semi': ['warn', 'always', { omitLastInOneLineBlock: true }],


			'no-underscore-dangle': ['error', { allowAfterThis: true }],
			'no-new': 'off',
			'@typescript-eslint/no-this-alias': 'off',

			'max-len': ['error', { code: 180 }],
			'no-multi-str': 'off',
			'spaced-comment': 'off',

			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/space-before-function-paren': 'off',

			'@typescript-eslint/explicit-function-return-type': 'off',

			/*'comma-dangle': ['error', {
				arrays: 'never',
				objects: 'never',
				imports: 'never',
				exports: 'never',
				functions: 'never'
			}],
			'semi-style': ['error', 'last'],*/


			'@typescript-eslint/strict-boolean-expressions': 'off', // rely on tsconfig strictNullChecks instead
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off', // equivalent to non-nullable-type-assertion-style

			'no-undef': 'off', // TypeScript handles this
		},
	},
	{
		ignores: ['**/dist/**', '**/build/**', '**/out/**']
	}
];