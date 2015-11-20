(function (OAuth) {
	'use strict';

	var API_ENDPOINT  = 'https://api.github.com/';
	var STORE_USER_KEY = 'jsbench-gihub-user';
	var STORE_STARS_KEY = 'jsbench-gihub-stars';

	var _api;
	var _user;
	var _gists = {};
	var _stars = {};

	function _getApi() {
		if (!_api) {
			_api = new Promise(function (resolve, reject) {
				OAuth.popup('github', {cache: true}).done(resolve).fail(reject);
			});
		}

		return _api;
	}

	function _call(type, method, data) {
		return _getApi().then(function (api) {
			return api[type](method, {data: JSON.stringify(data)});
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

		setUser: function (user) {
			this.currentUser = user;
			_store(STORE_USER_KEY, user);
		},

		user: function (login) {
			return _user || _call('get', 'user' + (login ? '/' + login : '')).then(function (user) {
				!login && github.setUser(user);
				return user;
			});
		},

		gist: {
			findOne: function (id) {
				var url = 'gists/' + id;
				var promise;
				var _fetch = function () {
					return fetch(API_ENDPOINT + url).then(function (res) {
						if (res.status != 200) {
							throw 'Error: ' + res.status;
						}

						return res.json();
					});
				};

				if (_gists[id]) { // Cache
					promise = Promise.resolve(_gists[id]);
				}
				else if (github.currentUser) {
					promise = _call('get', url)['catch'](function () {
						github.setUser(null);
						return _fetch();
					});
				}
				else {
					promise = _fetch()['catch'](function () {
						return _call('get', url);
					});
				}

				return promise.then(function (gist) {
					_gists[gist.id] = gist;
					return gist;
				});
			},

			save: function (id, desc, files) {
				var gist = _gists[id];

				if (gist && gist.description === desc && Object.keys(gist.files).length === Object.keys(files).length) {
					var changed = Object.keys(gist.files).filter(function (name) {
						return !files[name] || files[name].content != gist.files[name].content;
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

			fork: function (id) {
				return _call('post', 'gists/' + id + '/fork');
			},

			star: function (id, state) {
				return _call(state ? 'put' : 'del', 'gists/' + id + '/star').then(function () {
					_stars[id] = state;
					_store(STORE_STARS_KEY, _stars);
					return state;
				});
			},

			checkStar: function (id) {
				if (_stars[id] === void 0) {
					return _call('get', 'gists/' + id + '/star')
						.then(function () {_stars[id] = true;}, function () {_stars[id] = false;})
						.then(function () {
							_store(STORE_STARS_KEY, _stars);
							return _stars[id];
						})
					;
				} else {
					return Promise.resolve(_stars[id]);
				}
			}
		}
	};

	_stars = _store(STORE_STARS_KEY) || {};
	github.setUser(_store(STORE_USER_KEY));
})(window.OAuth);
