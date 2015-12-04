export default (function btn(feast) {
	'use strict';

	/**
	 * @class UIBtn
	 * @extends feast.Block
	 */
	feast.Block.extend(/** @lends UIBtn# */{
		name: 'btn',
		template: feast.parse(document.getElementById('btn-template').textContent),

		defaults: {
			mod: 'primary',
			disabled: false
		}
	});
})(window.feast);
