# Contributing to JSBench

We'd love for you to contribute to our source code and to make JSBench even better than it is
today! Here are the guidelines we'd like you to follow.

## Setup

0. Install `gulp` globally `npm i -g gulp`
1. Fork this [repository](https://github.com/jsbench/jsbench.github.io) in GitHub
2. Clone locally on your machine
3. Create your branch from `dev`

     ```shell
     git checkout -b my-fix-branch dev
     ```
3. From local repo run `npm install`

## Issue

If you find a bug in the source code, a mistake in the documentation, or would like to propose an improvement you can help us by submitting an issue to our [GitHub Repository](https://github.com/jsbench/jsbench.github.io).
Even better you can submit a Pull Request with a fix.

1. Try [dev](https://github.com/jsbench/jsbench.github.io/tree/dev) branch, perhaps the problem has been solved
2. [Use the search](https://github.com/jsbench/jsbench.github.io/search?type=Issues), perhaps the answer already exists
3. If not found, provide a live example (using [JS Bin](http://jsbin.com/?html,js,output) or [JSFiddle](https://jsfiddle.net/)) or an unambiguous set of steps. 
Apart from that clearly describe the problem
4. Suggest a Fix - if you can't fix the bug yourself, perhaps you can point to what might be causing the problem (line of code or commit)

## Pull Request

1. Before PR run `gulp build`
2. Only into [dev](https://github.com/jsbench/jsbench.github.io/tree/dev) branch
 
## Style Guide
 
Our linter will catch most styling issues that may exist in your code.
You can check the status of your code styling by simply running: `gulp lint`

However, there are still some styles that the linter cannot pick up. If you are unsure about something, looking at [Airbnb's Style Guide](https://github.com/airbnb/javascript) will guide you in the right direction.

### Code Conventions

* Try to follow ES6
* 2 tab stop value for indentation
* `'use strict';`
* Each `var` declaration on its own line
* Commas last `,`
* Prefer `'` over `"`