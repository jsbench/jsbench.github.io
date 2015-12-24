export default (function editor(feast) {
	'use strict';

	/**
	 * @class UIEditor
	 * @extends feast.Block
	 */
	feast.Block.extend(/** @lends UIEditor# */{
		name: 'editor',
		template: feast.parse('<div bem:mod="{attrs.mode}"/>'),

		didMount() {
			requirejs(['ace/ace'], (ace) => {
				try {
					const editor = this.editor = ace.edit(this.el);

					editor.$blockScrolling = Number.POSITIVE_INFINITY;

					editor.setTheme('ace/theme/tomorrow');
					editor.getSession().setMode('ace/mode/javascript');
					editor.setOption('maxLines', this.attrs['max-lines'] || 30);
					editor.setOption('minLines', this.attrs['min-lines'] || 4);

					editor.on('change', () => {
						this.attrs.data.code = editor.getValue().trim();
					});

					editor.setValue(this.attrs.data.code || '', 1);
					editor.focus();
				} catch (err) {
					console.warn('[Ace.error]', err);
				}
			});
		},

		didUnmount() {
			this.editor && this.editor.destroy();
		}
	});
})(window.feast);
