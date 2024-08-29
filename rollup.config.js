import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
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
				include: ['src/**/*.ts', 'types/**/*.d.ts'],
				compilerOptions: {
					module: 'ESNext',
					target: 'ES2018',
					useDefineForClassFields: false,
				},
			}),
		],
		external: ['fs', 'path', 'nunjucks'],
	},
	{
		input: 'dist/esm/index.d.ts',
		output: [{ file: 'dist/index.d.ts', format: 'es' }],
		plugins: [dts()],
	},
];

export default config;