(function (fetch) {
	'use strict';

	var SCREEN_WIDTH = screen.width;
	var SCREEN_HEIGHT = screen.height;

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

	var twttr = {
		url: 'https://twitter.com/intent/tweet?text=',
		length: 140,
		width: 550,
		height: 250
	};

	var facebook = {
		id: '900218293360254',
		publishUrl: 'https://graph.facebook.com/me/photos',
		width: 1200,
		height: 630,

		init: function () {
			return this._promiseInit || (this._promiseInit = new Promise(function (resolve) {
				window.fbAsyncInit = function () {
					var FB = window.FB;

					FB.init({
						appId: facebook.id,
						version: 'v2.5',
						cookie: true,
						oauth: true
					});

					facebook.api = FB;
					resolve(FB);
				};

				(function (d, s, id) {
					var js, fjs = d.getElementsByTagName(s)[0];
					if (d.getElementById(id)) {return;}
					js = d.createElement(s);
					js.id = id;
					js.src = '//connect.facebook.net/en_US/sdk.js';
					fjs.parentNode.insertBefore(js, fjs);
				}(document, 'script', 'facebook-jssdk'));
			}));
		},

		login: function () {
			return this._promiseLogin || (this._promiseLogin = this.init().then(function (api) {
				return new Promise(function (resolve, reject) {
					api.login(function (response) {
						if (response.authResponse) {
							facebook.token = response.authResponse.accessToken;
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

	// Export
	window.share = {
		twitter: function (desc, url, tags) {
			var top = Math.max(Math.round((SCREEN_HEIGHT / 3) - (twttr.height / 2)), 0);
			var left = Math.round((SCREEN_WIDTH / 2) - (twttr.width / 2));
			var message = desc.substr(0, twttr.length - (url.length + tags.length + 5)) + ': ' + url + ' ' + tags;
			var params = 'left=' + left + ',top=' + top + ',width=' + twttr.width + ',height=' + twttr.height;
			var extras = ',personalbar=0,toolbar=0,scrollbars=1,resizable=1';

			window.open(twttr.url + encodeURIComponent(message), '', params + extras);
		},

		facebook: function (desc, url, tags, app) {
			return Promise.all([
				facebook.login(),
				generateChartsAsBlob(app, facebook.width, facebook.height)
			])
				.then(function (results) {
					var file = results[1];
					var formData = new FormData();

					formData.append('access_token', facebook.token);
					formData.append('source', file);
					formData.append('message', desc + '\n' + url + '\n' + tags);

					return fetch(facebook.publishUrl, {
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

		init: function () {
			facebook.init();
		}
	};
})(window.fetch);
