import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';

const config = [
	{
		input: 'src/index.ts',
		output: [
			{
				file: 'dist/esm/index.js',
				format: 'es',
				sourcemap: true,
			},
			{
				file: 'dist/cjs/index.js',
				format: 'cjs',
				sourcemap: true,
			},
		],
		plugins: [
			resolve({
				extensions: ['.ts', '.js']
			}),
			commonjs(),
			typescript({
				tsconfig: './tsconfig.json',
				sourceMap: true,
				inlineSources: true,
				compilerOptions: {
					declaration: false,
				}
			}),
		],
		external: ['nunjucks'],
	},
	{
		input: 'src/index.ts',
		output: [{ file: 'dist/index.d.ts', format: 'es' }],
		plugins: [dts()],
	},
];

export default config;