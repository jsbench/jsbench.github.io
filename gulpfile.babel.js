'use strict';

import gulp        from 'gulp';
import config      from './gulp.config';
import eslint      from 'gulp-eslint';
import browserify  from 'browserify';
import babelify    from 'babelify';
import source      from 'vinyl-source-stream';
import notify      from 'gulp-notify';
import browserSync from 'browser-sync';
import manifest    from 'gulp-manifest';
import path        from 'path';
import mergeStream from 'merge-stream';

function handleErrors() {
	let args = Array.prototype.slice.call(arguments);

	// Send error to notification center with gulp-notify
	notify.onError({
		title: 'Compile Error',
		message: '<%= error.message %>'
	}).apply(this, args);

	// Keep gulp from hanging on this task
	if (typeof this.emit === 'function') {
		this.emit('end');
	}
}

function buildScript(file) {
	let bundler = browserify({
		entries: [`${config.sourceDir}${file}`],
		debug: false,
		cache: {},
		packageCache: {},
		fullPaths: false
	});

	const transforms = [{
		name: babelify,
		options: {}
	}];

	transforms.forEach((transform) => {
		bundler.transform(transform.name, transform.options);
	});

	function rebundle() {
		const stream = bundler.bundle();

		return stream.on('error', handleErrors)
			.pipe(source(file))
			.pipe(gulp.dest(config.scripts.dest))
			.pipe(browserSync.stream());
	}

	// Run it once the first time buildScript is called
	return rebundle();
}

gulp.task('browserify', () => {
	return buildScript(config.scripts.entryPoint);
});

gulp.task('lint', () => {
	return gulp.src([config.scripts.src])
		.pipe(eslint())
		.pipe(eslint.format())
		// Brick on failure to be super strict
		.pipe(eslint.failOnError());
});

gulp.task('manifest', () => {
	mergeStream(
		gulp.src([
			path.join('bundles/js/*.js'),
			path.join('vendor/**/*.js'),
			path.join('st/*.css'),
			path.join('st/images/**/*.{svg,png,ico,jpg}')
		], {
			base: './'
		})
	)
	.pipe(manifest({
		prefix: 'http://jsbench.github.io/',
		hash: true,
		timestamp: false,
		preferOnline: false,
		network: ['*'],
		filename: config.cacheManifestName,
		exclude: config.cacheManifestName
	 }))
	.pipe(gulp.dest('./'));
});

gulp.task('browser-sync', () => {
	browserSync.init({
		server: {
			baseDir: config.browserSync.baseDir
		},
		port: config.browserSync.browserPort,
		ui: {
			port: config.browserSync.UIPort
		},
		ghostMode: false
	});
});

gulp.task('dev', () => {
	gulp.watch('src/**', () => {
		gulp.run('browserify');
	});
});

gulp.task('build', ['lint', 'browserify', 'manifest']);
gulp.task('default', ['build', 'browser-sync']);
