import { fu } from "../constants.mjs";
import { mhlog } from "./errorHelpers.mjs";

/**
 * @typedef {import("../_types.mjs").SortCallback} SortCallback
 */

/**
 * Standard wait function
 * @param {number} ms The time to wait in milliseconds
 */
export async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if a value is an object, but not a complex one.
 * @param {any} obj The value being tested
 * @returns {boolean}
 */
export function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(obj);
  return proto === null || proto === Object.prototype;
}

/**
 * Returns the options object at the end of an array. For use with functions
 * that take a variable number of arguments, but always/optionally finish with
 * an options object.
 * @param {Array<any>} inputs A ...rest arguments array
 * @param {object} [options={}]
 * @param {boolean} [options.handlebars=true] If true and the object contains a `hash` property, will return that instead of the whole object
 * This is how handlebars passes `{{helper param1=value1}}` arguments.
 * @returns {object|null} The options object, or `null` if none found or `inputs` wasn't an Array.
 */
export function getFunctionOptions(inputs, { handlebars = true } = {}) {
  if (!Array.isArray(inputs)) return null;
  const lastInput = inputs.at(-1);
  if (isPlainObject(lastInput)) {
    inputs.splice(-1, 1);
    return handlebars && lastInput?.hash ? lastInput.hash : lastInput;
  }
  return null;
}

/**
 * Processes potentially messy stringish input.
 *
 * @param {string|Array<string|Array<string|Array<string>>>} inputs A string or array of strings to be processed
 * @param {object} [options]
 * @param {string|boolean} [options.join=false] The string used to join entries before return, `true` means use the default `" "`, `false` is no join
 * @param {RegExp|string|boolean} [options.split=true] Splits each input on this value unless falsy. `true` means use the default `/\s+/`
 * @param {Function} [options.map] A callback to map every processed string. Applied before joining
 * @param {boolean} [options.unique=false] Whether to only allow one instance of any processed value
 * @returns {string|string[]} The processed values, or a string joined by `join` if provided
 */
export function getStringArgs(inputs, { join, split = /\s+/, map, unique = false } = {}) {
  if (!Array.isArray(inputs)) inputs = [inputs];
  const mapFn = typeof map === "function" ? map : _i;
  const splitFn = !split ? _i : (i) => i.split(split);
  if (join === true) join = " ";
  inputs = inputs
    .flat(Infinity)
    .filter((i) => !isEmpty(i))
    //split before and after the provided map in case it introduced new splitables
    .flatMap(splitFn)
    .map((i) => mapFn(String(i).trim()))
    .flatMap(splitFn);
  if (unique) inputs = [...new Set(inputs)];
  return join ? inputs.join(String(join)) : inputs;
}

/**
 * A modified `foundry.utils.deepClone` that (arguably) handles cloning Maps, Collections, and Sets
 *
 * Quickly clone a simple piece of data, returning a copy which can be mutated safely.
 * This method DOES support recursive data structures containing inner objects or arrays.
 * This method DOES support Dates, Sets, Maps and Collections
 * This method DOES NOT support anything beyond that.
 * @param {*} original                     Some sort of data
 * @param {object} [options]               Options to configure the behaviour of deepClone
 * @param {boolean} [options.strict=false]  Throw an Error if deepClone is unable to clone something instead of
 *                                          returning the original
 * @param {boolean} [options.cloneKeys=true] Whether to copy Map/Collection keys as reference, or clone them
 * @param {boolean} [options.cloneValues=true] Whether to copy Set/Map/Collection keys as reference, or clone them
 * TODO: why is this not in use anymore it seemed important
 * @param {number} [options._d]             An internal depth tracker
 * @return {*}                             The clone of that data
 */
