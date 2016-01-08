export default (function chart(feast, google) {
	'use strict';

	/**
	 * @class UIChart
	 * @extends feast.Block
	 */
	const UIChart = feast.Block.extend(/** @lends UIChart# */{
		name: 'chart',
		template: feast.parse('<div/>'),

		attrChanged: {
			data() {
				this.visualization && this.redraw();
			}
		},

		didMount() {
			google.load('visualization', '1', {
				packages: ['corechart', 'bar'],
				callback: () => {
					// uglyfix for https://github.com/google/google-visualization-issues/issues/2070
					try {
						window.requirejs([]);
					} catch (err) {}

					this.visualization = true;
					this.redraw();
				}
			});
		},

		redraw() {
			const data = this.attrs.data;

			if (google.visualization && data) {
				if (!this.chart) {
					this.chart = new google.visualization.BarChart(this.el);

					google.visualization.events.addListener(this.chart, 'ready', () => {
						this.broadcast('ready');
					});
				}

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
							width: '60%',
							height: '95%'
						},
						backgroundColor: {
							fill: 'transparent'
						},
						legend: {
							position: 'right',
							alignment: 'center'
						}
					}
				);
			}
		},

		toDataURI() {
			return this.chart.getImageURI();
		}
	});

	// Export
	window.UIChart = UIChart;
})(window.feast, window.google);
