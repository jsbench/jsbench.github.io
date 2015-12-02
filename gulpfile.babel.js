'use strict';

import gulp   from 'gulp';
import eslint from 'gulp-eslint';

// TODO: Will refactor in next Pull Requests
const DIRS = {
	src: 'src/**/*.js',
	dest: 'dist/js'
};

gulp.task('lint', () => {
	return gulp.src([DIRS.src])
		.pipe(eslint())
		.pipe(eslint.format())
	// Brick on failure to be super strict
	  .pipe(eslint.failOnError());
});

gulp.task('default', ['lint'], function () {
	// This will only run if the lint task is successful...
});
