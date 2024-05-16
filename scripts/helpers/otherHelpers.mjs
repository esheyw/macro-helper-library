import { fu } from "../constants.mjs";
import { MHLError, isEmpty, mhlog } from "./errorHelpers.mjs";
import { mhlocalize, prependIndefiniteArticle } from "./stringHelpers.mjs";
import { MHLDialog } from "../classes/MHLDialog.mjs";
import Collection from "../../app/common/utils/collection.mjs";

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
export function isOwnedBy(doc, user) {
  //partially lifted from warpgate
  const corrected = doc instanceof TokenDocument ? doc.actor : doc instanceof Token ? doc.document.actor : doc;
  const userID = user.id ?? user;
  if (corrected.ownership[userID] === 3) return true;
  return false;
}

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
          localize: true,
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
          localize: true,
          func,
          prefix: `MHL.Error.WrongDocumentTypeRetrieved`,
          context: { type: typeof type === "function" ? type.prototype.constructor.name : String(type) },
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

export function isRealGM(user) {
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

export function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(obj);
  return proto === null || proto === Object.prototype;
}

export function getFunctionOptions(inputs, { handlebars = true } = {}) {
  if (!Array.isArray(inputs)) return null;
  const lastInput = inputs.at(-1);
  if (isPlainObject(lastInput)) {
    inputs.splice(-1, 1);
    return handlebars && lastInput?.hash ? lastInput.hash : lastInput;
  }
  return null;
}

export function getStringArgs(inputs, { join = false, split = /\s+/, map = null } = {}) {
  if (!Array.isArray(inputs)) inputs = [inputs];
  inputs = inputs
    .flat(Infinity)
    .filter((i) => !isEmpty(i))
    .map((i) => String(i).trim())
    .flatMap((i) => (split && (typeof split === "string" || split instanceof RegExp) ? i.split(split) : i));
  if (typeof map === "function") inputs = inputs.map(map);
  if (join && typeof join !== "string") join = " ";
  return join ? inputs.join(String(join)) : inputs;
}

export function deeperClone(
  original,
  { strict = false, returnOriginal = true, keepMapKeys = false, keepMapValues = false } = {}
) {
  // Simple types
  if (typeof original !== "object" || original === null) return original;
  const options = { strict, returnOriginal, keepMapKeys, keepMapValues };
  // Arrays
  if (original instanceof Array) return original.map((o) => deeperClone(o, options));
  // Sets
  if (original instanceof Set) {
    const out = new Set();
    for (const element of original) out.add(deeperClone(element, options));
    return out;
  }
  // Maps & Collections
  if (original instanceof Map) {
    const out = new original.constructor();
    for (const [k, v] of original.entries())
      out.set(keepMapKeys ? k : deeperClone(k, options), keepMapValues ? v : deeperClone(v, options));
    return out;
  }
  // Dates
  if (original instanceof Date) return new Date(original);

  // Unsupported advanced objects
  if (original.constructor && original.constructor !== Object) {
    if (strict) throw new Error("deepClone cannot clone advanced objects");
    return returnOriginal ? original : undefined;
  }

  // Other objects
  const clone = {};
  for (let k of Object.keys(original)) {
    clone[k] = deeperClone(original[k], options);
  }
  return clone;
}
// this mostly exists to serve the map -> collection chain
export function mostDerivedClass(c1, c2) {
  const func = `mostDerivedClass`;
  if (typeof c1 !== "function") c1 = c1.constructor ?? null;
  if (typeof c2 !== "function") c2 = c2.constructor ?? null;
  if (typeof c1 !== "function" || typeof c2 !== "function")
    throw MHLError(`MHL.Error.BothMustBeClassesOrClassedObjects`, { func });
  if (c1 === c2) return c1;
  const c1list = fu.getParentClasses(c1);
  const c2list = fu.getParentClasses(c2);
  if (c1list.length === 0) {
    if (c2list.length === 0 || !c2list.includes(c1)) return null;
    return c2;
  } else {
    if (!c1list.includes(c2)) return null;
    return c1;
  }
}
// export function mergeObjectExtended2(
//   original,
//   other = {},
//   {
//     insertKeys = true,
//     insertValues = true,
//     overwrite = true,
//     recursive = true,
//     inplace = true,
//     enforceTypes = false,
//     performDeletions = false,
//     arraysUnique = false,
//   } = {},
//   _d = 0
// ) {
//   const func = `mergeObjectExtended`;
//   other = other ?? {}; //check for nullish instead of falsey
//   if (!(original instanceof Object) || !(other instanceof Object)) {
//     throw new Error("One of original or other are not Objects!");
//   }
//   const options = {
//     insertKeys,
//     insertValues,
//     overwrite,
//     recursive,
//     inplace,
//     enforceTypes,
//     performDeletions,
//     arraysUnique,
//   };
//   const originalType = fu.getType(original);
//   const otherType = fu.getType(other);
//   // original and other must either both be plain objects or be in the same inheritance chain
//   let cls;
//   if (isPlainObject(original) !== isPlainObject(other) || !(cls = mostDerivedClass(original, other))) {
//     throw MHLError(`MHL.Error.RequireSameInheritanceChain`, { func });
//   }
// }

