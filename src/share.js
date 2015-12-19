export default (function share(fetch) {
	'use strict';

	const SCREEN_WIDTH = screen.width;
	const SCREEN_HEIGHT = screen.height;

	const twttr = {
		url: 'https://twitter.com/intent/tweet?text=',
		length: 140,
		width: 550,
		height: 250
	};

	const facebook = {
		id: '900218293360254',
		publishUrl: 'https://graph.facebook.com/me/photos',
		width: 1200,
		height: 630,

		init() {
			return this._promiseInit || (this._promiseInit = new Promise((resolve) => {
				window.fbAsyncInit = function fbAsyncInit() {
					const FB = window.FB;

					FB.init({
						appId: facebook.id,
						version: 'v2.5',
						cookie: true,
						oauth: true
					});

					facebook.api = FB;
					resolve(FB);
				};

				(function loadFacebook(d, s, id) {
					const fjs = d.getElementsByTagName(s)[0];
					let js;
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

		login() {
			return this._promiseLogin || (this._promiseLogin = this.init().then((api) => new Promise((resolve, reject) => {
				api.login((response) => {
					if (response.authResponse) {
						facebook.token = response.authResponse.accessToken;
						resolve();
					} else {
						reject(new Error('Access denied'));
					}
				}, {
					scope: 'publish_actions'
				});
			})
			));
		}
	};

	// todo: Вынести в утилиты
	function generateChartsAsBlob(app, width, height) {
		return new Promise((resolve) => {
			const el = document.createElement('div');
			const chart = new UIChart({
				data: app.get('results'),
				mode: 'fit'
			});

			el.className = 'invisible';
			el.style.width = width + 'px';
			el.style.height = height + 'px';

			chart.on('ready', () => {
				const dataURI = chart.toDataURI();

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
		twitter(desc, url, tags) {
			const top = Math.max(Math.round((SCREEN_HEIGHT / 3) - (twttr.height / 2)), 0);
			const left = Math.round((SCREEN_WIDTH / 2) - (twttr.width / 2));
			const message = desc.substr(0, twttr.length - (url.length + tags.length + 5)) + ': ' + url + ' ' + tags;
			const params = 'left=' + left + ',top=' + top + ',width=' + twttr.width + ',height=' + twttr.height;
			const extras = ',personalbar=0,toolbar=0,scrollbars=1,resizable=1';

			window.open(twttr.url + encodeURIComponent(message), '', params + extras);
		},

		facebook(desc, url, tags, app) {
			return Promise.all([
				facebook.login(),
				generateChartsAsBlob(app, facebook.width, facebook.height)
			])
				.then((results) => {
					const file = results[1];
					const formData = new FormData();

					formData.append('access_token', facebook.token);
					formData.append('source', file);
					formData.append('message', desc + '\n' + url + '\n' + tags);

					return fetch(facebook.publishUrl, {
						method: 'post',
						mode: 'cors',
						body: formData
					}).then((response) => {
						if (response.status >= 200 && response.status < 300) {
							return response;
						} else {
							return response.json().then((json) => {
								throw new Error(json.error.message);
							});
						}
					});
				});
		},

		init() {
			facebook.init();
		}
	};
})(window.fetch);
