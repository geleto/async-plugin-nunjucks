import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

const config = (format) => ({
	input: 'src/index.ts',
	output: {
		dir: `dist/${format}`,
		format: format === 'cjs' ? 'cjs' : 'es',
		sourcemap: true,
	},
	plugins: [
		resolve({
			extensions: ['.ts', '.js']
		}),
		commonjs({
			transformMixedEsModules: true,
			esmExternals: true,
			requireReturnsDefault: 'auto'
		}),
		typescript({
			tsconfig: './tsconfig.json',
			sourceMap: true,
			inlineSources: true,
		}),
	],
	external: ['nunjucks'],
});

export default [
	config('esm'),
	config('cjs')
];