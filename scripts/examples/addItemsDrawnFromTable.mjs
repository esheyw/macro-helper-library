if (canvas.tokens.controlled.length > 1) return ui.notifications.error("Please select only a single token.");
if (!actor) return;


const tableID = 'SWaxTTQqm6astJQd' //replace with your table's
const table = game.tables.get(tableID);
const draw = (await table.draw({displayChat: false})).results[0];
console.warn(draw)
// return;
let item;
if (draw.documentCollection === 'Item') {
  item = game.items.get(draw.documentId);
} else {
  item = await fromUuid(`Compendium.${draw.documentCollection}.Item.${draw.documentId}`);
}
await actor.createEmbeddedDocuments('Item', [item.toObject()]);