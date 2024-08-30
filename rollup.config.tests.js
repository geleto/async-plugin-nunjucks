import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
	input: 'tests/index.test.ts',
	output: {
		dir: 'out/tests',
		format: 'es',
		sourcemap: true,
	},
	plugins: [
		json(),
		resolve({
			extensions: ['.ts', '.js', '.mjs', '.json'],
			modulePaths: [path.resolve(__dirname, 'dist/esm')]
		}),
		commonjs({
			transformMixedEsModules: true,
			esmExternals: true,
			requireReturnsDefault: 'auto'
		}),
		typescript({
			tsconfig: './tests/tsconfig.json',
			sourceMap: true,
			inlineSources: true,
		}),
	],
	external: ['mocha', 'chai'],
};