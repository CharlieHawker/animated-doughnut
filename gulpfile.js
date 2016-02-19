var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    notify = require('gulp-notify'),
    uglify = require('gulp-uglify'),
    plumber = require('gulp-plumber'),
    watch = require('gulp-watch'),
    rename = require('gulp-rename');

var plumberErrorHandler = function(error) {
  notify(error);
};

gulp.task('watch', ['build'], function() {
  return gulp.src('src/animated-doughnut.js', { read: false })
    .pipe(watch('src/animated-doughnut.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('build', function() {
  return gulp.src('src/animated-doughnut.js')
    .pipe(plumber({onError: plumberErrorHandler}))
    .pipe(jshint())
    .pipe(gulp.dest('dist'))
    .pipe(uglify())
    .pipe(rename({
      extname: '.min.js'
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['build']);