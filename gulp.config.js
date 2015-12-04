'use strict';

export default {

	browserPort: 3000,
	UIPort: 3001,

	sourceDir: './src/',
	buildDir: './',

	scripts: {
		src: 'src/**/*.js',
		dest: '.',
		entryPoint: 'jsbench.bundle.js'
	},

	browserify: {
		bundleName: 'jsbench.bundle.js',
		prodSourcemap: false
	}
};
