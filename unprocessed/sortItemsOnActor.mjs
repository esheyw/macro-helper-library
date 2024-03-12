const items = token.actor.items.contents
//    .filter(o => o.type === "action")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((i, x) => ({ _id: i.id, sort: 112500 + x*15 }));
await token.actor.updateEmbeddedDocuments("Item", items);