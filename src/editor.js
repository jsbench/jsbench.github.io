(function (feast, ace) {
	'use strict';

	/**
	 * @class UIEditor
	 * @extends feast.Block
	 */
	feast.Block.extend(/** @lends UIEditor# */{
		name: 'editor',
		template: feast.parse('<div bem:mod="{attrs.mode}"/>'),

		didMount: function () {
			var _this = this;
			var editor = _this.editor = ace.edit(_this.el);

			editor.$blockScrolling = Number.POSITIVE_INFINITY;

			editor.setTheme('ace/theme/tomorrow');
			editor.getSession().setMode('ace/mode/javascript');
			editor.setOption('maxLines', _this.attrs['max-lines'] || 30);
			editor.setOption('minLines', _this.attrs['min-lines'] || 4);

			editor.on('change', function () {
				_this.attrs.data.code = editor.getValue();
			});

			editor.setValue(_this.attrs.data.code || '', 1);
			editor.focus();
		},

		didUnmount: function () {
			this.editor.destroy();
		}
	});
})(window.feast, window.ace);
