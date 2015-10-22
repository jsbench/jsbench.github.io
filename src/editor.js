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
			var editor = this.editor = ace.edit(this.el);

			editor.$blockScrolling = Number.POSITIVE_INFINITY;

			editor.setTheme('ace/theme/tomorrow');
			editor.getSession().setMode('ace/mode/javascript');
			editor.setOption('maxLines', 30);
			editor.setOption('minLines', 4);

			editor.on('change', function () {
				_this.attrs.data.code = editor.getValue();
			});

			editor.setValue(this.attrs.data.code, 1);
			editor.focus();
		},

		didUnmount: function () {
			this.editor.destroy();
		}
	});
})(window.feast, window.ace);
