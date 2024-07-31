import { MHLDialog } from "../apps/MHLDialog.mjs";
import { fu } from "../constants.mjs";
import { mhlError } from "./errorHelpers.mjs";
import { prependIndefiniteArticle } from "./stringHelpers.mjs";
import * as R from "remeda";

export function foundryLightOrDarkTheme() {
  const clientSetting = game.settings.get("core", "colorScheme");
  if (clientSetting) return clientSetting;
  // clientSetting === "" means use browser/os preference
  else if (matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function doc(input, type = null, { parent = null, returnIndex = false, async = false } = {}) {
  //todo: find better solution for sync vs non-sync calls
  const func = `doc`;
  let document;
  if (type === true) async = true; // kinda gross?
  if (typeof type === "string") type = getDocumentClass(type);
  const requireType = (type) => {
    if (typeof type !== "function" || !(type.prototype instanceof foundry.abstract.Document)) {
      mhlError(
        { input, type, parent },
        {
          func,
          text: `MHL.Error.NotADocumentType`,
          context: { type: typeof type === "function" ? type.prototype.constructor.name : String(type) },
        }
      );
      return false;
    }
    return true;
  };
  const wrongType = (checkedDoc, type) => {
    if (!(checkedDoc instanceof type)) {
      mhlError(
        { input, type, parent },
        {
          func,
          text: `MHL.Error.WrongDocumentTypeRetrieved`,
          context: { type: typeof type === "function" ? type.name : String(type) },
        }
      );
      return true;
    }
    return false;
  };
  if (typeof input === "string") {
    const parsed = fu.parseUuid(input, { relative: parent });
    if (parsed?.collection instanceof CompendiumCollection) {
      const cached = parsed.collection.contents.find((d) => d._id === parsed.documentId);
      if (cached) {
        if (parsed.embedded.length) {
          return doc("." + input.split(".").slice(5).join("."), type, { parent: cached });
        }
        if (type && wrongType(cached, type)) return undefined;
        return cached;
      }
      if (async) return fromUuid(input);
      if (returnIndex && !parsed.embedded.length) return parsed.collection.index.get(parsed.documentId);
      return undefined;
    } else if (parsed?.collection instanceof WorldCollection) {
      document = fromUuidSync(input);
      if (type && wrongType(document, type)) return undefined;
      return document;
    } else if (parsed?.doc) {
      document = parsed.doc;
      for (let i = 0; i < parsed.embedded.length; i += 2) {
        document = document[getDocumentClass(parsed.embedded[i]).collectionName].get(parsed.embedded[i + 1]);
      }
      if (type && wrongType(document, type)) return undefined;
      return document;
    } else {
      if (!requireType(type)) return undefined;
      const collection = (parent ?? game)[type.collectionName];
      document = collection.get(input) ?? collection.getName(input);
    }
  }
  if (!requireType(type)) return undefined;
  document ??= input;
  return document instanceof type ? document : undefined;
}

//root: root folder of the structure to update
//exemplar: document to copy ownership structure of
export async function applyOwnshipToFolderStructure(root, exemplar) {
  //todo: allow non-nested object as exemplar
  const ids = getIDsFromFolder(root); // handles type checking of root
  const updates = ids.map((id) => fu.flattenObject({ _id: id, ownership: exemplar.ownership }));
  const dc = CONFIG[root.type].documentClass;
  console.warn({ dc, root });
  await dc.updateDocuments(updates);
}
// flat list of all document IDs under a given folder structure

export function getIDsFromFolder(root) {
  if (!(root instanceof Folder)) {
    if (typeof root === "string") root = game.folders.get(root);
    if (!root) throw mhlError("MHL.Error.Type.Folder", { context: { arg: "root" }, func: "getIDsFromFolder" });
  }
  //todo: handle folders of compendia (https://github.com/foundryvtt/foundryvtt/issues/11292)
  return root.contents.concat(root.getSubfolders(true).flatMap((f) => f.contents)).map((c) => c.id);
}

export function isOwnedBy(document, user) {
  //partially lifted from warpgate
  const corrected =
    document instanceof TokenDocument ? document.actor : document instanceof Token ? document.document.actor : document;
  const userID = doc(user, "User")?.id;
  if (corrected.ownership[userID] === 3) return true;
  return false;
}

export function isRealGM(user = game.user) {
  user = doc(user, User);
  if (!user) return false;
  return user.role === CONST.USER_ROLES.GAMEMASTER;
}

export function activeRealGM() {
  const activeRealGMs = game.users.filter((u) => u.active && isRealGM(u));
  activeRealGMs.sort((a, b) => (a.id > b.id ? 1 : -1));
  return activeRealGMs[0] || null;
}

export async function pickAThingDialog({ things = null, title = null, thingType = "Item", dialogOptions = {} } = {}) {
  if (!Array.isArray(things)) {
    throw mhlError(`MHL.PickAThing.Error.ThingsFormat`);
  }
  const buttons = things.reduce((acc, curr) => {
    let buttonLabel = ``;
    if (!("label" in curr && "value" in curr)) {
      throw mhlError({ badthing: curr }, { text: `MHL.PickAThing.Error.MalformedThing` });
    }
    if (curr?.img) {
      buttonLabel += `<img src="${curr.img}" alt="${curr.label}" data-tooltip="${curr?.indentifier ?? curr.label}" />`;
    }
    buttonLabel += `<span class="item-name">${curr.label}</span>`;
    if (curr?.identifier) {
      buttonLabel += `<span class="dupe-id">(${curr.identifier})</span>`;
    }
    acc[curr.value] = { label: buttonLabel };
    return acc;
  }, {});
  dialogOptions.classes ??= [];
  dialogOptions.classes.push("pick-a-thing");
  const dialogData = {
    title: title ?? `Pick ${prependIndefiniteArticle(thingType.capitalize() ?? "Thing")}`,
    buttons,
    close: () => false,
  };
  return await MHLDialog.wait(dialogData, dialogOptions);
}

/**
 * Unset all settings for a given module in both the world and current browser
 *
 * @export
 * @param {string|foundry.packages.BaseModule} modID The module ID (or module instance) to unset settings for
 * @param {object} [options]
 * @param {boolean} [options.client=true] Whether to unset client settings in the browser running this function
 * @param {boolean} [options.world=true] Whether to unset world settings
 * @returns {{client: number, world: number}} The number of settings unset for each type
 */
export function unsetModuleSettings(modID, { client = true, world = true, fcs = false } = {}) {
  if (modID instanceof foundry.packages.BaseModule) {
    modID = modID.id;
  }
  const out = {
    client: 0,
    world: 0,
  };
  if (client) {
    const clientStorage = game.settings.storage.get("client");
    for (const clientKey of Object.keys(clientStorage)) {
      if (clientKey.startsWith(modID)) {
        out.client++;
        clientStorage.removeItem(clientKey);
      }
    }
  }
  if (world) {
    const worldStorage = game.settings.storage.get("world");
    for (const worldSetting of worldStorage) {
      if (worldSetting.key.startsWith(modID)) {
        out.world++;
        worldSetting.delete();
      }
    }
  }
  //TODO: add FCS reset support
  return out;
}

export function getCSSVarsFromFoundryByScope(vars) {
  if (!R.isPlainObject(vars)) return vars;
  const out = {};
  const href = `${document.location.origin}/css/style.css`;
  const sheet = Array.from(document.styleSheets).find((sheet) => /^(?:(?!modules\/|systems\/).)*css\/style.css$/.test(sheet.href));
  const rules = Array.from(sheet.cssRules).filter((rule) => rule instanceof CSSStyleRule);
  for (const [scope, props] of Object.entries(vars)) {    
    const rule = rules.find(r => r.selectorText === scope);
    if (!rule || !Array.isArray(props)) continue;    
    out[scope] = {}    
    for (const key of props) {
      out[scope][key] = rule.style.getPropertyValue(key)
    }
  }
  return out;
}
