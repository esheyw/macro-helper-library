/**
 * Compendium Savings
 *
 * Displays how much data actors/items use on world load currently
 *   and how much they'd use if they were in compendiums.
 */
export default async function compendiumSavings() {
	const countTrueSize = (arr) => arr.reduce((t, i) => t + JSON.stringify(i.toObject()).length, 0);
	const countIndexSize = (arr) => arr.reduce((t, i) => {
		const { _id, name, type, img } = i.toObject();
		return t + JSON.stringify({ _id, name, type, img }).length;
	}, 0);

	const maxPrecision = (num, decimalPlaces = 0, type = 'round') => {
		const p = Math.pow(10, decimalPlaces || 0),
			n = num * p * (1 + Number.EPSILON);
		return Math[type](n) / p;
	}

	const templateData = {
		items: {
			unpacked: maxPrecision(countTrueSize(game.items) / 1000, 2),
			packed: maxPrecision(countIndexSize(game.items) / 1000, 2),
			get ratio() {
				return this.packed / this.unpacked;
			},
			get savings() {
				return maxPrecision(1 - this.ratio, 3) * 100;
			}
		},
		actors: {
			unpacked: maxPrecision(countTrueSize(game.actors) / 1000, 2),
			packed: maxPrecision(countIndexSize(game.actors) / 1000, 2),
			get ratio() {
				return this.packed / this.unpacked;
			},
			get savings() {
				return maxPrecision(1 - this.ratio, 3) * 100;
			}
		}
	};

	const template = `
	<div style="display:grid;grid-template-columns:5fr 2fr 2fr 2fr;gap:0.2rem;white-space:nowrap;">
	<h3>Category</h3><h3>Unpacked (kB)</h3><h3>Packed (kB)</h3><h3>Savings</h3>
	<label>Items</label><span style='justify-self:right;'>{{items.unpacked}}</span><span style='justify-self:right;'>{{items.packed}}</span><span style='justify-self:right;'>{{items.savings}}%</span>
	<label>Actors</label><span style='justify-self:right;'>{{actors.unpacked}}</span><span style='justify-self:right;'>{{actors.packed}}</span><span style='justify-self:right;'>{{actors.savings}}%</span>
	</div>
	<hr>
	`;

	const compiled = Handlebars.compile(template);
	Dialog.prompt({
		title: 'Compendium Savings',
		content: compiled(templateData, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }),
	});
}