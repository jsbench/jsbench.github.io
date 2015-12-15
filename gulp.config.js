'use strict';

export default {

	sourceDir: './src/',
	buildDir: './bundles/',

	cacheManifestName: 'app.cache.manifest',

	browserSync: {
		browserPort: 3000,
		UIPort: 3001,
		baseDir: './'
	},

	scripts: {
		src: 'src/**/*.js',
		dest: 'bundles/js',
		entryPoint: 'jsbench.js'
	},

	browserify: {
		bundleName: 'jsbench.js',
		prodSourcemap: false
	}
};