// export function mergeObjectExtended(
//   original,
//   other = {},
//   {
//     insertKeys = true,
//     insertValues = true,
//     overwrite = true,
//     recursive = true,
//     inplace = true,
//     enforceTypes = false,
//     performDeletions = false,
//     arraysUnique = false,
//   } = {},
//   _d = 0
// ) {
//   other = other || {};
//   if (!(original instanceof Object) || !(other instanceof Object)) {
//     throw new Error("One of original or other are not Objects!");
//   }
//   const options = {
//     insertKeys,
//     insertValues,
//     overwrite,
//     recursive,
//     inplace,
//     enforceTypes,
//     performDeletions,
//     arraysUnique,
//   };

//   // Special handling at depth 0
//   if (_d === 0) {
//     if (Object.keys(other).some((k) => /\./.test(k))) other = fu.expandObject(other);
//     if (Object.keys(original).some((k) => /\./.test(k))) {
//       const expanded = fu.expandObject(original);
//       if (inplace) {
//         Object.keys(original).forEach((k) => delete original[k]);
//         Object.assign(original, expanded);
//       } else original = expanded;
//     } else if (!inplace) original = deeperClone(original);
//   }

//   // Iterate over the other object
//   for (let k of Object.keys(other)) {
//     const v = other[k];
//     if (original.hasOwnProperty(k)) _mergeUpdate(original, k, v, options, _d + 1);
//     else _mergeInsert(original, k, v, options, _d + 1);
//   }
//   return original;
// }

// /**
//  * A helper function for merging objects when the target key does not exist in the original
//  * @private
//  */
// function _mergeInsert(original, k, v, { insertKeys, insertValues, performDeletions } = {}, _d) {
//   // Delete a key
//   if (k.startsWith("-=") && performDeletions) {
//     delete original[k.slice(2)];
//     return;
//   }

//   const canInsert = (_d <= 1 && insertKeys) || (_d > 1 && insertValues);
//   if (!canInsert) return;

//   // Recursively create simple objects
//   if (isPlainObject(v)) {
//     original[k] = mergeObjectExtended({}, v, { insertKeys: true, inplace: true, performDeletions });
//     return;
//   }

//   // Insert a key
//   original[k] = v;
// }

// /**
//  * A helper function for merging objects when the target key exists in the original
//  * @private
//  */
// export function _mergeUpdate(
//   original,
//   mergeKey,
//   mergeValue,
//   { insertKeys, insertValues, enforceTypes, overwrite, recursive, performDeletions, arraysUnique } = {},
//   _d
// ) {
//   const func = "_mergeUpdate";
//   const originalValue = original[mergeKey];
//   const mergeValueType = fu.getType(mergeValue);
//   const originalValueType = fu.getType(originalValue);
//   const options = { insertKeys, insertValues, enforceTypes, overwrite, recursive, performDeletions, arraysUnique };
//   if (mergeValueType === "Array" && originalValueType === "Array") {
//     for (const element of mergeValue) {
//       // mhlog(
//       //   { element, v, includes: x.includes(element), arraysUnique },
//       //   { type: "warn", func, prefix: "array comp" }
//       // );
//       if (arraysUnique && originalValue.includes(element)) continue;
//       originalValue.push(element);
//     }
//     return;
//   }

//   if (mergeValueType === "Set" && originalValueType === "Set") {
//     for (const element of mergeValue) originalValue.add(element);
//     return;
//   }
//   if (mergeValueType === "Map" && originalValueType === "Map") {
//     mhlog({ x: deeperClone(originalValue), v: deeperClone(mergeValue) }, { type: "warn", prefix: "map compare", func });
//     for (const [mergeMapKey, mergeMapValue] of mergeValue.entries()) {
//       if (originalValue.has(mergeMapKey)) {
//         const originalMapValue = originalValue.get(mergeMapKey);
//         const oMVType = fu.getType(originalMapValue);
//         const mMVType = fu.getType(mergeMapValue);
//         if (mMVType === "Object")
//           mergeObjectExtended(originalMapValue, mergeMapValue, { ...options, inplace: true }, _d);
//       } else {
//         originalValue.set(mergeMapKey, mergeMapValue);
//       }
//       mhlog({ x: deeperClone(originalValue) }, { type: "warn", prefix: "map entry processed", func });
//     }
//   }
//   // Recursively merge an inner object
//   if (mergeValueType === "Object" && originalValueType === "Object" && recursive) {
//     return mergeObjectExtended(originalValue, mergeValue, { ...options, inplace: true }, _d);
//   }

//   // Overwrite an existing value
//   if (overwrite) {
//     if (originalValueType !== "undefined" && mergeValueType !== originalValueType && enforceTypes) {
//       throw new Error(`Mismatched data types encountered during object merge.`);
//     }
//     original[mergeKey] = mergeValue;
//   }
// }
