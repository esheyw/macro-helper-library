import * as R from "remeda";
import { fu } from "../constants.mjs";
import { deeperClone } from "./otherHelpers.mjs";

/**
 * @typedef {import("../_types.mjs").MHLMergeOptions} MHLMergeOptions
 */

export function merge2(
  items = [],
  {
    insertKeys = true,
    insertValues = true,
    overwrite = true,
    recursive = true,
    inplace = true,
    enforceTypes = false,
    performDeletions = false,
    mergeArrays = true,
    mergeSets = true,
    mergeMaps = false,
    mergeMapKeys = true,
    mergeMapValues = true,
    cloneOptions = {},
  } = {}
) {
  items = isArrayish(items) ? Array.from(items) : [];
  const options = {
    insertKeys,
    insertValues,
    overwrite,
    recursive,
    inplace,
    enforceTypes,
    performDeletions,
    mergeArrays,
    mergeSets,
    mergeMaps,
    mergeMapKeys,
    mergeMapValues,
    cloneOptions,
  };
  if (items.length < 2) throw Error("Must provide at least two items to merge");
  let target = items.shift();
  if (!options.inplace) target = deeperClone(target, cloneOptions)
  if (isArrayish(target)) {
    if (!items.every(i => isArrayish(i))) throw Error("If the first item is iterable or array-like all items must be")
    if (target instanceof Set) {
      let source;
      while (source = items.shift()) {
        
      }
    }
  }
}

function _mergeSets(s1, s2, options) {
  if (options.inplace) {
    for (const element of s2)   s1.add(element)
    
  }

}
/**
 * MHL's merge function, based on appV2's
 * @param {Array<Record<string,unknown>>} objects An array of objects to merge. Merges into objects[0] if `options.inplace = true`, a fresh object otherwise.
 * @param {MHLMergeOptions} options               Options for changing the behaviour of `merge`. Extends Foundry's mergeObject options.
 * @param {number} _d                             Internal depth counter
 * @return {Record<string,unknown>}               The merged object
 */
export function merge(
  objects = [],
  {
    insertKeys = true,
    insertValues = true,
    overwrite = true,
    recursive = true,
    inplace = true,
    enforceTypes = false,
    performDeletions = false,
    mergeArrays = true,
    mergeSets = true,
    mergeMapKeys = true,
    mergeMapValues = true,
    cloneOptions = {},
  } = {}
) {
  objects = Array.isArray(objects) ? objects : isArrayish(objects) ? Array.from(objects) : [];
  if (objects.length < 2) {
    throw new Error("Must provide at least two objects to merge");
  }
  if (!isSingleType(objects)) {
    throw new Error(" Provided objects must all be the same type");
  }
  const options = {
    insertKeys,
    insertValues,
    overwrite,
    recursive,
    inplace,
    enforceTypes,
    performDeletions,
    mergeArrays,
    mergeSets,
    mergeMaps,
    mergeMapKeys,
    mergeMapValues,
    cloneOptions,
  };
  const target = options.inplace ? expandInPlace(objects.shift()) : {};
  let source;
  while ((source = objects.shift())) _merge(target, source, options, 0);
  return target;
}

function _merge(target, source, options, depth) {
  if (depth === 0) {
    if (Object.keys(source).some((k) => k.includes("."))) source = fu.expandObject(source);
    if (Object.keys(target).some((k) => k.includes("."))) {
      if (options.inplace) expandInPlace(target);
      else target = fu.expandObject(target);
    } else {
      if (!options.inplace) target = deeperClone(target, options.cloneOptions);
    }
  }

  const targetType = fu.getType(target);
  const sourceType = fu.getType(source);
  const types = [targetType, sourceType];

  if (types.every((t) => t === "Array")) {
    if (options.inplace) target.push(...source);
    else target = target.concat(source);
    return target;
  }

  if (types.every((t) => t === "Set")) {
    const canMergeSets = depth === 0 || options.mergeSets;
    if (options.inplace) {
      for (const element of source) target.add(element);
    } else {
      target = target.union(source);
    }
    return target;
  }

  if (targetType === "Map") {
    //todo
    return target;
  }
  for (const [key, value] of Object.entries(source)) {
    if (target.hasOwnProperty(key)) _mergeUpdate(target, key, value, options, depth + 1);
    else _mergeInsert(target, key, value, options, depth + 1);
  }
}

function _mergeInsert(target, key, value, options, depth) {
  if (k.startsWith("-=") && performDeletions) return void delete target[k.slice(2)];

  const canInsert = (depth <= 1 && options.insertKeys) || (depth > 1 && options.insertValues);
  if (!canInsert) return;

  if (value !== null && typeof value === "object") {
    target[key] = _merge({}, value, Object.assign(options, { inplace: true, insertKeys: true }), depth + 1);
  }

  target[key] = value;
}

function _mergeUpdate(target, key, value, options, depth) {
  const targetValue = target[key];
  const targetValueType = fu.getType(targetValue);
  const sourceValueType = fu.getType(value);
  //todo: allow set/maps/collections through, check for mergeArrays/Sets/Maps etc
  if (recursive && [targetValueType, sourceValueType].every((t) => t === "Object")) {
    return _merge(targetValue, value, Object.assign(options, { inplace: true }), depth);
  }
  if (overwrite) {
    if (targetValueType !== undefined && targetValueType !== sourceValueType && options.enforceTypes) {
      throw new Error("Mismatched data types encountered during merge.");
    }
    target[key] = value;
  }
}

/**
 * Expands any string keys containing `.` in the provided object, mutating it.
 * @param {Record<string, unknown>} object The object to be expanded
 * @returns {Record<string, unknown} The input object
 */
export function expandInPlace(object) {
  if (!Object.keys(object).some((k) => k.includes("."))) return object;
  const expanded = fu.expandObject(object);
  Object.keys(object).forEach((k) => delete object[k]);
  Object.assign(object, expanded);
  return object;
}

/**
 * Tests whether a given object is a non-string iterable
 * @param {any} object The object being tested
 * @returns {boolean}
 */
export function isIterable(object) {
  return typeof object !== "string" && typeof object?.[Symbol.iterator] === "function";
}

/**
 * Tests whether a given object is Array-like (has a length property, and integer keys matching that length)
 * @param {any} object The object being tested
 * @returns {boolean}
 */
export function isArrayLike(object) {
  return (
    Array.isArray(object) ||
    (!!object &&
      typeof object === "object" &&
      typeof object.length === "number" &&
      (object.length === 0 || (object.length > 0 && object.length - 1 in object)))
  );
}
/**
 * Tests whether a given object is sufficiently Arrayish to pass to Array.from()
 * @param {any} object The object being tested
 * @returns {boolean}
 */
export function isArrayish(object) {
  return isArrayLike(object) || isIterable(object);
}
/**
 * Check if all values of a provided iterable have the same `typeof`
 * @param {Iterable} iterable
 * @returns {boolean}
 */
export function isSingleType(iterable) {
  if (!isArrayish) throw new TypeError("isSingleType | Must be passed an iterable or array-like object.");
  return new Set(Array.from(iterable, (e) => typeof e)).size === 1;
}
