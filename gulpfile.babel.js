'use strict';

import gulp   from 'gulp';
import jshint from 'gulp-jshint';
import eslint from 'gulp-eslint';

// TODO: Will refactor in next Pull Requests
const DIRS = {
	src: 'src/**/*.js',
	dest: 'dist/js'
};

gulp.task('lint', () => {
	return gulp.src([DIRS.src])
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'))
		.pipe(eslint())
		.pipe(eslint.format())
});

gulp.task('default', ['lint'], function () {
	// This will only run if the lint task is successful...
});
