import { PHYSICAL_ITEM_TYPES } from "../constants.mjs";
import { MHLError, MHLBanner } from "./errorHelpers.mjs";
import { pickAThingDialog } from "./otherHelpers.mjs";
import { prependIndefiniteArticle } from "./stringHelpers.mjs";

export function levelBasedDC(level) {
  const func = "levelBasedDC";
  if (typeof level !== "number") {
    throw MHLError(`MHL.Error.Type.Number`, { context: { var: "level" }, func, log: { level } });
  }
  const DCByLevel = [
    14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50,
  ];
  let DC = 0;
  if (level >= DCByLevel.length || level < -1) {
    mhlog({ level }, { localize: true, prefix: `MHL.Warning.Fallback.LevelOutOfBounds`, func });
    level = 26;
  }
  if (level === -1) {
    DC = 13;
  } else {
    DC = DCByLevel[level];
  }
  return DC;
}

export async function setInitiativeStatistic(actor, statistic = "perception") {
  return await actor.update({
    "system.initiative.statistic": statistic,
  });
}

export async function pickItemFromActor(
  actor,
  { itemType = null, otherFilter = null, held = false, title = null, dialogOptions = {}, errorIfEmpty = true } = {}
) {
  const PREFIX = "MHL.PickItemFromActor";
  let filteredItems = [];

  if (!itemType || itemType === "physical") {
    itemType ??= "physical (default)"; // for error display purposes
    filteredItems = actor.items.filter((i) => PHYSICAL_ITEM_TYPES.includes(i.type)) ?? [];
  } else {
    filteredItems = actor.items.filter((i) => i.type === itemType) ?? [];
  }
  if (!filteredItems.length) {
    if (errorIfEmpty) throw MHLError(`MHL.Error.NoItemsOfType`, { context: { itemType } });
    return null;
  }

  if (otherFilter && typeof otherFilter === "function") {
    filteredItems = filteredItems.filter(otherFilter);
    if (!filteredItems.length) {
      if (errorIfEmpty) throw MHLError(`MHL.Error.FilterUnmatched`, { log: { filter: otherFilter } });
      return null;
    }
  }

  if (held) {
    filteredItems = filteredItems.filter((i) => i.system.equipped.carryType === "held") ?? [];
    if (!filteredItems.length) {
      if (errorIfEmpty) throw MHLError(`MHL.Error.NoMatchingHeld`);
      return null;
    }
  }

  if (filteredItems.length === 1) return filteredItems[0];

  const names = {};
  for (const item of filteredItems) {
    names[item.name] ??= 0;
    names[item.name]++;
  }
  console.warn({ names });
  const things = filteredItems.map((i) => {
    return {
      label: i.name,
      value: i.id,
      img: i.img,
      identifier: names[i.name] > 1 ? i.id : null,
    };
  });
  console.warn({ things });
  title ??= `Select ${prependIndefiniteArticle(itemType)}`.titleCase();

  const response = await pickAThingDialog({ things, title, dialogOptions });
  return actor.items.get(response);
}

// types: [all, action, bestiary, campaignFeature, equipment, feat, hazard, spell] (compendium browser divisions + 'all')
//        if you need to find effects like this, too bad I guess
// fields: document fields required to index for provided filter
// filter: a function that takes one argument, returns bool, for .filter()
// strictSourcing: if true, will suppress documents with missing source information, if false they're let through
// fetch: if true, return full documents instead of the filtered index
export async function getAllFromAllowedPacks({
  type = "equipment",
  fields = [],
  filter = null,
  strictSourcing = true,
  fetch = false,
} = {}) {
  const PREFIX = "MHL.GetAllFromAllowedPacks";
  const func = "getAllFromAllowedPacks: ";
  const browser = game.pf2e.compendiumBrowser;
  const validTypes = Object.keys(browser.settings);
  validTypes.push("all");
  const aliases = {
    actor: "bestiary",
    npc: "bestiary",
    ability: "action",
  };

  const originalType = type;
  if (!validTypes.includes(type) && !validTypes.includes((type = aliases[type] ?? ""))) {
    throw MHLError(`MHL.Error.InvalidType`, { context: { type: originalType }, func });
  }
  if (!Array.isArray(fields) || (fields.length && fields.some((f) => typeof f !== "string"))) {
    throw MHLError(`MHL.Error.FieldsFormat`, { func, log: { fields } });
  }
  if (filter && typeof filter !== "function") {
    throw MHLError(`MHL.Error.Type.Function`, { context: { var: "filter" }, func, log: { filter } });
  }

  //initialize the sources list if it hasn't been set
  if (!Object.keys(browser.packLoader.sourcesSettings.sources).length) {
    await browser.packLoader.updateSources(browser.loadedPacksAll());
  }
  const packList =
    type === "all"
      ? Object.values(browser.settings).flatMap((t) => Object.entries(t))
      : Object.entries(browser.settings[type]);

  const loadablePacks = packList.filter(([_, p]) => p.load).map(([pack]) => pack);
  const unloadablePacks = packList.filter(([_, p]) => !p.load).map(([pack]) => pack);
  const sources = browser.packLoader.sourcesSettings.sources;
  const loadableSources = Object.values(sources)
    .filter((s) => s.load)
    .map((s) =>
      s.name.slugify({
        strict: true,
      })
    );
  fields.push("system.details.publication", "system.publication", "system.source", "system.details.source");

  let out = [];
  const sourceFilter = (d) => {
    const slug = (
      d?.system?.details?.publication?.title ??
      d?.system?.publication?.title ??
      d?.system?.details?.source?.value ??
      d?.system?.source?.value ??
      ""
    ).slugify({
      strict: true,
    });
    if (!slug) return strictSourcing ? false : true;
    return loadableSources.includes(slug);
  };

  for (const packName of loadablePacks) {
    const pack = game.packs.get(packName);
    const initialDocs = await pack.getIndex({
      fields,
    });
    const sourcedDocs = initialDocs.filter(sourceFilter);
    let filteredDocs = [];
    try {
      filteredDocs = filter ? sourcedDocs.filter(filter) : sourcedDocs;
    } catch (error) {
      ui.notifications.error(`Error in provided filter: ${error.toString()}`);
      return null;
    }

    if (fetch) {
      out.push(
        ...(await pack.getDocuments({
          //secret getDocuments query syntax {prop}__in:
          _id__in: filteredDocs.map((d) => d._id),
        }))
      );
    } else {
      out.push(...filteredDocs);
    }
  }
  return out;
}
//TODO: Generalize before marking for export
function generateTraitsFlavour(traits = []) {
  if (!Array.isArray(traits)) {
    throw MHLError(`MHL.Error.Type.Array`, {
      context: { var: "traits", of: localize(`MHL.Error.Type.Of.TraitSlugs`) },
      func: "generateTraitsFlavour: ",
      log: { traits },
    });
  }
  return traits
    .map((tag) => {
      const label = game.i18n.localize(CONFIG.PF2E.actionTraits[tag]);
      const tooltip = CONFIG.PF2E.traitsDescriptions[tag];
      return `<span class="tag" data-trait="${tag}" data-tooltip="${tooltip}">${label}</span>`;
    })
    .join("");
}
