(function (fetch, swal) {
	'use strict';

	var SCREEN_WIDTH = screen.width;
	var SCREEN_HEIGHT = screen.height;

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
		login: function () {
			return this._promise || (this._promise = new Promise(function (resolve, reject) {
				window.fbAsyncInit = function () {
					FB.init({
						appId: facebook.id,
						version: 'v2.5',
						cookie: true,
						oauth: true
					});

					FB.login(function (response) {
						if (response.authResponse) {
							facebook.token = response.authResponse.accessToken;
							resolve(FB);
						} else {
							swal('Oops...', 'Auth fail', 'error');
							reject();
						}
					}, {
						scope: 'publish_actions'
					});
				};

				(function (d, s, id) {
					var js, fjs = d.getElementsByTagName(s)[0];
					if (d.getElementById(id)) {return;}
					js = d.createElement(s);
					js.id = id;
					js.src = "//connect.facebook.net/en_US/sdk.js";
					fjs.parentNode.insertBefore(js, fjs);
				}(document, 'script', 'facebook-jssdk'));
			}));
		}
	};

	// Export
	window.share = {
		twitter: function (desc, url, tags) {
			var top = Math.max(Math.round((SCREEN_HEIGHT / 3) - (twttr.height / 2)), 0);
			var left = Math.round((SCREEN_WIDTH / 2) - (twttr.width / 2));
			var message = desc.substr(0, twttr.length - (url.length + tags.length + 5)) + ': ' + url + ' ' + tags;

			window.open(twttr.url + encodeURIComponent(message), '', 'left=' + left + ',top=' + top + ',width=' + twttr.width + ',height=' + twttr.height + ',personalbar=0,toolbar=0,scrollbars=1,resizable=1');
		},

		facebook: function (desc, url, tags, app) {
			var el = document.createElement('div');
			var chart = new UIChart({
				data: app.get('results'),
				mode: 'fit'
			});

			el.className = 'invisible';
			el.style.width = facebook.width + 'px';
			el.style.height = facebook.height + 'px';

			document.body.appendChild(el);
			chart.renderTo(el);

			return new Promise(function (resolve) {
				setTimeout(function () {
					var dataURI = chart.toDataURI();

					chart.destroy();
					document.body.removeChild(el);

					resolve(dataURLtoBlob(dataURI));
				}, 300);
			}).then(function (file) {
				return facebook.login().then(function () {
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
							throw new Error(response.statusText);
						}
					});
				});
			});
		}
	};
})(window.fetch, window.sweetAlert);
