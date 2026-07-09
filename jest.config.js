/** @type {import('jest').Config} */
module.exports = {
	testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
	transform: {
		'^.+\\.tsx?$': [
			'babel-jest',
			{
				presets: [
					['@babel/preset-env', { targets: { node: 'current' } }],
					['@babel/preset-typescript', { allowDeclareFields: true }],
				],
				plugins: ['@babel/plugin-transform-modules-commonjs'],
			},
		],
	},
	moduleFileExtensions: [
		'ts',
		'tsx',
		'js',
		'jsx',
		'json',
	],
	testEnvironment: 'node',
	moduleNameMapper: {
		'^react-native-mapsforge-vtm-ext-path-color-ramp$':
			'<rootDir>/src/index',
	},
	// Ignore yalc-linked packages in example/ to avoid haste module name collision.
	modulePathIgnorePatterns: ['<rootDir>/example/.yalc/'],
	// Suppress react-test-renderer deprecation warning.
	globals: {
		'process.env.NODE_ENV': 'test',
	},
	setupFiles: ['<rootDir>/jest.setup.js'],
};
