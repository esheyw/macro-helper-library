export async function searchCompendiaForRule(needle = "TokenLight", all = false) {
  let items = [];
  const mh = game.pf2emh.helpers;
  if (all) {
    for (const p of game.packs) {
      if (p.metadata.type !== "Item") continue;
      const content = await p.getDocuments();
      for (item of content) {
        if (item.type !== "equipment") continue;
        if (item.system?.rules?.filter((i) => i.key === needle).length) items.push(item);
      }
    }
  } else {
    items = await mh.getAllFromAllowedPacks({
      fields: ["system.rules"],
      filter: (i) => i.system.rules?.length && i.system.rules.find((r) => r.key === needle),
      fetch: true,
    });
  }
  return items;
}