export function deeperClone(
  original,
  { strict = false, returnOriginal = true, cloneKeys = true, cloneValues = true } = {}
) {
  // Simple types
  if (typeof original !== "object" || original === null) return original;
  const options = { strict, returnOriginal, cloneKeys, cloneValues };
  // Arrays
  if (original instanceof Array) return original.map((o) => deeperClone(o, options));
  // Sets
  if (original instanceof Set) {
    const out = new Set();
    for (const element of original) out.add(cloneValues ? deeperClone(element, options) : element);
    return out;
  }
  // Maps & Collections
  if (original instanceof Map) {
    const out = new original.constructor();
    for (const [k, v] of original.entries())
      out.set(cloneKeys ? deeperClone(k, options) : k, cloneValues ? deeperClone(v, options) : v);
    return out;
  }
  // Dates
  if (original instanceof Date) return new Date(original);

  // Unsupported advanced objects
  if (original.constructor && original.constructor !== Object) {
    //todo: localize
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

/**
 * Checks if value is empty. Deep-checks arrays and objects.
 * Note: isEmpty([]) == true, isEmpty({}) == true, isEmpty([{0:false},"",0]) == true, isEmpty({0:1}) == false
 * @see {@link https://stackoverflow.com/a/32728075}, slightly modernized to handle Maps, Collections, and Sets
 * @param {any} value
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

/**
 * Gets all keys from a Record that *are not* in a template object or array of valid string keys.
 * Not recursive.
 * @param {Record<string,any>} source The object being tested
 * @param {Record<string,any>|Array<string>} valid A template object, or an array of valid keys
 * @returns {Array<string>} Any keys found in `source` not allowed by `valid`
 */
export function getInvalidKeys(source, valid = []) {
  const validKeys = new Set(Array.isArray(valid) ? valid : isPlainObject(valid) ? Object.keys(valid) : []);
  if (isPlainObject(source)) {
    return [...new Set(Object.keys(source)).difference(validKeys)];
  }
  return [];
}

/**
 * Takes an array of objects and returns a sort callback that will order an array
 * with `order` first, and in that order, with all values not found in `order` not
 * sorted further.
 * @param {Array<any>} order
 * @returns {SortCallback} The generated sort callback
 *
 * @example
 * ```js
 * const order = ["b", "f", "a"]
 * const input = ["a", "b", "c", "d", "e", "f"]
 * const sorter = generateSorterFromOrder(order)
 * input.sort(sorter) // ["b", "f", "a", "c", "d", "e"]
 * ```
 */
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
/**
 * A slight modification of `foundry.utils.filterObject` to allow for
 * not recursively testing inner objects.
 * Filter the contents of some source object using the structure of a template object.
 * Only keys which exist in the template are preserved in the source object.
 *
 * @param {object} source           An object which contains the data you wish to filter
 * @param {object} template         An object which contains the structure you wish to preserve
 * @param {object} [options={}]     Additional options which customize the filtration
 * @param {boolean} [options.recursive=true] Whether to recursively test inner objects
 * @param {boolean} [options.deletionKeys=false]    Whether to keep deletion keys
 * @param {boolean} [options.templateValues=false]  Instead of keeping values from the source, instead draw values from the template
 *
 * @example Filter an object
 * ```js
 * const source = {foo: {number: 1, name: "Tim", topping: "olives"}, bar: "baz", other: 65};
 * const template = {foo: {number: 0, name: "Mit", style: "bold"}, other: 72};
 * filterObject(source, template); // {foo: {number: 1, name: "Tim"}, other: 65};
 * filterObject(source, template, {templateValues: true}); // {foo: {number: 0, name: "Mit"}, other: 72};
 * filterObject(source, template, {recursive: false}) // NEW {foo: {number: 1, name: "Tim", topping: "olives"}, other: 65}
 * ```
 */
export function filterObject(
  source,
  template,
  { recursive = true, deletionKeys = false, templateValues = false } = {}
) {
  // Validate input
  const ts = fu.getType(source);
  const tt = fu.getType(template);
  //todo: localize error
  if (ts !== "Object" || tt !== "Object") throw new Error("One of source or template are not Objects!");

  // Define recursive filtering function
  const _filter = function (s, t, filtered, recursive) {
    for (let [k, v] of Object.entries(s)) {
      let has = t.hasOwnProperty(k);
      let x = t[k];

      // Case 1 - inner object
      if (has && fu.getType(v) === "Object" && fu.getType(x) === "Object") {
        filtered[k] = recursive ? _filter(v, x, {}) : v;
      }

      // Case 2 - inner key
      else if (has) {
        filtered[k] = templateValues ? x : v;
      }

      // Case 3 - special key
      else if (deletionKeys && k.startsWith("-=")) {
        filtered[k] = v;
      }
    }
    return filtered;
  };

  // Begin filtering at the outer-most layer
  return _filter(source, template, {}, recursive);
}
/**
 * Function that returns its first parameter.
 * For simplifying applying-optional-maps logic.
 * @param {*} self any value
 * @returns {*} that value
 *
 * @example
 * Split can be null, in which case we want to do nothing to the elements,
 * but breaking up the chained functions would be unsightly
 *
 * ```js
 * split = split === null ? _i : (i) => i.split(split);
 * inputs = inputs
 *   .flat(Infinity)
 *   .filter((i) => !isEmpty(i))
 *   .flatMap(split)
 * ```
 */
export function _i(self) {
  return self;
}
