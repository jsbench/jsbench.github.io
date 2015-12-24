(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = (function app(feast, Benchmark, OAuth, github, share, swal, require) {
	'use strict';

	var gid = 1;

	var GIST_TAGS = '#jsbench #jsperf';
	var STORE_SNIPPETS_KEY = 'jsbench-snippets';

	var OAUTH_PUBLIC_KEY = 'PL76R8FlKhIm2_j4NELvcpRFErg';
	var FIREBASE_ENDPOINT = 'https://jsbench.firebaseio.com/';

	var R_REQUIREJS = /require\((["'])((?:https?:)?\/\/.*?|jquery)\1\)/g;
	var R_REQUIREJS_CLEAN_PATH = /\.js(\?.*?)?$/;

	var firebase = new Firebase(FIREBASE_ENDPOINT);

	/**
  * @class UIApp
  * @extends feast.Block
  */
	var UIApp = feast.Block.extend( /** @lends UIApp# */{
		name: 'app',
		template: feast.parse(document.getElementById('app-template').textContent),

		defaults: {
			desc: '',
			user: github.currentUser || {},
			gist: {},
			setup: { code: '' },
			teardown: { code: '' },
			starred: false,
			running: false
		},

		events: {
			'suite:run': 'handleSuiteRun',
			'suite:save': 'handleSuiteSave',
			'snippet:add': 'handleSuiteAdd',
			'snippet:remove': 'handleSuiteRemove',
			'gist:star': 'handleStar',
			'share': 'handleShare',
			'configure': 'handleConfigure',
			'scrollTo': 'handleScrollTo'
		},

		attrChanged: {
			desc: function desc(_desc) {
				document.title = (_desc ? _desc + ' :: ' : '') + document.title.split('::').pop().trim();
			}
		},

		_stats: [],
		_latestData: null,
		_latestUnsavedResults: null, // последний результат тестов, чтобы при save, добавить их в базу

		snippets: [],

		hasChanges: function hasChanges() {
			return JSON.stringify(this._latestData) !== JSON.stringify(this.toJSON());
		},
		didMount: function didMount() {
			var _this = this;

			// Предупреждалка
			window.onbeforeunload = function () {
				if (!_this.attrs.gist.id && _this.hasChanges() || _this._latestUnsavedResults) {
					return 'Your changes and test results have not been saved!';
				}
			};

			// Роутинг
			window.onhashchange = function () {
				new Promise(function (resolve, reject) {
					if (_this.is('running')) {
						swal({
							title: 'Are you sure?',
							type: 'warning',
							showCancelButton: true,
							confirmButtonColor: '#A5DC86',
							confirmButtonText: 'Continue',
							cancelButtonText: 'Abort'
						}, function (isConfirm) {
							if (!isConfirm) {
								_this._suite.abort();
								resolve();
							} else {
								reject();
							}
						});
					} else {
						resolve();
					}
				}).then(function () {
					_this.routing();
				});
			};

			this.routing().then(function () {
				document.body.className = document.body.className.replace('state-initialization', 'state-ready');
				share.init();
			});
		},
		routing: function routing() {
			var _this2 = this;

			var attrs = this.attrs;
			var hash = location.hash.substr(1);

			try {
				hash = decodeURIComponent(hash);
			} catch (err) {}

			if (this._prevJSONStr === hash) {
				return;
			}

			this._prevJSONStr = '';
			this._latestUnsavedResults = null;
			this.snippets = [];

			this.refs.scrollTo.style.display = 'none';

			// Сбрасываем основные аттрибуты
			this.set({
				desc: '',
				gist: {},
				setup: { code: '' },
				teardown: { code: '' },
				starred: false,
				running: false,
				results: null
			}, null, true);

			clearInterval(this._saveId);

			// Чистим статус
			Object.keys(this.refs).forEach(function (name) {
				/^stat/.test(name) && (_this2.refs[name].innerHTML = '');
			});

			return new Promise(function (resolve) {
				var restoredData = undefined;

				// Gist ID
				if (/^[a-z0-9]+$/.test(hash)) {
					if (github.currentUser) {
						_this2.set('user', github.currentUser);

						github.gist.checkStar(hash).then(function (state) {
							_this2.set('starred', state);
						});
					}

					github.gist.findOne(hash).then(function (gist) {
						var R_CONFIG = /\tBenchmark\.prototype\.(setup|teardown)\s*=.*?\{([\s\S]+?)\n\t};/g;
						var R_SNIPPET = /\tsuite.add.*?\{\n([\s\S]+?)\n\t\}\);/g;
						var matches = undefined;

						while (matches = R_CONFIG.exec(gist.files['suite.js'].content)) {
							attrs[matches[1]] = {
								code: trimStr(matches[2].replace(/\n\t\t/g, '\n')) + '\n'
							};
						}

						while (matches = R_SNIPPET.exec(gist.files['suite.js'].content)) {
							_this2.snippets.push(newSnippet(matches[1].replace(/\n\t\t/g, '\n').trim() + '\n'));
						}

						_this2.set({
							'desc': gist.description.split(' (http')[0],
							'gist': gist
						});

						firebase.child('stats').child(gist.id).child(getGistLastRevisionId(gist)).on('value', function (snapshot) {
							var values = snapshot.val();

							values && _this2.setStats(Object.keys(values).map(function (key) {
								return values[key];
							}));
						});
					})['catch'](showError).then(resolve);
				} else {
					// Пробуем восстановить код из `localStorage`
					try {
						restoredData = JSON.parse(localStorage.getItem(STORE_SNIPPETS_KEY));
					} catch (err) {}

					// Или `location.hash`
					try {
						restoredData = JSON.parse(hash);
					} catch (err) {}

					try {
						attrs.desc = restoredData.desc;
						attrs.setup = restoredData.setup || { code: '' };
						attrs.teardown = restoredData.teardown || { code: '' };
						_this2.snippets = restoredData.snippets.map(function (code) {
							return newSnippet(code);
						});
					} catch (err) {}

					resolve();
				}
			})['catch'](showError).then(function () {
				if (!Array.isArray(_this2.snippets) || !_this2.snippets.length) {
					_this2.snippets = [newSnippet()];
				}

				// Используется при unload
				_this2._latestData = _this2.toJSON();
				_this2._prevJSONStr = JSON.stringify(_this2.toJSON());

				// Cохраняем в `hash` и `localStorage` раз в 1sec
				_this2._saveId = setInterval(function () {
					if (!attrs.gist.id) {
						var jsonStr = JSON.stringify(_this2.toJSON());

						if (_this2._prevJSONStr !== jsonStr) {
							_this2._prevJSONStr = jsonStr;

							try {
								// location.hash = encodeURIComponent(jsonStr);
								localStorage.setItem(STORE_SNIPPETS_KEY, jsonStr);
							} catch (err) {}
						}
					}
				}, 1000);

				_this2.render();
			});
		},
		setStats: function setStats(values) {
			var stats = {};
			var filledSnippets = undefined;

			this._stats = values;

			values.forEach(function (data) {
				var stat = stats[data.name];

				if (!stat) {
					stats[data.name] = stat = [data.name].concat(data.hz);
					stat.count = 1;
				} else {
					stat.count++;
					stat[0] = data.name + ' (' + stat.count + ')';

					for (var i = 0, n = data.hz.length; i < n; i++) {
						stat[i + 1] = (data.hz[i] + stat[i + 1]) / 2;
					}
				}
			});

			// Filter only snippets with actual code
			filledSnippets = this.snippets.filter(function (sn) {
				return trimStr(sn.code);
			});

			this.set('results', {
				names: filledSnippets.map(function (snippet, idx) {
					return '#' + (idx + 1) + ': ' + getName(snippet);
				}),
				series: Object.keys(stats).map(function (name) {
					return stats[name];
				})
			});
		},
		addStat: function addStat(stat) {
			if (stat) {
				var gist = this.attrs.gist;
				var data = {
					name: Benchmark.platform.name + ' ' + Benchmark.platform.version,
					hz: stat
				};

				this._latestUnsavedResults = stat;
				this._stats.push(data);
				this.setStats(this._stats);

				if (gist.id && !this.hasChanges()) {
					this._latestUnsavedResults = null;
					firebase.child('stats').child(gist.id).child(getGistLastRevisionId(gist)).push(data);
				}
			}
		},
		toJSON: function toJSON() {
			var attrs = this.attrs;

			return {
				desc: attrs.desc,
				setup: { code: attrs.setup.code },
				teardown: { code: attrs.teardown.code },
				snippets: this.snippets.map(function (snippet) {
					return snippet.code;
				})
			};
		},
		testSnippetsEmpty: function testSnippetsEmpty() {
			return this.snippets.every(function (snippet) {
				return !trimStr(snippet.code);
			});
		},
		handleScrollToEnd: function handleScrollToEnd() {
			// Скрываем кнопку скролла при достижении конца страницы
			if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
				this.handleScrollTo();
			}
		},
		handleSuiteAdd: function handleSuiteAdd() {
			this.snippets.push(newSnippet());
			this.render();
		},
		handleSuiteRemove: function handleSuiteRemove(evt) {
			this.snippets.splice(this.snippets.indexOf(evt.details), 1);
			this.render();
		},
		handleSuiteRun: function handleSuiteRun() {
			var _this3 = this;

			var refs = this.refs;
			var attrs = this.attrs;
			var suite = new Benchmark.Suite();
			var index = {};
			var depends = {};

			if (this.testSnippetsEmpty()) {
				return;
			}

			parseDeps(attrs.setup.code, depends);

			this.snippets.forEach(function (snippet) {
				var code = trimStr(snippet.code);

				snippet.status = '';
				index[snippet.id] = snippet;

				// Add only relevant test snippets to suite
				if (code) {
					parseDeps(code, depends);

					suite.add(snippet.id, {
						fn: code,
						setup: trimStr(attrs.setup.code),
						teardown: trimStr(attrs.teardown.code),
						onCycle: function onCycle(evt) {
							refs['stats-' + snippet.id].innerHTML = toStringBench(evt.target);
						}
					});
				}
			});

			suite.on('cycle', function (evt) {
				var stat = evt.target;

				!suite.aborted && (refs['stats-' + stat.name].innerHTML = toStringBench(stat));
			}).on('complete', function (evt) {
				if (!suite.aborted) {
					var results = evt.currentTarget;

					suite.filter('fastest').forEach(function (stat) {
						index[stat.name].status = 'fastest';
					});

					suite.filter('slowest').forEach(function (stat) {
						index[stat.name].status = 'slowest';
					});

					_this3.addStat(results.map(function (bench) {
						return bench.hz;
					}));
					_this3.setRunningState(false, true);
				}
			});

			// Tests are running
			this.setRunningState(true);

			var paths = {};

			depends = Object.keys(depends).map(function (url) {
				paths[url] = url.replace(R_REQUIREJS_CLEAN_PATH, '');
				return url;
			});

			require.config({ paths: paths });

			require(depends, function () {
				suite.run({ 'async': true });
			}, function (err) {
				showError({ message: err.requireModules.join(', ') });
				_this3.setRunningState(false);
			});

			this._suite = suite;
		},
		setRunningState: function setRunningState(state, scrollTo) {
			this.set('running', state);
			this.refs.scrollTo.style.display = !state && scrollTo ? '' : 'none';
			this[!state && scrollTo ? '$on' : '$off'](window, 'scroll', 'handleScrollToEnd');
		},
		handleSuiteSave: function handleSuiteSave() {
			var _this4 = this;

			var attrs = this.attrs;
			var gist = attrs.gist;
			var desc = attrs.desc || 'Untitled benchmark';
			var setupCode = trimStr(attrs.setup.code);
			var teardownCode = trimStr(attrs.teardown.code);

			var suiteCode = ['"use strict";', '', '(function (factory) {', '	if (typeof Benchmark !== "undefined") {', '		factory(Benchmark);', '	} else {', '		factory(require("benchmark"));', '	}', '})(function (Benchmark) {', '	var suite = new Benchmark.Suite;', '',

			// Setup
			!setupCode ? '' : ['	Benchmark.prototype.setup = function () {', '		' + setupCode.split('\n').join('\n\t\t'), '	};', ''].join('\n'),

			// Teardown
			!teardownCode ? '' : ['	Benchmark.prototype.teardown = function () {', '		' + teardownCode.split('\n').join('\n\t\t'), '	};', ''].join('\n'),

			// Snippets
			this.snippets.map(function (snippet) {
				return ['	suite.add(' + JSON.stringify(getName(snippet)) + ', function () {', '		' + trimStr(snippet.code).split('\n').join('\n\t\t'), '	});'].join('\n');
			}).join('\n\n'), '', '	suite.on("cycle", function (evt) {', '		console.log(" - " + evt.target);', '	});', '', '	suite.on("complete", function (evt) {', '		console.log(new Array(30).join("-"));', '', '		var results = evt.currentTarget.sort(function (a, b) {', '			return b.hz - a.hz;', '		});', '', '		results.forEach(function (item) {', '			console.log((idx + 1) + ". " + item);', '		});', '	});', '', '	console.log(' + JSON.stringify(desc) + ');', '	console.log(new Array(30).join("-"));', '	suite.run();', '});', ''].join('\n');

			var files = {
				'suite.js': { content: suiteCode },
				'index.html': { content: ['<!DOCTYPE html>', '<html>', '<head>', '	<meta charset="utf-8"/>', '	<title>' + desc + '</title>', '	<script src="https://cdnjs.cloudflare.com/ajax/libs/benchmark/1.0.0/benchmark.min.js"></script>', '	<script src="./suite.js"></script>', '</head>', '<body>', '	<h1>Open the console to view the results</h1>', '	<h2><code>cmd + alt + j</code> or <code>ctrl + alt + j</code></h2>', '</body>', '</html>', ''].join('\n') }
			};

			this.set('saving', true);

			// Запросим пользователя, чтобы быть 100% уверенными в актуальности данных
			github.user().then(function (user) {
				var save = function save(gist) {
					var isNew = !gist.id;

					return github.gist.save(gist.id, desc + (isNew ? ' ' : ' (' + location.toString() + ') ') + GIST_TAGS, files).then(function (gist) {
						_this4.set('gist', gist); // (1)
						location.hash = gist.id; // (2)

						swal('Saved', gist.html_url, 'success');

						if (isNew) {
							github.gist.save(gist.id, desc + ' (' + location.toString() + ') ' + GIST_TAGS);
							_this4.addStat(_this4._latestUnsavedResults);
						}

						return gist;
					});
				};

				// Обновляем текущего юзера
				github.setUser(user);
				_this4.set('user', user);

				// А теперь решим, fork или save
				return gist.id && gist.owner.id !== user.id ? github.gist.fork(gist.id).then(save) : save(gist);
			})['catch'](showError).then(function () {
				_this4._latestData = _this4.toJSON();
				_this4.set('saving', false);
			});
		},
		handleStar: function handleStar() {
			this.invert('starred');
			github.gist.star(this.attrs.gist.id, this.attrs.starred);
		},
		handleConfigure: function handleConfigure(evt) {
			evt.details.visible = !evt.details.visible;
			this.render();
		},
		handleScrollTo: function handleScrollTo() {
			this.refs.scrollTo.style.display = 'none';
			this.refs.chart.scrollIntoView();
			this.$off(window, 'scroll', 'handleScrollToEnd');
		},
		handleShare: function handleShare(evt) {
			var service = evt.details;

			Promise.resolve(share[service](this.attrs.desc, location.toString(), GIST_TAGS, this)).then(function () {
				swal(service.charAt(0).toUpperCase() + service.substr(1), 'The test results is shared', 'success');
			}, showError);
		}
	});

	//
	// Вспомогательные методы
	//

	function showError(err) {
		var message = err && err.message || 'Something went wrong';

		if (err instanceof Error) {
			console.error(err.stack);
		}

		swal('Oops...', message, 'error');
	}

	function newSnippet(code) {
		return {
			id: gid++,
			code: code || '',
			status: ''
		};
	}

	function trimStr(value) {
		return value == null ? '' : String(value).trim();
	}

	function formatNumber(number) {
		number = String(number).split('.');

		return number[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',') + (number[1] ? '.' + number[1] : '');
	}

	function getName(snippet) {
		return String(snippet.code !== undefined ? snippet.code : snippet).trim().split('\n')[0].replace(/(^\/[*/]+|\**\/$)/g, '').trim();
	}

	function toStringBench(bench) {
		var error = bench.error;
		var hz = bench.hz;
		var stats = bench.stats;
		var size = stats.sample.length;

		if (error) {
			return error;
		} else {
			return formatNumber(hz.toFixed(hz < 100 ? 2 : 0)) + ' ops/sec<br/>' + '\xb1' + stats.rme.toFixed(2) + '%<br/>' + '(' + size + ' run' + (size === 1 ? '' : 's') + ' sampled)';
		}
	}

	function getGistLastRevisionId(gist) {
		var i = 0;
		var history = gist.history;
		var n = history.length;

		for (; i < n; i++) {
			if (history[i].change_status.total > 0) {
				return history[i].version;
			}
		}

		return gist.id;
	}

	function parseDeps(code, deps) {
		var dep = undefined;

		while (dep = R_REQUIREJS.exec(code)) {
			deps[dep[2]] = true;
		}
	}

	// Init
	OAuth.initialize(OAUTH_PUBLIC_KEY);
	window.app = new UIApp().renderTo(document.getElementById('canvas'));
})(window.feast, window.Benchmark, window.OAuth, window.github, window.share, window.sweetAlert, window.requirejs);

},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = (function btn(feast) {
	'use strict'

	/**
  * @class UIBtn
  * @extends feast.Block
  */
	;
	feast.Block.extend( /** @lends UIBtn# */{
		name: 'btn',
		template: feast.parse(document.getElementById('btn-template').textContent),

		defaults: {
			mod: 'primary',
			disabled: false
		}
	});
})(window.feast);

},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = (function chart(feast, google) {
	'use strict'

	/**
  * @class UIChart
  * @extends feast.Block
  */
	;
	var UIChart = feast.Block.extend( /** @lends UIChart# */{
		name: 'chart',
		template: feast.parse('<div/>'),

		attrChanged: {
			data: function data() {
				this.visualization && this.redraw();
			}
		},

		didMount: function didMount() {
			var _this = this;

			google.load('visualization', '1', {
				packages: ['corechart', 'bar'],
				callback: function callback() {
					// uglyfix for https://github.com/google/google-visualization-issues/issues/2070
					try {
						window.requirejs([]);
					} catch (err) {}

					_this.visualization = true;
					_this.redraw();
				}
			});
		},
		redraw: function redraw() {
			var _this2 = this;

			var data = this.attrs.data;

			if (google.visualization && data) {
				if (!this.chart) {
					this.chart = new google.visualization.BarChart(this.el);

					google.visualization.events.addListener(this.chart, 'ready', function () {
						_this2.broadcast('ready');
					});
				}

				this.chart.draw(
				// Data
				google.visualization.arrayToDataTable([['Platform'].concat(data.names)].concat(data.series)),

				// Options
				{
					chartArea: {
						top: 0,
						left: '20%',
						width: '60%',
						height: '95%'
					},
					backgroundColor: {
						fill: 'transparent'
					},
					legend: {
						position: 'right',
						alignment: 'center'
					}
				});
			}
		},
		toDataURI: function toDataURI() {
			return this.chart.getImageURI();
		}
	});

	// Export
	window.UIChart = UIChart;
})(window.feast, window.google);

},{}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = (function editor(feast) {
	'use strict'

	/**
  * @class UIEditor
  * @extends feast.Block
  */
	;
	feast.Block.extend( /** @lends UIEditor# */{
		name: 'editor',
		template: feast.parse('<div bem:mod="{attrs.mode}"/>'),

		didMount: function didMount() {
			var _this = this;

			requirejs(['ace/ace'], function (ace) {
				try {
					(function () {
						var editor = _this.editor = ace.edit(_this.el);

						editor.$blockScrolling = Number.POSITIVE_INFINITY;

						editor.setTheme('ace/theme/tomorrow');
						editor.getSession().setMode('ace/mode/javascript');
						editor.setOption('maxLines', _this.attrs['max-lines'] || 30);
						editor.setOption('minLines', _this.attrs['min-lines'] || 4);

						editor.on('change', function () {
							_this.attrs.data.code = editor.getValue().trim();
						});

						editor.setValue(_this.attrs.data.code || '', 1);
						editor.focus();
					})();
				} catch (err) {
					console.warn('[Ace.error]', err);
				}
			});
		},
		didUnmount: function didUnmount() {
			this.editor && this.editor.destroy();
		}
	});
})(window.feast);

},{}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = (function github(OAuth, swal) {
	'use strict';

	var API_ENDPOINT = 'https://api.github.com/';
	var API_STATUS_OK = 200;

	var STORE_USER_KEY = 'jsbench-gihub-user';
	var STORE_STARS_KEY = 'jsbench-gihub-stars';

	var _api = undefined;
	var _user = undefined;
	var _stars = {};
	var _gists = {};

	function _getApi() {
		if (!_api) {
			_api = new Promise(function (resolve, reject) {
				OAuth.popup('github', { cache: true }).done(resolve).fail(function (err) {
					if (err.toString().indexOf('popup')) {
						swal({
							title: 'Oops, required authorization!',
							type: 'warning',
							showCancelButton: true,
							confirmButtonColor: '#A5DC86',
							confirmButtonText: 'Sign in with GitHub',
							cancelButtonText: 'Cancel'
						}, function (isConfirm) {
							if (isConfirm) {
								OAuth.popup('github', { cache: true }).done(resolve).fail(reject);
							} else {
								reject();
							}
						});
					} else {
						reject();
					}
				});
			});
		}

		return _api;
	}

	function _call(type, method, data) {
		return _getApi().then(function (api) {
			return api[type](method, { data: JSON.stringify(data) });
		});
	}

	function _store(key, value) {
		try {
			if (arguments.length === 2) {
				localStorage.setItem(key, JSON.stringify(value));
			} else {
				return JSON.parse(localStorage.getItem(key));
			}
		} catch (err) {}
	}

	// Export
	window.github = {
		currentUser: null,

		setUser: function setUser(user) {
			this.currentUser = user;
			_store(STORE_USER_KEY, user);
		},
		user: function user(login) {
			return _user || _call('get', 'user' + (login ? '/' + login : '')).then(function (user) {
				!login && github.setUser(user);
				return user;
			});
		},

		gist: {
			findOne: function findOne(id) {
				var promise = undefined;
				var url = 'gists/' + id;
				var _fetch = function _fetch() {
					return fetch(API_ENDPOINT + url).then(function (res) {
						if (res.status !== API_STATUS_OK) {
							throw 'Error: ' + res.status;
						}

						return res.json();
					});
				};

				if (_gists[id]) {
					// Cache
					promise = Promise.resolve(_gists[id]);
				} else if (github.currentUser) {
					promise = _call('get', url)['catch'](function () {
						github.setUser(null);
						return _fetch();
					});
				} else {
					promise = _fetch()['catch'](function () {
						return _call('get', url);
					});
				}

				return promise.then(function (gist) {
					_gists[gist.id] = gist;
					return gist;
				});
			},
			save: function save(id, desc, files) {
				var gist = _gists[id];
				var changed = undefined;

				if (gist && gist.description === desc && Object.keys(gist.files).length === Object.keys(files).length) {
					changed = Object.keys(gist.files).filter(function (name) {
						return !files[name] || files[name].content !== gist.files[name].content;
					});

					if (!changed.length) {
						return Promise.resolve(gist);
					}
				}

				return _call(id ? 'patch' : 'post', 'gists' + (id ? '/' + id : ''), {
					'public': true,
					'description': desc,
					'files': files
				}).then(function (gist) {
					_gists[gist.id] = gist;
					return gist;
				});
			},
			fork: function fork(id) {
				return _call('post', 'gists/' + id + '/fork');
			},
			star: function star(id, state) {
				return _call(state ? 'put' : 'del', 'gists/' + id + '/star').then(function () {
					_stars[id] = state;
					_store(STORE_STARS_KEY, _stars);
					return state;
				});
			},
			checkStar: function checkStar(id) {
				if (typeof _stars[id] === 'undefined') {
					return _call('get', 'gists/' + id + '/star').then(function () {
						_stars[id] = true;
					}, function () {
						_stars[id] = false;
					}).then(function () {
						_store(STORE_STARS_KEY, _stars);
						return _stars[id];
					});
				} else {
					return Promise.resolve(_stars[id]);
				}
			}
		}
	};

	_stars = _store(STORE_STARS_KEY) || {};
	window.github.setUser(_store(STORE_USER_KEY));
})(window.OAuth, window.sweetAlert);

},{}],6:[function(require,module,exports){
'use strict'

// Application modules
;

require('./btn');

require('./github');

require('./chart');

require('./editor');

require('./share');

require('./app');

},{"./app":1,"./btn":2,"./chart":3,"./editor":4,"./github":5,"./share":7}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = (function share(fetch) {
	'use strict';

	var SCREEN_WIDTH = screen.width;
	var SCREEN_HEIGHT = screen.height;

	var twttr = {
		url: 'https://twitter.com/intent/tweet?text=',
		length: 140,
		width: 550,
		height: 250
	};

	var _facebook = {
		id: '900218293360254',
		publishUrl: 'https://graph.facebook.com/me/photos',
		width: 1200,
		height: 630,

		init: function init() {
			return this._promiseInit || (this._promiseInit = new Promise(function (resolve) {
				window.fbAsyncInit = function fbAsyncInit() {
					var FB = window.FB;

					FB.init({
						appId: _facebook.id,
						version: 'v2.5',
						cookie: true,
						oauth: true
					});

					_facebook.api = FB;
					resolve(FB);
				};

				(function loadFacebook(d, s, id) {
					var fjs = d.getElementsByTagName(s)[0];
					var js = undefined;
					if (d.getElementById(id)) {
						return;
					}
					js = d.createElement(s);
					js.id = id;
					js.src = '//connect.facebook.net/en_US/sdk.js';
					fjs.parentNode.insertBefore(js, fjs);
				})(document, 'script', 'facebook-jssdk');
			}));
		},
		login: function login() {
			return this._promiseLogin || (this._promiseLogin = this.init().then(function (api) {
				return new Promise(function (resolve, reject) {
					api.login(function (response) {
						if (response.authResponse) {
							_facebook.token = response.authResponse.accessToken;
							resolve();
						} else {
							reject(new Error('Access denied'));
						}
					}, {
						scope: 'publish_actions'
					});
				});
			}));
		}
	};

	// todo: Вынести в утилиты
	function generateChartsAsBlob(app, width, height) {
		return new Promise(function (resolve) {
			var el = document.createElement('div');
			var chart = new UIChart({
				data: app.get('results'),
				mode: 'fit'
			});

			el.className = 'invisible';
			el.style.width = width + 'px';
			el.style.height = height + 'px';

			chart.on('ready', function () {
				var dataURI = chart.toDataURI();

				chart.destroy();
				document.body.removeChild(el);

				resolve(dataURLtoBlob(dataURI));
			});

			document.body.appendChild(el);
			chart.renderTo(el);
		});
	}

	// Export
	window.share = {
		twitter: function twitter(desc, url, tags) {
			var top = Math.max(Math.round(SCREEN_HEIGHT / 3 - twttr.height / 2), 0);
			var left = Math.round(SCREEN_WIDTH / 2 - twttr.width / 2);
			var message = desc.substr(0, twttr.length - (url.length + tags.length + 5)) + ': ' + url + ' ' + tags;
			var params = 'left=' + left + ',top=' + top + ',width=' + twttr.width + ',height=' + twttr.height;
			var extras = ',personalbar=0,toolbar=0,scrollbars=1,resizable=1';

			window.open(twttr.url + encodeURIComponent(message), '', params + extras);
		},
		facebook: function facebook(desc, url, tags, app) {
			return Promise.all([_facebook.login(), generateChartsAsBlob(app, _facebook.width, _facebook.height)]).then(function (results) {
				var file = results[1];
				var formData = new FormData();

				formData.append('access_token', _facebook.token);
				formData.append('source', file);
				formData.append('message', desc + '\n' + url + '\n' + tags);

				return fetch(_facebook.publishUrl, {
					method: 'post',
					mode: 'cors',
					body: formData
				}).then(function (response) {
					if (response.status >= 200 && response.status < 300) {
						return response;
					} else {
						return response.json().then(function (json) {
							throw new Error(json.error.message);
						});
					}
				});
			});
		},
		init: function init() {
			_facebook.init();
		}
	};
})(window.fetch);

},{}]},{},[6]);
