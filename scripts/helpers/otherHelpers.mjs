import { fu } from "../constants.mjs";
import { MHLError } from "./errorHelpers.mjs";

export async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export function getStringArgs(inputs, { join = null, split = /\s+/, map = null } = {}) {
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

// taken from https://stackoverflow.com/a/32728075, slightly modernized to handle Maps, Collections, and Sets
/**
 * Checks if value is empty. Deep-checks arrays and objects
 * Note: isEmpty([]) == true, isEmpty({}) == true, isEmpty([{0:false},"",0]) == true, isEmpty({0:1}) == false
 * @param value
 * @returns {boolean}
 */

export function isEmpty(value) {
  const isEmptyObject = (a) => {
    a = a?.constructor?.name === "Map" ? new Collection(a) : a;
    // all have a .some() in foundry at least
    if (Array.isArray(a) || a instanceof Collection || a instanceof Set) {
      return !a.some((e) => !isEmpty(e));
    }
    // it's an Object, not an Array, Set, Map, or Collection
    const hasNonempty = Object.keys(a).some((e) => !isEmpty(a[e]));
    return hasNonempty ? false : isEmptyObject(Object.keys(a));
  };
  return (
    value == false ||
    typeof value === "undefined" ||
    value == null ||
    (typeof value === "object" && isEmptyObject(value))
  );
}

export function getInvalidKeys(source, valid = []) {
  const validKeys = new Set(Array.isArray(valid) ? valid : isPlainObject(valid) ? Object.keys(valid) : []);
  if (isPlainObject(source)) {
    return [...new Set(Object.keys(source)).difference(validKeys)];
  }
  return [];
}

export function generateSorterFromOrder(order) {
  if (!Array.isArray(order)) order = [order];
  order = [...new Set(...order)];
  return (a, b) => {
    const aIdx = order.indexOf(a);
    const bIdx = order.indexOf(b);
    if (aIdx === -1) {
      // a not in order, b is, b goes first
      if (bIdx > -1) return 1;
      // neither in order, so existing order is fine
      return 0;
    } else {
      // both in the order list
      if (bIdx > -1) return aIdx - bIdx;
      // a in order, b isn't, a goes first
      return -1;
    }
  };
}

export function filterObject(source, template, {recursive= true, deletionKeys=false, templateValues=false}={}) {
  // Validate input
  const ts = fu.getType(source);
  const tt = fu.getType(template);
  //todo: localize error
  if ( (ts !== "Object") || (tt !== "Object")) throw new Error("One of source or template are not Objects!");

  // Define recursive filtering function
  const _filter = function(s, t, filtered, recursive) {
    for ( let [k, v] of Object.entries(s) ) {
      let has = t.hasOwnProperty(k);
      let x = t[k];

      // Case 1 - inner object
      if ( has && (fu.getType(v) === "Object") && (fu.getType(x) === "Object") ) {
        filtered[k] = recursive ? _filter(v, x, {}) : v;
      }

      // Case 2 - inner key
      else if ( has ) {
        filtered[k] = templateValues ? x : v;
      }

      // Case 3 - special key
      else if ( deletionKeys && k.startsWith("-=") ) {
        filtered[k] = v;
      }
    }
    return filtered;
  };

  // Begin filtering at the outer-most layer
  return _filter(source, template, {}, recursive);
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
