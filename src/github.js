export default (function github(OAuth, swal) {
	'use strict';

	const API_ENDPOINT  = 'https://api.github.com/';
	const API_STATUS_OK = 200;

	const STORE_USER_KEY = 'jsbench-gihub-user';
	const STORE_STARS_KEY = 'jsbench-gihub-stars';

	let _api;
	let _user;
	let _stars = {};
	const _gists = {};

	function _getApi() {
		if (!_api) {
			_api = new Promise((resolve, reject) => {
				OAuth.popup('github', {cache: true}).done(resolve).fail((err) => {
					if (err.toString().indexOf('popup')) {
						swal({
							title: 'Oops, required authorization!',
							type: 'warning',
							showCancelButton: true,
							confirmButtonColor: '#A5DC86',
							confirmButtonText: 'Sign in with GitHub',
							cancelButtonText: 'Cancel'
						}, (isConfirm) => {
							if (isConfirm) {
								OAuth.popup('github', {cache: true}).done(resolve).fail(reject);
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
		return _getApi().then((api) => api[type](method, {data: JSON.stringify(data)}));
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

		setUser(user) {
			this.currentUser = user;
			_store(STORE_USER_KEY, user);
		},

		user(login) {
			return _user || _call('get', 'user' + (login ? '/' + login : '')).then((user) => {
				!login && github.setUser(user);
				return user;
			});
		},

		gist: {
			findOne(id) {
				let promise;
				const url = 'gists/' + id;
				const _fetch = () => fetch(API_ENDPOINT + url).then((res) => {
					if (res.status !== API_STATUS_OK) {
						throw 'Error: ' + res.status;
					}

					return res.json();
				});

				if (_gists[id]) { // Cache
					promise = Promise.resolve(_gists[id]);
				} else if (github.currentUser) {
					promise = _call('get', url)['catch'](() => {
						github.setUser(null);
						return _fetch();
					});
				} else {
					promise = _fetch()['catch'](() => _call('get', url));
				}

				return promise.then((gist) => {
					_gists[gist.id] = gist;
					return gist;
				});
			},

			save(id, desc, files) {
				const gist = _gists[id];
				let changed;

				if (gist && gist.description === desc && Object.keys(gist.files).length === Object.keys(files).length) {
					changed = Object.keys(gist.files).filter((name) => !files[name] || files[name].content !== gist.files[name].content);

					if (!changed.length) {
						return Promise.resolve(gist);
					}
				}

				return _call(id ? 'patch' : 'post', 'gists' + (id ? '/' + id : ''), {
					'public': true,
					'description': desc,
					'files': files
				}).then((gist) => {
					_gists[gist.id] = gist;
					return gist;
				});
			},

			fork(id) {
				return _call('post', 'gists/' + id + '/fork');
			},

			star(id, state) {
				return _call(state ? 'put' : 'del', 'gists/' + id + '/star').then(() => {
					_stars[id] = state;
					_store(STORE_STARS_KEY, _stars);
					return state;
				});
			},

			checkStar(id) {
				if (typeof _stars[id] === 'undefined') {
					return _call('get', 'gists/' + id + '/star')
						.then(() => { _stars[id] = true; }, () => { _stars[id] = false; })
						.then(() => {
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
	window.github.setUser(_store(STORE_USER_KEY));
})(window.OAuth, window.sweetAlert);
