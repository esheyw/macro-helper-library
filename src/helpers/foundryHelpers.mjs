import { MHLDialog } from "../apps/MHLDialog.mjs";
import { fu } from "../constants.mjs";
import { MHLError, mhlog } from "./errorHelpers.mjs";
import { prependIndefiniteArticle } from "./stringHelpers.mjs";

export function doc(input, type = null, { parent = null, returnIndex = false, async = false } = {}) {
  const func = `doc`;
  let document;
  if (type === true) async = true; // kinda gross?
  if (typeof type === "string") type = getDocumentClass(type);
  const requireType = (type) => {
    if (typeof type !== "function" || !(type.prototype instanceof foundry.abstract.DataModel)) {
      mhlog(
        { input, type, parent },
        {
          func,
          prefix: `MHL.Error.NotADocumentType`,
          context: { type: typeof type === "function" ? type.prototype.constructor.name : String(type) },
        }
      );
      return false;
    }
    return true;
  };
  const wrongType = (checkedDoc, type) => {
    if (!(checkedDoc instanceof type)) {
      mhlog(
        { input, type, parent },
        {
          func,
          prefix: `MHL.Error.WrongDocumentTypeRetrieved`,
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
    if (!root) throw MHLError("MHL.Error.Type.Folder", { context: { arg: "root" }, func: "getIDsFromFolder" });
  }
  return root.contents.concat(root.getSubfolders(true).flatMap((f) => f.contents)).map((c) => c.id);
}

export function isOwnedBy(document, user) {
  //partially lifted from warpgate
  const corrected = document instanceof TokenDocument ? document.actor : document instanceof Token ? document.document.actor : document;
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

export function getModelDefaults(model) {
  const func = `getModelDefaults`;
  if (!(model.prototype instanceof foundry.abstract.DataModel)) {
    mhlog({ model }, { func, prefix: "MHL.Error.Type.DataModel", context: { arg: "model" } });
    return {};
  }
  return Object.entries(model.defineSchema()).reduce((acc, [key, field]) => {
    let initialValue;
    if (typeof field.initial === "function") {
      try {
        initialValue = field.initial();
      } catch (e) {
        mhlog({ e }, { type: 'error', func, prefix: "MHL.Error.DataModel.InitialFunctionFailure", context: { field: key } });
        initialValue = undefined;
      }
    } else {
      initialValue = field.initial;
    }
    acc[key] = initialValue;
    return acc;
  }, {});
}
export async function pickAThingDialog({ things = null, title = null, thingType = "Item", dialogOptions = {} } = {}) {
  if (!Array.isArray(things)) {
    throw MHLError(`MHL.PickAThing.Error.ThingsFormat`);
  }
  const buttons = things.reduce((acc, curr) => {
    let buttonLabel = ``;
    if (!("label" in curr && "value" in curr)) {
      throw MHLError(`MHL.PickAThing.Error.MalformedThing`, { log: { badthing: curr } });
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
