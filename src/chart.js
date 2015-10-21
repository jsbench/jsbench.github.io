(function (feast, google) {
	'use strict';

	/**
	 * @class UIBtn
	 * @extends feast.Block
	 */
	feast.Block.extend(/** @lends UIBtn# */{
		name: 'chart',
		template: feast.parse('<div/>'),

		attrChanged: {
			'data': function () {
				this.redraw();
			}
		},

		didMount: function () {
			google.load('visualization', '1', {
				packages: ['corechart', 'bar'],
				callback: this.redraw.bind(this)
			});
		},

		redraw: function () {
			var data = this.attrs.data;

			if (google.visualization && data) {
				this.chart = this.chart || new google.visualization.BarChart(this.el);

				this.chart.draw(
					// Data
					google.visualization.arrayToDataTable([
						['Platform'].concat(data.names)
					].concat(data.series)),

					// Options
					{
						chartArea: {
							top: 0,
							left: '20%',
							width: '65%',
							height: '95%'
						},
						backgroundColor: {
							fill: 'transparent'
						}
					}
				);
			}
		}
	});
})(window.feast, window.google);
