(function (feast, Benchmark, OAuth, github, share, swal) {
	'use strict';

	var gid = 1;

	var GIST_TAGS = '#jsbench #jsperf';
	var STORE_SNIPPETS_KEY = 'jsbench-snippets';

	var OAUTH_PUBLIC_KEY = 'PL76R8FlKhIm2_j4NELvcpRFErg';
	var FIREBASE_ENDPOINT = 'https://jsbench.firebaseio.com/';

	var firebase = new Firebase(FIREBASE_ENDPOINT);

	/**
	 * @class UIApp
	 * @extends feast.Block
	 */
	var UIApp = feast.Block.extend(/** @lends UIApp# */{
		name: 'app',
		template: feast.parse(document.getElementById('app-template').textContent),

		defaults: {
			desc: '',
			user: github.currentUser || {},
			gist: {},
			setup: {code: ''},
			teardown: {code: ''},
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
			desc: function (desc) {
				document.title = (desc ? desc + ' :: ' : '') + document.title.split('::').pop().trim();
			}
		},

		_stats: [],
		_latestData: null,
		_latestUnsavedResults: null, // последний результат тестов, чтобы при save, добавить их в базу

		snippets: [],

		hasChanges: function () {
			return JSON.stringify(this._latestData) !== JSON.stringify(this.toJSON());
		},

		didMount: function () {
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
					if (_this.attrs.running) {
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

		routing: function () {
			var _this = this;
			var attrs = _this.attrs;
			var hash = location.hash.substr(1);

			try {
				hash = decodeURIComponent(hash);
			} catch (err) {}

			if (_this._prevJSONStr === hash) {
				return;
			}

			_this._prevJSONStr = '';
			_this._latestUnsavedResults = null;
			_this.snippets = [];

			_this.refs.scrollTo.style.display = 'none';

			// Сбрасываем основные аттрибуты
			_this.set({
				desc: '',
				gist: {},
				setup: {code: ''},
				teardown: {code: ''},
				starred: false,
				running: false,
				results: null
			}, null, true);

			clearInterval(_this._saveId);

			// Чистим статус
			Object.keys(_this.refs).forEach(function (name) {
				/^stat/.test(name) && (_this.refs[name].innerHTML = '');
			});

			return new Promise(function (resolve) {
				var restoredData;

				// Gist ID
				if (/^[a-z0-9]+$/.test(hash)) {
					if (github.currentUser) {
						_this.set('user', github.currentUser);

						github.gist.checkStar(hash).then(function (state) {
							_this.set('starred', state);
						});
					}

					github.gist.findOne(hash).then(function (gist) {
						var R_CONFIG = /\tBenchmark\.prototype\.(setup|teardown)\s*=.*?\{([\s\S]+?)\n\t};/g;
						var R_SNIPPET = /\tsuite.add.*?\{\n([\s\S]+?)\n\t\}\);/g;
						var matches;

						while (matches = R_CONFIG.exec(gist.files['suite.js'].content)) {
							attrs[matches[1]] = {
								code: matches[2].replace(/\n\t\t/g, '\n').trim() + '\n'
							};
						}

						while (matches = R_SNIPPET.exec(gist.files['suite.js'].content)) {
							_this.snippets.push(newSnippet(matches[1].replace(/\n\t\t/g, '\n').trim() + '\n'));
						}

						_this.set({
							'desc': gist.description.split(' (http')[0],
							'gist': gist
						});

						firebase.child('stats').child(gist.id).child(getGistLastRevisionId(gist)).on('value', function (snapshot) {
							var values = snapshot.val();

							values && _this.setStats(Object.keys(values).map(function (key) {
								return values[key];
							}));
						});
					})
						['catch'](showError)
						.then(resolve);
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
						attrs.setup = restoredData.setup || {code: ''};
						attrs.teardown = restoredData.teardown || {code: ''};
						_this.snippets = restoredData.snippets.map(function (code) {
							return newSnippet(code);
						});
					} catch (err) {}

					resolve();
				}
			})
				['catch'](showError)
				.then(function () {
					if (!Array.isArray(_this.snippets) || !_this.snippets.length) {
						_this.snippets = [newSnippet()];
					}

					// Используется при unload
					_this._latestData = _this.toJSON();
					_this._prevJSONStr = JSON.stringify(_this.toJSON());

					// Cохраняем в `hash` и `localStorage` раз в 1sec
					_this._saveId = setInterval(function () {
						if (!attrs.gist.id) {
							var jsonStr = JSON.stringify(_this.toJSON());

							if (_this._prevJSONStr !== jsonStr) {
								_this._prevJSONStr = jsonStr;

								try {
									//location.hash = encodeURIComponent(jsonStr);
									localStorage.setItem(STORE_SNIPPETS_KEY, jsonStr);
								} catch (err) {}
							}
						}
					}, 1000);

					_this.render();
				});
		},

		setStats: function (values) {
			var stats = {};

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
						stat[i + 1] = (data.hz[i] + stat[i + 1])/2;
					}
				}
			});

			this.set('results', {
				names: this.snippets.map(function (snippet, idx) {
					return '#' + (idx + 1) + ': ' + getName(snippet);
				}),

				series: Object.keys(stats).map(function (name) {
					return stats[name];
				})
			});
		},

		addStat: function (stat) {
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

		toJSON: function () {
			var attrs = this.attrs;

			return {
				desc: attrs.desc,
				setup: {code: attrs.setup.code},
				teardown: {code: attrs.teardown.code},
				snippets: this.snippets.map(function (snippet) {
					return snippet.code;
				})
			};
		},

		handleSuiteAdd: function () {
			this.snippets.push(newSnippet());
			this.render();
		},

		handleSuiteRemove: function (evt) {
			this.snippets.splice(this.snippets.indexOf(evt.details), 1);
			this.render();
		},

		handleSuiteRun: function () {
			var refs = this.refs;
			var _this = this;
			var attrs = _this.attrs;
			var suite = new Benchmark.Suite;
			var index = {};

			this.snippets.forEach(function (snippet) {
				snippet.status = '';
				index[snippet.id] = snippet;

				suite.add(snippet.id, {
					fn: snippet.code.trim(),
					setup: attrs.setup.code,
					teardown: attrs.teardown.code,
					onCycle: function (evt) {
						refs['stats-' + snippet.id].innerHTML = toStringBench(evt.target);
					}
				});
			});

			suite
				.on('cycle', function (evt) {
					var stat = evt.target;
					//var el = refs['stats-' + stat.name];

					!suite.aborted && (refs['stats-' + stat.name].innerHTML = toStringBench(stat));
				})
				.on('complete', function (evt) {
					if (!suite.aborted) {
						var results = evt.currentTarget;

						suite.filter('fastest').forEach(function (stat) {
							index[stat.name].status = 'fastest';
						});

						suite.filter('slowest').forEach(function (stat) {
							index[stat.name].status = 'slowest';
						});

						_this.addStat(results.map(function (bench) {
							return bench.hz;
						}));

						_this.set('running', false);
						_this.refs.scrollTo.style.display = '';
					}
				});

			_this.set('running', true);

			suite.run({'async': true});
			_this._suite = suite;
		},

		handleSuiteSave: function () {
			var _this = this;
			var attrs = _this.attrs;
			var gist = attrs.gist;
			var desc = (attrs.desc || 'Untitled benchmark');
			var suiteCode = [
				'"use strict";',
				'',
				'(function (factory) {',
				'	if (typeof Benchmark !== "undefined") {',
				'		factory(Benchmark);',
				'	} else {',
				'		factory(require("benchmark"));',
				'	}',
				'})(function (Benchmark) {',
				'	var suite = new Benchmark.Suite;',
				'',

				// Setup
				(!attrs.setup.code.trim() ? '' : [
				'	Benchmark.prototype.setup = function () {',
				'		' + attrs.setup.code.trim().split('\n').join('\n\t\t'),
				'	};',
				''
				].join('\n')),

				// Teardown
				(!attrs.teardown.code.trim() ? '' : [
				'	Benchmark.prototype.teardown = function () {',
				'		' + attrs.teardown.code.trim().split('\n').join('\n\t\t'),
				'	};',
				''
				].join('\n')),

				// Snippets
				_this.snippets.map(function (snippet) {
					return [
						'	suite.add(' + JSON.stringify(getName(snippet)) + ', function () {',
						'		' + (snippet.code || '').trim().split('\n').join('\n\t\t'),
						'	});'
					].join('\n');
				}).join('\n\n'),
				'',
				'	suite.on("cycle", function (evt) {',
				'		console.log("  " + evt);',
				'	});',
				'',
				'	suite.on("complete", function (evt) {',
				'		var results = evt.currentTarget.sort(function (a, b) {',
				'			return b.hz - a.hz;',
				'		});',
				'',
				'		results.forEach(function (item) {',
				'			console.log("  " + item);',
				'		});',
				'	});',
				'',
				'	console.log(' + JSON.stringify(desc) + ');',
				'	console.log(new Array(30).join("-"));',
				'	suite.run();',
				'});',
				''
			].join('\n');

			var files = {
				'suite.js': {content: suiteCode},
				'index.html': {content: [
					'<!DOCTYPE html>',
					'<html>',
					'<head>',
					'	<meta charset="utf-8"/>',
					'	<title>' + desc + '</title>',
					'	<script src="https://cdnjs.cloudflare.com/ajax/libs/benchmark/1.0.0/benchmark.min.js"></script>',
					'	<script src="./suite.js"></script>',
					'</head>',
					'<body>',
					'	<h1>Open the console to view the results</h1>',
					'	<h2><code>cmd + alt + j</code> or <code>ctrl + alt + j</code></h2>',
					'</body>',
					'</html>',
					''
				].join('\n')}
			};

			_this.set('saving', true);

			// Запросим пользователя, чтобы быть 100% уверенными в актуальности данных
			github.user()
				.then(function (user) {
					var save = function (gist) {
						var isNew = !gist.id;

						return github.gist.save(gist.id, desc + (isNew ? ' ' : ' (' + location.toString() + ') ') /
								+ GIST_TAGS, files).then(function (gist) {
									_this.set('gist', gist); // (1)
									location.hash = gist.id; // (2)

									swal('Saved', gist.html_url, 'success');

									if (isNew) {
										github.gist.save(gist.id, desc + ' (' + location.toString() + ') ' + GIST_TAGS);
										_this.addStat(_this._latestUnsavedResults);
									}

									return gist;
						});
					};

					// Обновляем текущего юзера
					github.setUser(user);
					_this.set('user', user);

					// А теперь решим, fork или save
					return (gist.id && gist.owner.id !== user.id) ? github.gist.fork(gist.id).then(save) : save(gist);
				})
					['catch'](showError).then(function () {
						_this._latestData = _this.toJSON();
						_this.set('saving', false);
					});
		},

		handleStar: function () {
			this.invert('starred');
			github.gist.star(this.attrs.gist.id, this.attrs.starred);
		},

		handleConfigure: function (evt) {
			evt.details.visible = !evt.details.visible;
			this.render();
		},

		handleScrollTo: function () {
			this.refs.scrollTo.style.display = 'none';
			this.refs.chart.scrollIntoView();
		},

		handleShare: function (evt) {
			var service = evt.details;

			Promise.resolve(
				share[service](this.attrs.desc, location.toString(), GIST_TAGS, this)
			).then(function () {
				swal(service.charAt(0).toUpperCase() + service.substr(1), 'The test results is shared', 'success');
			}, showError);
		}
	});

	//
	// Вспомогательные методы
	//

	function showError(err) {
		var message = (err && err.message || 'Something went wrong');

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

	function formatNumber(number) {
		number = String(number).split('.');

		return number[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',') + (number[1] ? '.' + number[1] : '');
	}

	function getName(snippet) {
		return (snippet.code !== void 0 ? snippet.code : snippet).trim()
				.split('\n')[0].replace(/(^\/[*/]+|\**\/$)/g, '').trim();
	}

	function toStringBench(bench) {
		var error = bench.error,
			hz = bench.hz,
			stats = bench.stats,
			size = stats.sample.length;

		if (error) {
			return error;
		} else {
			return (
				formatNumber(hz.toFixed(hz < 100 ? 2 : 0)) + ' ops/sec<br/>' +
				'\xb1' + stats.rme.toFixed(2) + '%<br/>' +
				'(' + size + ' run' + (size === 1 ? '' : 's') + ' sampled)'
			);
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

	// Init
	OAuth.initialize(OAUTH_PUBLIC_KEY);
	window.app = new UIApp().renderTo(document.getElementById('canvas'));
})(window.feast, window.Benchmark, window.OAuth, window.github, window.share, window.sweetAlert);
