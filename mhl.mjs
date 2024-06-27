const MODULE_ID = "macro-helper-library";
const PHYSICAL_ITEM_TYPES = [
  "armor",
  "backpack",
  "book",
  "consumable",
  "equipment",
  "shield",
  "treasure",
  "weapon",
];
const fu = foundry.utils;
const CONSOLE_TYPES = ["debug", "info", "warn", "error"];
const BANNER_TYPES = CONSOLE_TYPES.slice(1);
const LABELABLE_TAGS = ["button", "input", "meter", "output", "progress", "select", "textarea"];
const VERIFIED_SYSTEM_VERSIONS = {
  pf2e: "5.15",
};

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(obj);
  return proto === null || proto === Object.prototype;
}

function getFunctionOptions(inputs, { handlebars = true } = {}) {
  if (!Array.isArray(inputs)) return null;
  const lastInput = inputs.at(-1);
  if (isPlainObject(lastInput)) {
    inputs.splice(-1, 1);
    return handlebars && lastInput?.hash ? lastInput.hash : lastInput;
  }
  return null;
}

function getStringArgs(inputs, { join = null, split = /\s+/, map = null } = {}) {
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

function deeperClone(
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
function mostDerivedClass(c1, c2) {
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

function isEmpty(value) {
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

function getInvalidKeys(source, valid = []) {
  const validKeys = new Set(Array.isArray(valid) ? valid : isPlainObject(valid) ? Object.keys(valid) : []);
  if (isPlainObject(source)) {
    return [...new Set(Object.keys(source)).difference(validKeys)];
  }
  return [];
}

function generateSorterFromOrder(order) {
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

function filterObject(source, template, {recursive= true, deletionKeys=false, templateValues=false}={}) {
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

/*
createHTMLElement, htmlQuery, htmlQueryAll, and htmlClosest are taken from the PF2e codebase (https://github.com/foundryvtt/pf2e), used under the Apache 2.0 License
*/


function createHTMLElement(nodeName, { classes = [], dataset = {}, children = [], innerHTML, attributes={} }={}) {
  const element = document.createElement(nodeName);
  if (classes.length > 0) element.classList.add(...classes);

  for (const [key, value] of Object.entries(dataset).filter(([, v]) => !isEmpty(v))) {
    element.dataset[key] = value === true ? "" : String(value);
  }
  for (const [key, value] of Object.entries(attributes).filter(([, v]) => !isEmpty(v))) {
    element[key] = value === true || String(value);
  }
  if (innerHTML) {
    element.innerHTML = innerHTML;
  } else {
    for (const child of children) {
      const childElement = child instanceof HTMLElement ? child : new Text(child);
      element.appendChild(childElement);
    }
  }
  return element;
}

function htmlQuery(parent, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(parent instanceof Element || parent instanceof Document)) return null;
  return parent.querySelector(selectors);
}

function htmlQueryAll(parent, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(parent instanceof Element || parent instanceof Document)) return [];
  return Array.from(parent.querySelectorAll(selectors));
}

function htmlClosest(child, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(child instanceof Element)) return null;
  return child.closest(selectors);
}

function elementFromString(string) {
  if (string instanceof HTMLElement) return string;
  if (typeof string !== "string") {
    mhlog$1(`MHL.Warning.Fallback.Type`, {
      context: {
        arg: "string",
        expected: "string or HTMLElement",
        type: typeof string,
      },
      func: "elementFromString",
    });
    return null;
  }
  if (!string) return null;
  const template = document.createElement("template");
  template.innerHTML = string;
  return template.content?.firstElementChild;
}

function prependIndefiniteArticle(text) {
  const vowels = "aeiou";
  if (typeof text !== "string") {
    mhlog$1(`MHL.Warning.Fallback.Type`, {
      func: "prependIndefiniteArticle",
      context: { arg: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  const article =
    vowels.indexOf(text[0].toLowerCase()) > -1
      ? mhlocalize(`MHL.Grammar.Articles.An`)
      : mhlocalize(`MHL.Grammar.Articles.A`);
  return `${article} ${text}`;
}

function mhlocalize(text, context = {}, { defaultEmpty = true, mod } = {}) {
  const func = "mhlocalize";
  text = logCastString(text, "text", { func, mod });
  const processedContext =
    isEmpty(context) || !isPlainObject(context)
      ? {}
      : Object.entries(context).reduce((acc, [k, v]) => {
          acc[k] = isPlainObject(v)
            ? mhlocalize(String(v.key ?? ""), v.context ?? {}, { defaultEmpty })
            : mhlocalize(String(v));
          return acc;
        }, {});
  if (isEmpty(game.i18n?.translations)) {
    return `Localization attempted before i18n initialization, pasteable command: 
    game.modules.get('${MODULE_ID}').api.mhlocalize('${text}', ${JSON.stringify(context)})`;
  }
  return game.i18n
    .localize(text)
    .replace(/(?<!\\)({[^}]+})/g, (match) => {
      // match all {} not preceded by \
      return processedContext[match.slice(1, -1)] ?? (defaultEmpty ? "" : undefined);
    })
    .replace(/\\{/, "{"); //strip \ before { from final string
}
//almost entirely lifted from pf2e system code, but now that we're system agnostic, can't rely on the system function being around
function sluggify(text, { camel = null } = {}) {
  const wordCharacter = String.raw`[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
  const nonWordCharacter = String.raw`[^\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
  const nonWordCharacterRE = new RegExp(nonWordCharacter, "gu");

  const wordBoundary = String.raw`(?:${wordCharacter})(?=${nonWordCharacter})|(?:${nonWordCharacter})(?=${wordCharacter})`;
  const nonWordBoundary = String.raw`(?:${wordCharacter})(?=${wordCharacter})`;
  const lowerCaseLetter = String.raw`\p{Lowercase_Letter}`;
  const upperCaseLetter = String.raw`\p{Uppercase_Letter}`;
  const lowerCaseThenUpperCaseRE = new RegExp(`(${lowerCaseLetter})(${upperCaseLetter}${nonWordBoundary})`, "gu");

  const nonWordCharacterHyphenOrSpaceRE =
    /[^-\p{White_Space}\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]/gu;
  const upperOrWordBoundariedLowerRE = new RegExp(`${upperCaseLetter}|(?:${wordBoundary})${lowerCaseLetter}`, "gu");
  if (typeof text !== "string") {
    mhlog$1(`MHL.Warning.Fallback.Type`, {
      func: "sluggify",
      context: { arg: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  if (text === "-") return text; //would otherwise be reduced to ""
  switch (camel) {
    case null:
      return text
        .replace(lowerCaseThenUpperCaseRE, "$1-$2")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(nonWordCharacterRE, " ")
        .trim()
        .replace(/[-\s]+/g, "-");
    case "bactrian": {
      const dromedary = sluggify(text, { camel: "dromedary" });
      return dromedary.capitalize();
    }
    case "dromedary":
      return text
        .replace(nonWordCharacterHyphenOrSpaceRE, "")
        .replace(/[-_]+/g, " ")
        .replace(upperOrWordBoundariedLowerRE, (part, index) => (index === 0 ? part.toLowerCase() : part.toUpperCase()))
        .replace(/\s+/g, "");
    default:
      throw MHLError(`MHL.Error.InvalidCamel`, { context: { camel }, log: { camel }, func: "sluggify" });
  }
}

// taken from the pf2e system:
function signedInteger(value, { emptyStringZero = false, zeroIsNegative = false } = {}) {
  if (value === 0 && emptyStringZero) return "";
  const nf = (intlNumberFormat ??= new Intl.NumberFormat(game.i18n.lang, {
    maximumFractionDigits: 0,
    signDisplay: "always",
  }));
  const maybeNegativeZero = zeroIsNegative && value === 0 ? -0 : value;

  return nf.format(maybeNegativeZero);
}

function oxfordList(list) {
  list = (Array.isArray(list) ? list : [list]).filter((e) => !!e).map((e) => String(e));
  if (list.length <= 1) return list?.[0] ?? "";
  if (list.length === 2) return list.join(" and ");
  const last = list.at(-1);
  const others = list.splice(0, list.length - 1);
  return `${others.join(", ")}, and ${last}`;
}

function localeSort(a, b) {
  const func = `localeSort`;
  a = logCastString(a, "a", { func });
  b = logCastString(b, "b", { func });
  return a.localeCompare(b);
}

function nullSort() {
  return 0;
}
function escapeHTML$1(text) {
  return text.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m])
  );
}

function getIconHTMLString(...args) {
  const func = `getIconHTMLString`;
  const failValidation = () => {
    mhlog$1({ args, options }, { type: "warn", prefix: `MHL.Error.Validation.IconGeneric`, func });
    return "";
  };
  const validateHTML = (html) => {
    const node = elementFromString(html);
    if (!node || !node.className) return failValidation();
    const validated = getIconClasses(node.className, options);
    if (!validated) return "";
    node.className = validated;
    return node.outerHTML;
  };
  const options = getFunctionOptions(args) ?? {};
  const element = options.element ?? "i";
  if (/<[^>]+>/.test(args[0])) return validateHTML(args[0]);
  const stringed = getStringArgs(args);
  if (stringed.length === 0) return failValidation();
  const containsHTML = stringed.find((s) => /<[^>]+>/.test(s));
  if (containsHTML) {
    return validateHTML(containsHTML);
  } else {
    const validated = getIconClasses(stringed, { options });
    if (isEmpty(validated)) return failValidation();
    return `<${element} class="${validated}"${
      validated === (options.fallback ?? CONFIG.MHL.fallbackIcon)
        ? `data-tooltip-class="mhl-pre-tooltip" data-tooltip="${mhlocalize(`MHL.Warning.Fallback.FallbackIconTooltip`, {
            args: escapeHTML$1(JSON.stringify(args)),
          })}"`
        : ``
    }></${element}>`;
  }
}

function getIconClasses(...args) {
  const func = `getIconClasses`;
  if (args.length === 0 || isPlainObject(args[0])) return "";
  const options = getFunctionOptions(args) ?? {};
  const stringed = getStringArgs(args, { map: (s) => s.toLowerCase() });
  const infer = options.infer ?? true;
  const strict = options.strict ?? false;
  const fallback =
    options.fallback ?? true
      ? typeof options.fallback === "string"
        ? options.fallback
        : CONFIG.MHL.fallbackIcon
      : null;
  const fail = () => {
    if (fallback) {
      mhlog$1({ args, options }, { func, prefix: `MHL.Warning.Fallback.FallbackIcon`, context: { fallback } });
      return fallback;
    }
    return "";
  };
  let font;
  if (isPlainObject(options?.font)) {
    font = options.font;
  } else if (!("font" in options) || isEmpty(options.font) || typeof options.font === "string") {
    font = getIconFontEntry(stringed, typeof options?.font === "string" ? options.font : null);
    if (!font) return fail();
  }
  if (!Array.isArray(getStringArgs(font?.prefixes))) return ""; //todo: more logging
  const glyphDefault = {
    pattern: "[-a-z0-9_]+",
    required: true,
  };
  const glyphSchema = font?.schema?.glyph ?? {};
  const schema = fu.duplicate(font.schema ?? {});
  delete schema.glyph; // ensure glyph is last entry
  schema.glyph = fu.mergeObject(glyphDefault, glyphSchema, { inplace: false });
  const aliases = font.aliases ?? {};
  const parts = getStringArgs(stringed, { map: (s) => (s in aliases ? aliases[s] : s) });
  const partsSeen = Object.fromEntries(Object.keys(schema).map((slug) => [slug, []]));
  partsSeen.others = [];
  const precluded = [];
  for (const part of parts) {
    let matched = false;
    for (const [slug, data] of Object.entries(schema)) {
      let matches, exact;
      if ("value" in data) {
        if (part !== data.value.toLowerCase()) continue;
        exact = true;
      } else {
        const prefixes = getStringArgs(data.prefixes ?? font.prefixes);
        matches = new RegExp(
          `^(${prefixes.map(RegExp.escape).join("|")})?(${
            "choices" in data ? data.choices.map(RegExp.escape).join("|") : data.pattern ?? "\n" //presumably/hopefully a \n will never match?
          })$`,
          "i"
        ).exec(part);
      }
      if (matches || exact) {
        // not exact, can't infer, and no prefix
        if (!exact && !infer && !matches[1]) continue;
        // matched = skip fallback add to others
        matched = true;
        // an exact match is precluded, discard
        if (precluded.includes(slug) && (exact || matches[1])) continue;
        //cap reached, discard
        if (partsSeen[slug].length >= (data.max ?? 1)) {
          if (!matches[1]) matched = false; // if we were inferring, it can get dumped to others
          continue;
        }
        if (slug === "glyph" && !isValidIcon(matches[2].toLowerCase(), font.name)) {
          matched = false; // dump to fallback handling
          continue;
        }
        partsSeen[slug].push(exact ? part : (matches[1] || data.prefixes?.[0] || font.prefixes[0]) + matches[2]);
        if ("precludes" in data) precluded.push(...getStringArgs(data.precludes));
        break;
      }
    }
    //strict means no classes not explicitly in the schema
    if (!matched && !strict) {
      partsSeen.others.push(part);
    }
  }
  for (const [slug, data] of Object.entries(schema)) {
    if (data.required && partsSeen[slug].length === 0) {
      if ("default" in data) partsSeen[slug].push(data.default);
      else return fail();
    }
  }
  return Object.values(partsSeen)
    .flat()
    .filter((p) => !isEmpty(p))
    .join(" ")
    .trim();
}

function isValidIcon(input, limitTo = null) {
  return !!getIconFontEntry(input, limitTo);
}

function getIconFontEntry(input, limitTo = null) {
  let parts;
  if (input instanceof HTMLElement) {
    parts = input.className.split(/\s+/);
  } else if (typeof input === "string") {
    parts = (elementFromString(input)?.className ?? input).split(/\s+/);
  } else if (Array.isArray(input)) {
    parts = getStringArgs(input);
  } else {
    return null;
  }

  limitTo = !isEmpty(limitTo) ? getStringArgs(limitTo) : null;
  const allowedIconFonts = CONFIG.MHL.iconFonts
    .filter((f) => (limitTo ? limitTo.includes(f.name) : true))
    .toSorted((a, b) => (a.sort < b.sort ? -1 : a.sort === b.sort ? 0 : 1));
  for (const font of allowedIconFonts) {
    for (const part of parts) {
      const prefix = font.prefixes.find((p) => part.startsWith(p));
      const testString = prefix ? part.substring(prefix.length) : part;
      if (font.list.includes(testString)) return font;
    }
  }
  return null;
}

function getIconListFromCSS(needle, prefixes) {
  const sheet = Array.from(document.styleSheets).find((s) => s?.href?.includes(String(needle)));
  if (!sheet) return []; //todo add logging
  prefixes = getStringArgs(prefixes);
  return [
    ...Array.from(sheet.cssRules)
      .filter(
        // the after filter is, I think, entirely for duotone stuff
        (rule) => rule instanceof CSSStyleRule && rule.style[0] === "content" && !rule.selectorText.includes("after")
      )
      .reduce((acc, rule) => {
        const regex = new RegExp(`\.(?:${prefixes.join("|")})([^:]+):{1,2}before`);
        const selectors = rule.selectorText.split(",").map((e) => e.trim().replace(regex, "$1"));
        for (const selector of selectors) acc.add(selector.toLowerCase());
        return acc;
      }, new Set()),
  ];
}

class MHLManagerDefaultsMenu extends FormApplication {
  settingName = "manager-defaults";
  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      title: "MHL Icon Glyph Settings",
      template: `modules/${MODULE_ID}/templates/ManagerDefaultsMenu.hbs`,
      classes: ["mhl-manager-defaults-menu"],
      width: 450,
      resizable: true,
    });
  }

  static iconChangeListener(ev) {
    const node = ev.currentTarget || ev.target;
    const form = htmlClosest(node, "form");
    const displayDiv = htmlQuery(form, `[data-icon-for="${node.id}"]`);
    const newIcon = getIconHTMLString(node.value);
    displayDiv.innerHTML = newIcon;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0];
    const inputs = htmlQueryAll(el, "input").filter((n) => "icon" in n.dataset);

    for (const input of inputs) {
      input.addEventListener("input", fu.debounce(MHLManagerDefaultsMenu.iconChangeListener, 300));
    }
    const cancelButton = htmlQuery(el, 'button[name=cancel]');
    cancelButton.addEventListener('click', this.close.bind(this));
  }
  getData(options = {}) {
    const context = super.getData(options);
    context.key = "manager-defaults";
    context.module = MODULE_ID;
    context.model = game.settings.get(MODULE_ID, this.settingName).clone();
    context.v12 = fu.isNewerVersion(game.version, 12);
    return context;
  }
  async _updateObject(event, formData) {
    const expanded = fu.expandObject(formData);   
    //only save valid icons
    for (const [k, v] of Object.entries(expanded)) {
      if (k.includes("Icon") && !getIconClasses(v, { fallback: false })) delete expanded[k];
    }    
    await SM().set(this.settingName, expanded);
    SM().app?.render();
  }
}

const funcPrefix$1 = `MHLDialog`;

class MHLDialog extends Dialog {
  prefix = null;
  constructor(data = {}, options = {}) {
    const func = `${funcPrefix$1}#constructor`;
    // gotta work around Application nuking the classes array with mergeObject
    let tempClasses;
    if ("classes" in options && Array.isArray(options.classes)) {
      tempClasses = options.classes;
      delete options.classes;
    }
    // sets this.data
    super(data, options);
    this.data ??= {};
    if (tempClasses) this.options.classes = [...new Set(this.options.classes.concat(tempClasses))];

    if (!this.data?.title) this.data.title = `Dialog ${this.appId}`; //mostly redundant but makes the next line cleaner
    if (!this.data?.prefix) this.data.prefix = String(this.data.prefix ?? this.data.title) + " | ";

    //validate the validator.
    if ("validator" in this.data) {
      this.data.validator = this.#processValidatorData(data.validator);
    }
    //make sure contentData doesnt have reserved keys (just buttons and content afaict)
    if ("contentData" in this.data) {
      const contentData = this.data.contentData;
      const disallowedKeys = ["buttons", "content"];
      if (!Object.keys(contentData).every((k) => !disallowedKeys.includes(k))) {
        throw MHLError(`MHL.Dialog.Error.ReservedKeys`, {
          context: { keys: disallowedKeys.join(", ") },
          func: "MHLDialog: ",
          log: { contentData },
        });
      }
    }

    if ("cancelButtons" in this.data) {
      const cancelButtons = this.data.cancelButtons;
      if (!Array.isArray(cancelButtons) || !cancelButtons.every((b) => typeof b === "string")) {
        throw MHLError(`MHL.Error.Type.Array`, {
          context: { arg: "cancelButtons", of: mhlocalize(`MHL.Error.Type.Of.ButtonLabelStrings`) },
          func,
          log: { cancelButtons },
        });
      }
    }
    this.data.cancelButtons ??= ["no", "cancel"];
  }

  #processValidatorData(validator) {
    switch (typeof validator) {
      case "function":
        break;
      case "string":
        validator = [validator];
      case "object":
        if (Array.isArray(validator) && validator.every((f) => typeof f === "string")) {
          const fields = validator;
          validator = (html) => {
            const formValues = MHLDialog.getFormData(html);
            const emptyFields = fields.filter((f) => isEmpty(formValues[f]));
            if (emptyFields.length) {
              const fieldsError = fields
                .map((f) =>
                  emptyFields.includes(f)
                    ? `<span style="text-decoration: var(--mhl-text-error-decoration)">${f}</span>`
                    : f
                )
                .join(", ");
              // don't use MHLBanner for genericity, use data.prefix for specificity
              localizedBanner(`MHL.Dialog.Warning.RequiredFields`, {
                context: { fields: fieldsError },
                type: "warn",
                console: false,
                prefix: this.data.prefix,
              });
              log({ formValues }, { type: "warn", prefix: this.data.prefix });
              return false;
            }
            return true;
          };
          break;
        }
      default:
        throw MHLError(`MHL.Dialog.Error.BadValidator`, { func: "MHLDialog: ", log: { validator } });
    }
    return validator;
  }
  #_validate() {
    if (!("validator" in this.data)) return true;
    return this.data.validator(this.options.jQuery ? this.element : this.element[0]);
  }

  getData() {
    return fu.mergeObject(super.getData(), {
      idPrefix: `mhldialog-${this.appId}-`,
      ...(this.data.contentData ?? {}),
    });
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.jQuery = false;
    options.classes.push("mhl-dialog");
    return options;
  }

  submit(button, event) {
    if (this.data.cancelButtons.includes(event.currentTarget.dataset.button) || this.#_validate()) {
      super.submit(button, event);
    } else {
      return false;
    }
  }

  // this exists just to not drop all new keys in data. also allows passing options as the 2nd argument like normal, and renderOptions as 3rd
  static async prompt(data = {}, altOptions = {}, altRenderOptions = {}) {
    //destructure buttons so it doesn't go into ...rest
    let { title, content, label, callback, render, rejectClose, options, renderOptions, buttons, ...rest } = data;
    rejectClose ??= false;
    options ??= {};
    options = fu.mergeObject(options, altOptions);
    renderOptions ??= {};
    renderOptions = fu.mergeObject(renderOptions, altRenderOptions);
    return this.wait(
      {
        title,
        content,
        render,
        default: "ok",
        close: () => {
          if (rejectClose) return;
          return null;
        },
        buttons: {
          ok: { icon: '<i class="fa-solid fa-check"></i>', label, callback },
        },
        ...rest,
      },
      options
    );
  }

  // this exists just to not drop all new keys in data. also allows passing options as the 2nd argument like normal, and renderOptions as 3rd
  static async confirm(data, altOptions = {}, altRenderOptions = {}) {
    //destructure buttons so it doesn't go into ...rest
    let { title, content, yes, no, render, defaultYes, rejectClose, options, renderOptions, buttons, ...rest } = data;
    renderOptions ??= {};
    renderOptions = fu.mergeObject(renderOptions, altRenderOptions);
    defaultYes ??= true;
    rejectClose ??= false;
    options ??= {};
    options.mhlConfirm = true;
    options = fu.mergeObject(options, altOptions);
    return this.wait(
      {
        title,
        content,
        render,
        focus: true,
        default: defaultYes ? "yes" : "no",
        close: () => {
          if (rejectClose) return;
          return null;
        },
        buttons: {
          yes: {
            icon: '<i class="fa-solid fa-check"></i>',
            label: game.i18n.localize("Yes"),
            callback: (html) => (yes ? yes(html) : true),
          },
          no: {
            icon: '<i class="fa-solid fa-xmark"></i>',
            label: game.i18n.localize("No"),
            callback: (html) => (no ? no(html) : false),
          },
        },
        ...rest,
      },
      options
    );
  }

  async _renderInner(data) {
    if (data?.content) {
      const originalContent = fu.deepClone(data.content);
      if (/\.(hbs|html)$/.test(data.content)) {
        data.content = await renderTemplate(originalContent, data);
      } else {
        data.content = Handlebars.compile(originalContent)(data, {
          allowProtoMethodsByDefault: true,
          allowProtoPropertiesByDefault: true,
        });
      }
      data.content ||= mhlocalize(`MHL.Dialog.Error.TemplateFailure`);
    }
    return super._renderInner(data);
  }

  static getFormData(html) {
    return Object.values(MHLDialog.getFormsData(html))[0];
  }

  static getFormsData(html) {
    html = html instanceof jQuery ? html[0] : html;
    const forms = htmlQueryAll(html, "form");
    return forms.reduce(
      (acc, form, i) => {
        const data = new FormDataExtended(form).object;
        acc[i] = data;
        const name = form.getAttribute("name");
        if (name) acc[name] = data;
        acc.length++;
        return acc;
      },
      { length: 0 }
    );
  }

  static getLabelMap(html) {
    html = html instanceof jQuery ? html[0] : html;
    const named = htmlQueryAll(html, "[name][id]");
    if (!named.length) return {};
    const namedIDs = named.map((e) => e.getAttribute("id"));
    const allLabels = htmlQueryAll(html, "label");
    if (!allLabels.length) return {};
    return allLabels.reduce((acc, curr) => {
      const forAttr = curr.getAttribute("for");
      if (forAttr) {
        if (!namedIDs.includes(forAttr)) return acc;
        acc[curr.getAttribute("name")] = curr.innerText;
      } else {
        const labelableChild = htmlQuery(curr, LABELABLE_TAGS.map((t) => `${t}[name]`).join(", "));
        if (!labelableChild) return acc;
        acc[labelableChild.getAttribute("name")] = curr.innerText;
      }
      return acc;
    }, {});
  }
}

function doc(input, type = null, { parent = null, returnIndex = false, async = false } = {}) {
  const func = `doc`;
  let document;
  if (type === true) async = true; // kinda gross?
  if (typeof type === "string") type = getDocumentClass(type);
  const requireType = (type) => {
    if (typeof type !== "function" || !(type.prototype instanceof foundry.abstract.DataModel)) {
      mhlog$1(
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
      mhlog$1(
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
async function applyOwnshipToFolderStructure(root, exemplar) {
  const ids = getIDsFromFolder(root); // handles type checking of root
  const updates = ids.map((id) => fu.flattenObject({ _id: id, ownership: exemplar.ownership }));
  const dc = CONFIG[root.type].documentClass;
  console.warn({ dc, root });
  await dc.updateDocuments(updates);
}
// flat list of all document IDs under a given folder structure

function getIDsFromFolder(root) {
  if (!(root instanceof Folder)) {
    if (typeof root === "string") root = game.folders.get(root);
    if (!root) throw MHLError("MHL.Error.Type.Folder", { context: { arg: "root" }, func: "getIDsFromFolder" });
  }
  return root.contents.concat(root.getSubfolders(true).flatMap((f) => f.contents)).map((c) => c.id);
}

function isOwnedBy(document, user) {
  //partially lifted from warpgate
  const corrected = document instanceof TokenDocument ? document.actor : document instanceof Token ? document.document.actor : document;
  const userID = doc(user, "User")?.id;
  if (corrected.ownership[userID] === 3) return true;
  return false;
}

function isRealGM(user = game.user) {
  user = doc(user, User);
  if (!user) return false;
  return user.role === CONST.USER_ROLES.GAMEMASTER;
}

function activeRealGM() {
  const activeRealGMs = game.users.filter((u) => u.active && isRealGM(u));
  activeRealGMs.sort((a, b) => (a.id > b.id ? 1 : -1));
  return activeRealGMs[0] || null;
}

function getModelDefaults(model) {
  const func = `getModelDefaults`;
  if (!(model.prototype instanceof foundry.abstract.DataModel)) {
    mhlog$1({ model }, { func, prefix: "MHL.Error.Type.DataModel", context: { arg: "model" } });
    return {};
  }
  return Object.entries(model.defineSchema()).reduce((acc, [key, field]) => {
    let initialValue;
    if (typeof field.initial === "function") {
      try {
        initialValue = field.initial();
      } catch (e) {
        mhlog$1({ e }, { type: 'error', func, prefix: "MHL.Error.DataModel.InitialFunctionFailure", context: { field: key } });
        initialValue = undefined;
      }
    } else {
      initialValue = field.initial;
    }
    acc[key] = initialValue;
    return acc;
  }, {});
}
async function pickAThingDialog({ things = null, title = null, thingType = "Item", dialogOptions = {} } = {}) {
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

class MHLSettingMenu extends FormApplication {

  constructor(object={}, options={}) {
    // gotta work around Application nuking the classes array with mergeObject
    let tempClasses;
    if ("classes" in options && Array.isArray(options.classes)) {
      tempClasses = options.classes;
      delete options.classes;
    }    
    super(object, options);
    if (tempClasses) this.options.classes = [...new Set(this.options.classes.concat(tempClasses))];
  }

  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      title: "MHL Setting Menu Test",
      template: `modules/${MODULE_ID}/templates/SettingMenu.hbs`,
      classes: [...super.defaultOptions.classes, "mhl-setting-menu"]
    })
  }


  // async _renderInner(data) {
  //   if (this.template === MHLSettingMenu.defaultOptions.template) {
  //     return super._renderInner(data)
  //   }
  //   const compiled = Handlebars.compile(this.template)(data, {
  //     allowProtoMethodsByDefault: true,
  //     allowProtoPropertiesByDefault: true,
  //   });
  //   return $(compiled)
  // }
  
}

//This file originally copied in its entirety from the foundry dnd5e system, under MIT license as seen at https://github.com/foundryvtt/dnd5e/blob/master/LICENSE.txt
//subsequent edits by Emmanuel Wineberg

/**
 * @typedef {object} AccordionConfiguration
 * @property {string} headingSelector    The CSS selector that identifies accordion headers in the given markup.
 * @property {string} contentSelector    The CSS selector that identifies accordion content in the given markup. This
 *                                       can match content within the heading element, or sibling to the heading
 *                                       element, with priority given to the former.
 * @property {boolean} [collapseOthers]  Automatically collapses the other headings in this group when one heading is
 *                                       clicked.
 */

/**
 * A class responsible for augmenting markup with an accordion effect.
 * @param {AccordionConfiguration} config  Configuration options.
 */
class Accordion {
  constructor(config) {
    const func = `Accordion#constructor`;
    const mod = config.mod ?? "MHL";    
    this.#config = {
      contentSelector:
        logCastString(config.contentSelector, "config.contentSelector", {func, mod}) + ":not(.mhl-accordion-content)",
      headingSelector: logCastString(config.headingSelector, "config.headingSelector",  {func, mod}),
      initialOpen: logCastNumber(config.initialOpen ?? Infinity, "config.initialOpen",  {func, mod}),
      collapseOthers: !!(config.collapseOthers ?? false),
    };
  }

  /**
   * Configuration options.
   * @type {AccordionConfiguration}
   */
  #config;

  /**
   * A mapping of heading elements to content elements.
   * @type {Map<HTMLElement, HTMLElement>}
   */
  #sections = new Map();

  /**
   * A mapping of heading elements to any ongoing transition effect functions.
   * @type {Map<HTMLElement, Function>}
   */
  #ongoing = new Map();

  /**
   * Record the state of collapsed sections.
   * @type {boolean[]}
   */
  #collapsed;

  /* -------------------------------------------- */

  /**
   * Augment the given markup with an accordion effect.
   * @param {HTMLElement} root  The root HTML node.
   */
  bind(root) {
    const firstBind = this.#sections.size < 1;
    if (firstBind) this.#collapsed = [];
    this.#sections = new Map();
    this.#ongoing = new Map();
    const { headingSelector, contentSelector } = this.#config;
    let collapsedIndex = 0;
    for (const heading of root.querySelectorAll(headingSelector)) {
      const content = heading.querySelector(contentSelector) ?? heading.parentElement.querySelector(contentSelector);

      if (!content) continue;
      const wrapper = document.createElement("div");
      wrapper.classList.add("mhl-accordion");
      heading.before(wrapper);
      wrapper.append(heading, content);
      this.#sections.set(heading, content);
      content._fullHeight = content.getBoundingClientRect().height;
      if (firstBind) {
        this.#collapsed.push(this.#collapsed.length >= this.#config.initialOpen);
      } else if (this.#collapsed[collapsedIndex]) {
        wrapper.classList.add("collapsed");
      }
      heading.classList.add("mhl-accordion-heading");
      content.classList.add("mhl-accordion-content");
      heading.addEventListener("click", this._onClickHeading.bind(this));
      collapsedIndex++;
    }
    requestAnimationFrame(() => this._restoreCollapsedState());
  }

  /* -------------------------------------------- */

  /**
   * Handle clicking an accordion heading.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onClickHeading(event) {
    if (event.target.closest("a")) return;
    const heading = event.currentTarget;
    const content = this.#sections.get(heading);
    if (!content) return;
    event.preventDefault();
    const collapsed = heading.parentElement.classList.contains("collapsed");
    if (collapsed) this._onExpandSection(heading, content);
    else this._onCollapseSection(heading, content);
  }

  /* -------------------------------------------- */

  /**
   * Handle expanding a section.
   * @param {HTMLElement} heading             The section heading.
   * @param {HTMLElement} content             The section content.
   * @param {object} [options]
   * @param {boolean} [options.animate=true]  Whether to animate the expand effect.
   * @protected
   */
  _onExpandSection(heading, content, { animate = true } = {}) {
    this.#cancelOngoing(heading);

    if (this.#config.collapseOthers) {
      for (const [otherHeading, otherContent] of this.#sections.entries()) {
        if (heading !== otherHeading && !otherHeading.parentElement.classList.contains("collapsed")) {
          this._onCollapseSection(otherHeading, otherContent, { animate });
        }
      }
    }

    heading.parentElement.classList.remove("collapsed");
    if (animate) content.style.height = "0";
    else {
      content.style.height = `${content._fullHeight}px`;
      return;
    }
    requestAnimationFrame(() => {
      const onEnd = this._onEnd.bind(this, heading, content);
      this.#ongoing.set(heading, onEnd);
      content.addEventListener("transitionend", onEnd, { once: true });
      content.style.height = `${content._fullHeight}px`;
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle collapsing a section.
   * @param {HTMLElement} heading             The section heading.
   * @param {HTMLElement} content             The section content.
   * @param {object} [options]
   * @param {boolean} [options.animate=true]  Whether to animate the collapse effect.
   * @protected
   */
  _onCollapseSection(heading, content, { animate = true } = {}) {
    this.#cancelOngoing(heading);
    const { height } = content.getBoundingClientRect();
    heading.parentElement.classList.add("collapsed");
    content._fullHeight = height || content._fullHeight;
    if (animate) content.style.height = `${height}px`;
    else {
      content.style.height = "0";
      return;
    }
    requestAnimationFrame(() => {
      const onEnd = this._onEnd.bind(this, heading, content);
      this.#ongoing.set(heading, onEnd);
      content.addEventListener("transitionend", onEnd, { once: true });
      content.style.height = "0";
    });
  }

  /* -------------------------------------------- */

  /**
   * A function to invoke when the height transition has ended.
   * @param {HTMLElement} heading  The section heading.
   * @param {HTMLElement} content  The section content.
   * @protected
   */
  _onEnd(heading, content) {
    content.style.height = "";
    this.#ongoing.delete(heading);
  }

  /* -------------------------------------------- */

  /**
   * Cancel an ongoing effect.
   * @param {HTMLElement} heading  The section heading.
   */
  #cancelOngoing(heading) {
    const ongoing = this.#ongoing.get(heading);
    const content = this.#sections.get(heading);
    if (ongoing && content) content.removeEventListener("transitionend", ongoing);
  }

  /* -------------------------------------------- */

  /**
   * Save the accordion state.
   * @protected
   */
  _saveCollapsedState() {
    this.#collapsed = [];
    for (const heading of this.#sections.keys()) {
      this.#collapsed.push(heading.parentElement.classList.contains("collapsed"));
    }
  }

  /* -------------------------------------------- */

  /**
   * Restore the accordion state.
   * @protected
   */
  _restoreCollapsedState() {
    const entries = Array.from(this.#sections.entries());
    for (let i = 0; i < entries.length; i++) {
      const collapsed = this.#collapsed[i];
      const [heading, content] = entries[i];
      if (collapsed) this._onCollapseSection(heading, content, { animate: false });
    }
  }
}

const funcPrefix = `MHLSettingsManager`;
class MHLSettingsManager {
  #colorPattern = "^#[A-Fa-f0-9]{6}";
  #enrichers = new Map([
    [/`([^`]+)`/g, `<code>$1</code>`],
    [/\[([^\]]+)\]\(([^\)]+)\)/g, `<a href="$2">$1</a>`],
  ]);
  #groups = new Set();
  #initialized = false;
  #module;
  #options;
  #potentialSettings = new Collection();
  #resetListeners = new Collection([
    ["all", null],
    ["groups", new Collection()],
    ["settings", new Collection()],
  ]);
  #resetListener;
  #settings = new Collection();

  static #readyHookID;
  static #managers = new Collection();
  static get managers() {
    return MHLSettingsManager.#managers;
  }

  constructor(moduleFor, options = {}) {
    const func = `${funcPrefix}#constructor`;
    this.#module = moduleFor instanceof Module ? moduleFor : game.modules.get(moduleFor);
    if (!this.#module) throw MHLError(`MHL.SettingsManager.Error.BadModuleID`, { log: { moduleFor }, func });

    this.#options = fu.mergeObject(this.defaultOptions, options, {});

    if (MHLSettingsManager.#managers.has(this.#module.id)) {
      throw modError(`MHL.SettingsManager.Error.ManagerAlreadyExists`, { context: { module: this.#module.title } });
    } else {
      MHLSettingsManager.#managers.set(this.#module.id, this);
      MHLSettingsManager.#managers[this.#options.modPrefix.toLowerCase()] ??= this;
    }

    //validate groups
    this.#options.groups = this.#processGroupsOption();
    //validate sort
    this.#options.sort = this.#processSortOption();
    //validate & normalize resetButtons
    this.#options.resetButtons = this.#processResetButtonsOption();
    //validate & set enrichers if provided
    if (!this.#validateEnrichHintsOption()) this.#options.enrichHints = true;

    if (options.settings) this.registerSettings(options.settings);
    //defer button icon checks to ready to account for lazily loaded icon fonts
    if (!MHLSettingsManager.#readyHookID) {
      MHLSettingsManager.#readyHookID = Hooks.once("ready", MHLSettingsManager.validateIcons);
    }
    this.#resetListener = this.#onResetClick.bind(this);
    Hooks.on("renderSettingsConfig", this.#onRenderSettings.bind(this));
    Hooks.on("closeSettingsConfig", this.#onCloseSettings.bind(this));
    this.#initialized = true;
  }

  get initialized() {
    return this.#initialized;
  }

  get app() {
    return Object.values(ui.windows).find((w) => w.id === "client-settings");
  }

  get section() {
    if (!this.app) return;
    const settingsConfigRoot = this.app.element instanceof jQuery ? this.app.element[0] : this.app.element;
    return htmlQuery(settingsConfigRoot, `section[data-category="${this.#module.id}"]`);
  }

  get defaultOptions() {
    const prefix = sluggify(this.#module.title, { camel: "bactrian" });
    return {
      // localization key section placed between setting name and choice value when inferring choice localization
      choiceInfix: "Choice",
      // true/false enables/disables built-in enrichers, or pass your own as an entries array (adds to built-ins)
      enrichHints: true,
      // localization key suffix appended to the settingPrefix for group names
      groupInfix: "Group",
      // how to handle setting grouping. false disables, true and "a" are aliases for the defaults
      groups: {
        // are collapsible groups animated by default
        animated: false,
        // are groups collapsible by default
        collapsible: false,
        // function used to sort the list of groups.
        // passing an array of strings generates a function that will sort with that order at the head of the list
        sort: nullSort,
        // the icon css class(es) for the accordion indicator. true means use the manager-defaults setting value
        accordionIndicator: true,
        // any css classes that will be applied to this group
        classes: [],
        // per group name key, override any of the above options except sort (intra- and extra-group sorting is handled by the sort option below)
        overrides: {},
      },
      // prefix for logged errors/warnings
      modPrefix: prefix.replace(/[a-z]/g, ""),
      // add reset-to-default buttons
      resetButtons: {
        // for the whole module
        module: false,
        // per group
        groups: false,
        // per individual setting
        settings: false,
        // the css class applied to buttons disabled because all the setting(s) they cover are already in their default state
        disabledClass: true,
      },
      // string to start inferred localization keys with
      settingPrefix: prefix + ".Setting",
      // handle sorting of settings. true for alphabetical on name, or a custom compare function.
      sort: {
        menusFirst: true,
        fn: nullSort,
      },
      // process settings with visibility data, only showing them in the settings window conditionally on the value of another setting
      visibility: true,
    };
  }

  get moduleResetIcon() {
    const opt = this.#options.resetButtons?.module;
    return opt && typeof opt === "string" ? opt : setting("manager-defaults").moduleResetIcon;
  }

  get groupResetIcon() {
    const opt = this.#options.resetButtons?.groups;
    return opt && typeof opt === "string" ? opt : setting("manager-defaults").groupResetIcon;
  }

  get settingResetIcon() {
    const opt = this.#options.resetButtons?.settings;
    return opt && typeof opt === "string" ? opt : setting("manager-defaults").settingResetIcon;
  }

  get disabledClass() {
    const opt = this.#options.resetButtons?.disabledClass;
    return opt && typeof opt === "string" ? opt : setting("manager-defaults").disabledClass;
  }

  #accordionIndicator(group) {
    const accordionIndicator =
      this.#options.groups?.overrides?.[group]?.accordionIndicator ?? this.#options.groups?.accordionIndicator ?? true;
    return accordionIndicator === true ? setting("manager-defaults")?.accordionIndicatorIcon : accordionIndicator;
  }

  #onRenderSettings(app, html, data) {
    html = html instanceof jQuery ? html[0] : html;
    //bail if this module has no configurable settings (either available to this user, or at all)
    const configurable = this.#settings.filter((setting) => setting?.config);
    if (configurable.length === 0) return;
    const clientSettings = configurable.filter((setting) => setting?.scope !== "world");
    if (!clientSettings.length && !isRealGM(game.user)) return;

    this.section.classList.add("mhl-settings-manager");

    const divs = htmlQueryAll(this.section, "div.form-group");
    const firstInputs = [];
    for (const div of divs) {
      const key = this.#getSettingKeyFromElement(div);
      const settingData = this.#settings.get(key);
      settingData.div = div;

      // buttons dont need change listeners or have formValues
      if (settingData.button) continue;

      const firstInput = htmlQuery(div, "input, select, multi-select, color-picker");
      if (firstInput) {
        // grab initial form values so visibility doesn't choke
        settingData.formValue = this.#_value(firstInput);
        firstInputs.push(firstInput);
      }
    }
    const savedValues = this.getAll();
    for (const key in savedValues) {
      const settingData = this.#settings.get(key);
      settingData.isDefault =
        "realDefault" in settingData ? fu.objectsEqual(settingData.realDefault, savedValues[key]) : undefined;
    }

    this.#applyGroupsAndSort();

    // unconditionally add color pickers and action buttons, since they're opt-in in setting data
    this.#addColorPickers();
    this.#replaceWithButtons();

    if (this.#options.enrichHints) {
      this.#enrichHints();
    }

    if (this.#options.resetButtons) {
      this.#addResetButtons();
    }
    //initial visibility checks & reset button updates
    for (const el of firstInputs) {
      el.addEventListener("change", this.#onChangeInput.bind(this));
      el.dispatchEvent(new Event("change"));
    }
  }

  #onCloseSettings() {
    this.#settings.forEach((s) => {
      delete s.div;
      delete s.formValue;
      delete s.formEqualsSaved;
    });
  }

  #onChangeInput(event) {
    const target = event.target;
    const formValue = this.#_value(target);
    const settingDiv = htmlClosest(target, "div[data-setting-id]");
    const key = this.#getSettingKeyFromElement(settingDiv);
    const savedValue = this.get(key);
    const settingData = this.#settings.get(key);
    settingData.formValue = formValue;
    settingData.formEqualsSaved = fu.objectsEqual(savedValue, formValue);
    this.#updateVisibility();
    this.#updateResetButtons(key);
  }

  #onUpdateSetting(key, value) {
    const settingData = this.#settings.get(key);
    settingData.isDefault = "realDefault" in settingData ? fu.objectsEqual(settingData.realDefault, value) : undefined;
    this.#setInputValues(key, value);
    // if we're updating a non-config setting, the change event wont fire a visibility update, so do it manually
    if (!settingData.config) this.#updateVisibility();
    this.#updateResetButtons(key);
  }

  #sortSettings(settings) {
    return settings.sort((a, b) => {
      const aName = mhlocalize(a.name);
      const bName = mhlocalize(b.name);
      if (this.#options.sort.menusFirst) {
        if (a.menu) {
          return b.menu ? this.#options.sort.fn(aName, bName) : -1;
        }
        return b.menu ? 1 : this.#options.sort.fn(aName, bName);
      } else {
        return this.#options.sort.fn(aName, bName);
      }
    });
  }

  #applyGroupsAndSort() {
    if (!this.section) return;
    const sortOrder = [htmlQuery(this.section, "h2")];
    const visibleSettings = this.#settings.filter(
      (s) => (s.config || s.menu) && (isRealGM(game.user) || s.scope === "client")
    );

    let accordionUsed = false;
    if (this.#options.groups) {
      const groups = [
        null,
        ...[...this.#groups].sort((a, b) => this.#options.groups.sort(mhlocalize(a), mhlocalize(b))),
      ];
      for (const group of groups) {
        const animated = this.#options.groups.overrides?.[group]?.animated ?? this.#options.groups.animated;
        accordionUsed ||= animated;
        const collapsible = this.#options.groups.overrides?.[group]?.collapsible ?? this.#options.groups.collapsible;
        const classes = this.#options.groups.overrides?.[group]?.classes ?? this.#options.groups.classes;
        classes.unshift("mhl-setting-group-container");
        const groupSettings = visibleSettings.filter((s) => s.group === group);
        // this.#log({ group, accordionUsed, groupSettings, classes, collapsible, animated, mappedVisibles }, { func });
        // if we have no settings we can touch, bail
        if (groupSettings.length === 0) continue;
        this.#sortSettings(groupSettings);

        // the null group just goes on the stack in sorted order, no wrappers
        if (group === null) {
          for (const setting of groupSettings) {
            sortOrder.push(setting.div);
          }
          continue;
        }

        const groupH3 = createHTMLElement("h3", {
          dataset: {
            settingGroup: group,
            accordionHeader: animated,
          },
          children: [mhlocalize(group)],
        });
        const groupContainerElement = createHTMLElement("div", {
          classes,
          dataset: { settingGroup: group },
        });
        sortOrder.push(groupContainerElement);
        let groupContentElement;
        if (collapsible) {
          if (animated) {
            groupContentElement = createHTMLElement("div", { dataset: { accordionContent: true } });
            groupH3.append(
              elementFromString(getIconHTMLString(this.#accordionIndicator(group), "mhl-accordion-indicator"))
            );
            groupContainerElement.append(groupH3, groupContentElement);
          } else {
            const summary = createHTMLElement("summary", { children: [groupH3] });
            groupContentElement = createHTMLElement("details", {
              children: [summary],
              dataset: { settingGroup: group },
              attributes: { open: true },
            });
            groupContainerElement.append(groupContentElement);
          }
        } else {
          groupContainerElement.append(groupH3);
        }
        for (const setting of groupSettings) {
          setting.div.dataset.settingGroup = group;
          if (groupContentElement) {
            groupContentElement.append(setting.div);
          } else {
            sortOrder.push(setting.div);
          }
        }
      }
    } else {
      // this.#options.sort.fn should always exist, so always run the sort
      this.#sortSettings(visibleSettings);
      for (const setting of visibleSettings) {
        sortOrder.push(setting.div);
      }
    }
    for (const node of sortOrder) {
      this.section.append(node);
    }

    if (accordionUsed)
      new Accordion({
        headingSelector: `h3[data-accordion-header]`,
        contentSelector: `div[data-accordion-content]`,
        mod: this.#options.modPrefix,
        initalOpen: Infinity,
      }).bind(this.section);
  }

  has(key, { potential = false } = {}) {
    const func = `${funcPrefix}#has`;
    key = this.#logCastString(key, "key", func);
    return this.#settings.has(key) || (potential && this.#potentialSettings.has(key));
  }

  get(key) {
    const func = `${funcPrefix}#get`;
    if (!this.#requireSetting(key, { func })) return undefined;
    // either we're past Setup, or it's a client setting that can be retrieved early
    if (game?.user || this.#settings.get(key).scope === "client") return game.settings.get(this.#module.id, key);
    return undefined;
  }

  getAll() {
    return this.#settings.reduce((acc, setting) => {
      if (!setting.menu && !setting.button) acc[setting.key] = this.get(setting.key);
      return acc;
    }, {});
  }

  beenSet(key) {
    const func = `${funcPrefix}#beenSet`;
    if (!this.#requireSetting(key, { func })) return false;
    const fullkey = `${this.#module.id}.${key}`;
    const scope = this.#settings.get(key).scope;
    const storage = game.settings.storage.get(scope);
    return scope === "world" ? !!storage.find((s) => s.key === fullkey) : fullkey in storage;
  }

  async set(key, value) {
    const func = `${funcPrefix}#set`;
    if (!this.#requireSetting(key, { func })) return undefined;
    return game.settings.set(this.#module.id, key, value);
  }

  async reset(keys) {
    const func = `${funcPrefix}#reset`;
    if (!Array.isArray(keys)) keys = [keys];
    const sets = [];
    for (const key of keys) {
      if (!this.#requireSetting(key, { func })) continue;
      const data = this.#settings.get(key);
      if (!("realDefault" in data)) continue;
      sets.push(this.set(key, data.realDefault));
      this.#setInputValues(key, data.realDefault);
    }
    return await Promise.all(sets);
  }

  async hardReset(keys) {
    const func = `${funcPrefix}#reset`;
    if (!Array.isArray(keys)) keys = [keys];
    const deletes = [];
    const clientStorage = game.settings.storage.get("client");
    const worldStorage = game.settings.storage.get("world");
    for (const key of keys) {
      const fullkey = `${this.#module.id}.${key}`;
      if (!this.#requireSetting(key, { func })) continue;
      const data = this.#settings.get(key);
      if (data.scope === "world") {
        const settingDoc = worldStorage.find((s) => s.key === fullkey);
        if (settingDoc) deletes.push(settingDoc.delete());
      } else {
        clientStorage.removeItem(fullkey);
      }
    }
    return await Promise.all(deletes);
  }

  async resetAll() {
    return this.reset(Array.from(this.#settings.keys()));
  }

  async hardResetAll() {
    return this.hardReset(Array.from(this.#settings.keys()));
  }

  registerSettings(data) {
    const func = `${funcPrefix}#registerSettings`;
    const settings = this.#validateRegistrationData(data);
    if (!settings) return false; //validator already raised console error

    //have all potential keys available to predicate visibility upon
    this.#potentialSettings = deeperClone(settings);

    for (const [key, data] of settings.entries()) {
      const success = this.registerSetting(key, data, { initial: true });
      if (!success) {
        this.#log(
          { key, data },
          {
            prefix: `MHL.SettingsManager.Error.InvalidSettingData`,
            func,
            context: { key },
          }
        );
      }
    }

    if (game?.user) ; else {
      Hooks.once("setup", this.#updateHooks.bind(this));
    }
  }

  registerSetting(key, data, { initial = false } = {}) {
    const func = `${funcPrefix}#registerSetting`;
    if (typeof key !== "string") {
      return false;
    }
    if (!this.#potentialSettings.has(key)) this.#potentialSettings.set(key, data);
    if (this.#settings.has(key)) {
      this.#log(`MHL.SettingsManager.Error.DuplicateSetting`, {
        type: "error",
        context: { key },
        func,
      });
      return false;
    }
    data = this.#processSettingData(key, data);
    if (!data) {
      return false;
    }
    // only save groups of settings that get registered
    if (data.group !== null) this.#groups.add(data.group);
    //actually register the setting finally
    this.#register(key, data);
    // only update hooks if we're not inside a registerSettings call
    if (!initial) this.#updateHooks(key);
    this.#potentialSettings.delete(key);
    return true;
  }

  #processSettingData(key, data) {
    const func = `${funcPrefix}##processSettingData`;
    //add the key to the data because Collection's helpers only operate on values
    data.key = key;
    //handle registering settings menus
    if (data.menu || data.type?.prototype instanceof FormApplication) {
      //TODO: implement generation in v12, add app v2 to check
      // if (!data?.type || !(data.type?.prototype instanceof FormApplication)) return false;
      data.menu = true;
    }

    // v12+ assigns default: null to settings registered without a default
    if ("default" in data) data.realDefault = deeperClone(data.default);

    //ensure settings have a visible name, even if it's a broken localization key
    if (data.config && !("name" in data)) data.name = true;

    // if name, hint, or a choice or menu label is passed as null, infer the desired translation key
    data = this.#processInferrableLabels(key, data);

    //validate button settings
    if ("button" in data) {
      data.button = this.#processButtonData(key, data.button);
      // since buttons replace whole settings, if validation fails, don't create a useless text input
      if (!data.button) return false;
    }

    //only allow colour pickers for settings with a valid colour hex code as default value
    if ("colorPicker" in data) {
      const regex = new RegExp(this.#colorPattern);
      if (!regex.test(data.realDefault ?? "")) {
        this.#log({ key, data }, { prefix: `MHL.SettingsManager.Error.InvalidColorPicker`, func });
        data.colorPicker = false;
      }
    }
    //handle setting visibility dependencies
    if ("visibility" in data) {
      data.visibility = this.#processVisibilityData(key, data.visibility);
      // if validation failed, don't make broken listeners
      if (!data.visibility) delete data.visibility;
    }

    //update hooks every time a setting is changed
    const originalOnChange = data.onChange;
    data.onChange = function (value) {
      // this.#updateHooks(key);
      // this.#updateResetButtons(key);
      this.#onUpdateSetting(key, value);
      if (originalOnChange) originalOnChange(value);
    }.bind(this);

    //handle setting-conditional hooks, has to happen after registration or the error handling in setHooks gets gross
    if ("hooks" in data) {
      data.hooks = this.#processHooksData(key, data.hooks);
      if (!data.hooks) delete data.hooks;
    }
    //handle groups, make sure data.group always exists
    if ("group" in data) {
      data.group = this.#expandPartialGroupName(this.#logCastString(data.group, "data.group", func));
    }
    data.group ??= null;

    return data;
  }

  #register(key, data) {
    if (data.menu) {
      game.settings.registerMenu(this.#module.id, key, data);
    } else {
      game.settings.register(this.#module.id, key, data);
    }
    this.#settings.set(key, data);
  }

  #processInferrableLabels(key, data) {
    // ensure configurable settings have names
    if (data.name === true) {
      data.name = [this.#options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Name"].join(".");
    }
    if (data.hint === true) {
      data.hint = [this.#options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Hint"].join(".");
    }
    if (isPlainObject(data.choices)) {
      for (const [choiceValue, choiceLabel] of Object.entries(data.choices)) {
        if (choiceLabel === true) {
          data.choices[choiceValue] = [
            this.#options.settingPrefix,
            sluggify(key, { camel: "bactrian" }),
            this.#options.choiceInfix,
            sluggify(choiceValue, { camel: "bactrian" }),
          ].join(".");
        }
      }
    }
    if (data.label === true) {
      data.label = [this.#options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Label"].join(".");
    }
    return data;
  }

  #generateSettingMenu(data) {
    //todo: do this in v12
    // if (!fu.isNewerVersion(game.version, 12)) return;
    // const func = `${funcPrefix}##generateSettingMenu`;
    // if (!("for" in data) || !this.#requireSetting(data.for, { func, potential: true })) {
    //   return false;
    // }
    // const forData = this.#settings.get(data.for) || this.#potentialSettings.get(data.for);
    // if (!(forData.type?.prototype instanceof foundry.abstract.DataModel)) return false;
    // const moduleID = this.#module.id;
    // return class MHLGeneratedSettingMenu extends MHLSettingMenu {
    //   static get defaultOptions() {
    //     const options = super.defaultOptions;
    //     options.classes.push("mhl-setting-menu");
    //     options.width = 400;
    //     options.resizable = true;
    //     return options;
    //   }
    //   getData(options = {}) {
    //     const context = super.getData(options);
    //     context.key = data.for;
    //     context.module = moduleID;
    //     context.model = game.settings.get(MODULE_ID, data.for).clone();
    //     context.v12 = fu.isNewerVersion(game.version, 12);
    //     return context;
    //   }
    //   _updateObject(event, formData) {
    //     const expanded = fu.expandObject(formData);
    //     modLog(
    //       { event, formData, expanded },
    //       {
    //         type: "warn",
    //         mod: this.#options.modPrefix,
    //         func: `_updateObject`,
    //       }
    //     );
    //     game.settings.set(MODULE_ID, data.for, expanded);
    //   }
    // };
  }

  #processButtonData(key, buttonData) {
    const func = `${funcPrefix}##processButtonData`;
    if (!isPlainObject(buttonData) || typeof buttonData.action !== "function") {
      this.#log({ buttonData }, { prefix: `MHL.SettingsManager.Error.Button.BadFormat`, func, context: { key } });
      return false;
    }
    if (!("label" in buttonData) || buttonData.label === true) {
      buttonData.label = [this.#options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Label"].join(".");
    } else {
      buttonData.label = this.#logCastString(buttonData.label, "buttonData.label", func);
    }
    // validateIcons() runs on ready, to let additional icon fonts get registered as late as setup
    return buttonData;
  }

  #processVisibilityData(key, data) {
    const func = `${funcPrefix}##processVisibilityData`;
    // assume passed functions are valid, no good way to interrogate
    if (typeof data === "function") return data;

    const tests = Array.isArray(data) ? data : [data];
    if (tests.some((e) => typeof e !== "string")) {
      this.#log({ key, data }, { prefix: "MHL.SettingsManager.Error.Visibility.BadFormat", func, type: "error" });
      return false;
    }
    for (const test of tests) {
      const dependsOn = test.match(/^(s|f)?(!)?(.+)/)[3];
      if (dependsOn === key) {
        this.#log("MHL.SettingsManager.Error.Visibility.Recursion", { func, type: "error" });
        return false;
      }
      if (
        !this.#requireSetting(dependsOn, {
          func,
          potential: true,
          context: { key, dependsOn },
          errorstr: `MHL.SettingsManager.Error.Visibility.UnknownDependency`,
        })
      )
        return false;
    }
    return (form, saved) => {
      return tests.reduce((pass, test) => {
        const [_, type, invert, dependency] = test.match(/^(s|f)?(!)?(.+)/);
        const value = (type === "s" ? saved : form)[dependency];
        pass &&= invert ? !value : value;
        return pass;
      }, true);
    };
  }

  #processHooksData(key, hooksData) {
    const func = `${funcPrefix}##processHooksData`;
    const goodHooks = [];
    if (!Array.isArray(hooksData)) hooksData = [hooksData];
    for (const hookData of hooksData) {
      let invalid = false;
      let errorstr = "";
      if (typeof hookData !== "object" || ("hook" in hookData && typeof hookData.hook !== "string")) {
        errorstr = `MHL.SettingsManager.Error.Hooks.BadHook`;
        invalid = true;
      }
      if (!invalid && "action" in hookData && typeof hookData.action !== "function") {
        errorstr = `MHL.SettingsManager.Error.Hooks.RequiresAction`;
        invalid = true;
      }
      if (!invalid && "test" in hookData && typeof hookData.test !== "function") {
        errorstr = `MHL.SettingsManager.Error.Hooks.TestFunction`;
        invalid = true;
      }
      if (invalid) {
        this.#log(
          { key, hookData },
          {
            type: "error",
            prefix: errorstr,
            context: { key, hook: hookData?.hook },
            func,
          }
        );
        continue;
      }
      //default test if none provided
      hookData.test ??= (value) => !!value;
      goodHooks.push(hookData);
    }
    return goodHooks.length ? goodHooks : false;
  }

  #updateHooks(key = null) {
    for (const [setting, data] of this.#settings.entries()) {
      if ((key && key !== setting) || !("hooks" in data)) continue;
      const value = this.get(setting);
      for (let i = 0; i < data.hooks.length; i++) {
        const active = data.hooks[i].test(value);
        const existingHookID = data.hooks[i].id ?? null;
        if (active) {
          if (existingHookID) continue;
          data.hooks[i].id = Hooks.on(data.hooks[i].hook, data.hooks[i].action);
        } else if (existingHookID) {
          Hooks.off(data.hooks[i].hook, existingHookID);
          delete data.hooks[i].id;
        }
      }
      this.#settings.set(setting, data);
    }
  }

  #enrichHints() {
    if (!this.section) return;
    const hints = htmlQueryAll(this.section, ":is(div[data-setting-id], div.submenu) p.notes");
    for (const hint of hints) {
      let text = hint.innerHTML;
      if (!text) continue;
      for (const [pattern, replacement] of this.#enrichers.entries()) {
        text = text.replace(pattern, replacement);
      }
      text.replace(/(<script.*>.*<\/script>)/g, "");
      hint.innerHTML = text;
    }
  }

  #addColorPickers() {
    if (!this.section) return; //todo: logging?
    const colorSettings = this.#settings.filter((s) => s?.colorPicker);
    //stored in private prop so it can be easily changed if type="color" inputs take the stick out their ass
    const regex = new RegExp(this.#colorPattern);
    for (const setting of colorSettings) {
      const textInput = htmlQuery(setting.div, 'input[type="text"]');
      if (!textInput) continue;
      const colorPicker = createHTMLElement("input", {
        attributes: { type: "color", value: this.get(setting.key) },
        dataset: { edit: setting.div.dataset.settingId }, // required for styling?!
      });
      colorPicker.addEventListener(
        "input",
        function (event) {
          //force a reset anchor refresh; foundry's code for updating the text field runs too slowly?
          textInput.value = event.target.value;
          textInput.dispatchEvent(new Event("change"));
        }.bind(this)
      );
      textInput.parentElement.append(colorPicker);
      textInput.pattern = this.#colorPattern;
      textInput.dataset.tooltipDirection = "UP";
      textInput.addEventListener("input", (event) => {
        //would love to support more than a string 6-character hex code, but input[type=color] yells about condensed and/or rgba on chrome
        if (event.target.value.length > 7) {
          event.target.value = event.target.value.substring(0, 7);
        }
        if (!regex.test(event.target.value)) {
          textInput.dataset.tooltip = mhlocalize(`MHL.SettingsManager.ColorPicker.ValidHexCode`);
        } else {
          textInput.dataset.tooltip = "";
          colorPicker.value = event.target.value;
        }
      });
    }
  }

  #replaceWithButtons() {
    if (!this.section) return;
    const buttonSettings = this.#settings.filter((s) => s.button);
    for (const setting of buttonSettings) {
      const fieldDiv = htmlQuery(setting.div, ".form-fields");
      setting.div.classList.add("submenu");
      const children = [createHTMLElement("label", { children: [mhlocalize(setting.button.label)] })];
      if (setting.button.icon) children.unshift(elementFromString(getIconHTMLString(setting.button.icon)));
      const button = createHTMLElement("button", {
        attributes: { type: "button" },
        classes: ["mhl-setting-button"],
        children,
      });
      button.addEventListener("click", setting.button.action);
      fieldDiv.replaceWith(button);
    }
  }

  #updateVisibility() {
    if (!this.section) return;
    const savedValues = this.getAll();
    const formValues = this.#getFormValues();
    const predicated = this.#settings.filter((s) => s.visibility && s.div);
    for (const setting of predicated) {
      const visible = setting.div.style.display !== "none";
      const show = setting.visibility(formValues, savedValues, visible);
      setting.div.style.display = show ? "flex" : "none";
    }
  }

  #addResetButtons() {
    if (!this.section) return;
    const opt = this.#options.resetButtons;
    const isGM = isRealGM(game.user);
    const resettables = this.#settings.filter(
      (s) => "realDefault" in s && !s.button && !s.menu && (isGM || s.scope === "client")
    );
    if (opt.module) {
      const h2 = htmlQuery(this.section, "h2");
      const resetIcon = elementFromString(getIconHTMLString(this.moduleResetIcon));
      const resetAnchor = createHTMLElement("a", {
        dataset: { resetType: "module", resetTarget: this.#module.id, tooltipDirection: "UP" },
        children: [resetIcon],
      });
      const resetSpan = createHTMLElement("span", { children: [resetAnchor], classes: ["mhl-reset-button"] });
      resetAnchor.addEventListener("click", this.#resetListener);
      resetAnchor.addEventListener("contextmenu", this.#resetListener);
      h2.append(resetSpan);
    }
    if (opt.groups) {
      const h3s = htmlQueryAll(this.section, "h3[data-setting-group]");
      for (const h3 of h3s) {
        const group = h3.dataset.settingGroup;
        const groupResettables = resettables.filter((s) => s.group === group);
        if (groupResettables.length === 0) continue;
        const resetIcon = elementFromString(getIconHTMLString(this.groupResetIcon));
        const resetAnchor = createHTMLElement("a", {
          dataset: { resetType: "group", reset: group, tooltipDirection: "UP" },
          children: [resetIcon],
        });
        const resetSpan = createHTMLElement("span", { children: [resetAnchor], classes: ["mhl-reset-button"] });
        resetAnchor.addEventListener("click", this.#resetListener);
        resetAnchor.addEventListener("contextmenu", this.#resetListener);
        h3.append(resetSpan);
      }
    }
    if (opt.settings) {
      for (const setting of resettables) {
        let div;
        if (!setting.config) {
          const menu = this.#settings.find((s) => s.for === setting.key);
          if (!menu) continue;
          div = menu.div;
        } else {
          div = setting.div;
        }
        const label = htmlQuery(div, "label");
        const resetIcon = elementFromString(getIconHTMLString(this.settingResetIcon));
        const resetAnchor = createHTMLElement("a", {
          dataset: { resetType: "setting", reset: setting.key, tooltipDirection: "UP" },
          children: [resetIcon],
        });
        resetAnchor.addEventListener("click", this.#resetListener);
        resetAnchor.addEventListener("contextmenu", this.#resetListener);
        label.prepend(resetAnchor);
        // run initial update here to cover non-config object settings with anchors on their menu buttons
        this.#updateResetButtons(setting.key);
      }
    }
  }

  async #onResetClick(event) {
    const func = `${funcPrefix}##onResetClick`;
    event.preventDefault();
    event.stopPropagation();
    const rightClick = event.type === "contextmenu";
    const anchor = event.currentTarget;
    const resetType = anchor.dataset.resetType;
    const resetTarget = anchor.dataset.reset;
    let target, relevantSettings;
    switch (resetType) {
      case "setting":
        relevantSettings = [this.#settings.get(resetTarget)];
        target = relevantSettings[0].name;
        break;
      case "group":
        relevantSettings = this.#settings.filter((s) => s.group === resetTarget);
        target = resetTarget;
        break;
      case "module":
        relevantSettings = this.#settings.contents;
        target = this.#module.title;
        break;
    }
    relevantSettings = relevantSettings.filter((s) => !s.button && !s.menu);
    this.#log({ relevantSettings, target, rightClick }, { func });
    // if everything's default, or we right clicked, no dialog needed, just reset form values and bail
    const [defaultless, hasDefaults] = relevantSettings.partition((s) => "realDefault" in s);
    if (hasDefaults.every((s) => s.isDefault) || event.type === "contextmenu") {
      const formDifferentFromSaved = relevantSettings.filter((s) => s.formEqualsSaved === false);
      if (formDifferentFromSaved.length > 0) {
        modBanner(`MHL.SettingsManager.Reset.FormResetBanner`, {
          type: "info",
          mod: this.#options.modPrefix,
          log: { formDifferentFromSaved },
          context: { count: formDifferentFromSaved.length },
        });
        for (const setting of formDifferentFromSaved) {
          this.#setInputValues(setting.div, this.get(setting.key));
        }
      }
      return;
    }
    const iconMap = new Map([
      [String, "code-string"],
      ["StringField", "code-string"],
      [Number, "numeric"],
      ["NumberField", "numeric"],
      [Boolean, "code-equal"],
      ["color", "palette"],
      ["ColorField", "palette"],
      ["model", "database"],
      ["function", "function"],
      ["unknown", "question flip-vertical"],
    ]);
    const processedSettings = hasDefaults.reduce((acc, s) => {
      const savedValue = this.get(s.key);
      const defaultValue = s?.realDefault ?? undefined;
      const typeGlyph =
        iconMap.get(s.type) ??
        (s.type?.prototype instanceof foundry.abstract.DataModel
          ? iconMap.get("model")
          : s.colorPicker
          ? iconMap.get("color")
          : iconMap.get(s.type?.name)) ??
        iconMap.get("unknown");
      const typeTooltip = s.type?.name ?? "Unknown";
      const typeIcon = elementFromString(getIconHTMLString(typeGlyph));
      typeIcon.dataset.tooltipDirection = "UP";
      typeIcon.dataset.tooltip = typeTooltip;
      acc.push({
        key: s.key,
        name: s.name ?? s.key,
        config: !!s.config,
        isDefault: s.isDefault ?? false,
        isObject: typeof savedValue === "object",
        isColor: !!s.colorPicker,
        typeIcon: typeIcon.outerHTML,
        savedValue,
        defaultValue,
        displaySavedValue: this.#prettifyValue("choices" in s ? mhlocalize(s.choices[savedValue]) : savedValue),
        displayDefaultValue: this.#prettifyValue("choices" in s ? mhlocalize(s.choices[defaultValue]) : defaultValue),
      });
      return acc;
    }, []);

    const dialogID = `mhl-reset-${this.#module.id}-${resetType}-${resetTarget}`;
    const existingDialog = Object.values(ui.windows).find((w) => w.id === dialogID);
    if (existingDialog) {
      existingDialog.bringToTop();
      return;
    }

    const dialogData = {
      title: mhlocalize(`MHL.SettingsManager.Reset.DialogTitle`),
      buttons: {
        reset: {
          callback: MHLDialog.getFormData,
          icon: getIconHTMLString("fa-check"),
          label: mhlocalize("SETTINGS.Reset"),
        },
        cancel: {
          callback: () => false,
          icon: getIconHTMLString("fa-xmark"),
          label: mhlocalize("Cancel"),
        },
      },
      content: `modules/${MODULE_ID}/templates/SettingsManagerReset.hbs`,
      contentData: {
        defaultlessCount: defaultless.length,
        defaultlessTooltip: oxfordList(defaultless.map((s) => mhlocalize(s.name ?? s.key))),
        resetType,
        settings: processedSettings,
        target,
      },
      close: () => false,
      default: "cancel",
      render: (html) => {
        const objects = htmlQueryAll(html, ".value-display.object-setting");
        for (const object of objects) MHL$1().hljs.highlightElement(object);
      },
    };
    const dialogOptions = {
      classes: ["mhl-reset", "mhl-hljs-light"],
      id: dialogID,
      resizable: true,
      width: "auto",
    };

    const doReset = await MHLDialog.wait(dialogData, dialogOptions);
    this.reset(
      Object.entries(doReset).reduce((acc, [setting, checked]) => {
        if (checked) acc.push(setting);
        return acc;
      }, [])
    );
  }

  #updateResetButtons(key) {
    const func = `${funcPrefix}##updateResetButtons`;
    if (!this.section || !this.#requireSetting(key, { func })) return;
    const opt = this.#options.resetButtons;
    const allowedSettings = this.#settings.filter((s) => isRealGM(game.user) || s.scope === "client");
    const formResettables = allowedSettings.filter((s) => s.formEqualsSaved === false);
    const savedResettables = allowedSettings.filter((s) => s.isDefault === false);
    const disabledClass = this.disabledClass;
    const settingData = this.#settings.get(key);
    const group = settingData.group;
    if (opt.module) {
      const anchor = htmlQuery(this.section, `a[data-reset-type="module"]`);
      let tooltip = "";
      if (savedResettables.length > 0) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.SavedTooltip`, { count: savedResettables.length });
        anchor.addEventListener("click", this.#resetListener);
        if (formResettables.length > 0) {
          tooltip += mhlocalize(`MHL.SettingsManager.Reset.Module.FormTooltipAppend`, {
            count: formResettables.length,
          });
        }
      } else if (formResettables.length > 0) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.FormTooltipSolo`, { count: formResettables.length });
        anchor.addEventListener("click", this.#resetListener);
      } else {
        anchor.classList.add(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.AllDefaultTooltip`);
        anchor.removeEventListener("click", this.#resetListener);
      }
      anchor.dataset.tooltip = tooltip;
    }
    if (opt.groups && group) {
      const anchor = htmlQuery(this.section, `a[data-reset-type="group"][data-reset="${group}"]`);
      //groups might not have anchors if none of their settings are resettable
      if (anchor) {
        const groupSavedResettables = savedResettables.filter((s) => s.group === group);
        const groupFormResettables = formResettables.filter((s) => s.group === group);
        let tooltip = "";
        if (groupSavedResettables.length > 0) {
          anchor.classList.remove(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.SavedTooltip`, { count: groupSavedResettables.length });
          anchor.addEventListener("click", this.#resetListener);
          if (groupFormResettables.length > 0) {
            tooltip += mhlocalize(`MHL.SettingsManager.Reset.Group.FormTooltipAppend`, {
              count: groupFormResettables.length,
            });
          }
        } else if (groupFormResettables.length > 0) {
          anchor.classList.remove(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.FormTooltipSolo`, {
            count: groupFormResettables.length,
          });
          anchor.addEventListener("click", this.#resetListener);
        } else {
          anchor.classList.add(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.AllDefaultTooltip`);
          anchor.removeEventListener("click", this.#resetListener);
        }
        anchor.dataset.tooltip = tooltip;
      }
    }
    if (opt.settings) {
      const anchor = htmlQuery(this.section, `a[data-reset-type="setting"][data-reset="${key}"]`);
      if (!anchor) return; // defaultless inputs still have change listeners
      const savedResettable = savedResettables.find((s) => s.key === key);
      const formResettable = formResettables.find((s) => s.key === key);
      let tooltip = "";
      if (savedResettable) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.SavedTooltip`);
        anchor.addEventListener("click", this.#resetListener);
        if (formResettable) {
          tooltip += mhlocalize(`MHL.SettingsManager.Reset.Setting.FormTooltipAppend`);
        }
      } else if (formResettable) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.FormTooltipSolo`);
        anchor.addEventListener("click", this.#resetListener);
      } else {
        anchor.classList.add(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.IsDefaultTooltip`);
        anchor.removeEventListener("click", this.#resetListener);
      }
      anchor.dataset.tooltip = tooltip;
    }
  }

  #_value(input) {
    //grr checkboxen
    if (input?.type === "checkbox") return input.checked;
    const value = input.value;
    if (input?.dataset?.dtype === "Number") {
      if (value === "" || value === null) return null;
      return Number(value);
    }
    return value;
  }

  #setInputValues(div, value) {
    const func = `${funcPrefix}##setInputValues`;
    if (!this.section) return;
    if (typeof div === "string" && this.#requireSetting(div, { func })) {
      div = this.#settings.get(div).div;
    }
    const inputs = htmlQueryAll(div, "input, select");
    for (const input of inputs) {
      //grr checkboxen
      if (input.nodeName === "INPUT" && input.type === "checkbox") {
        input.checked = value;
      }
      if (input.type === "range") {
        const span = htmlQuery(div, "span.range-value");
        if (span) span.innerText = value;
      }
      input.value = value;
      input.dispatchEvent(new Event("change")); //to force visibility updates
    }
  }

  #getFormValues() {
    if (!this.section) return;
    return this.#settings.reduce((acc, setting) => {
      if (setting.formValue) {
        acc[setting.key] = setting.formValue;
      }
      return acc;
    }, {});
  }

  #prettifyValue(value) {
    return typeof value === "object" ? JSON.stringify(value, null, 2) : value;
  }

  #getSettingKeyFromString(string) {
    //todo: remember why bailing on null is important
    if (isEmpty(string)) return null;
    string = this.#logCastString(string, "string", `${funcPrefix}##getSettingKeyFromString`);
    // return everything after the first .
    return string.split(/\.(.*)/)[1];
  }

  #getSettingKeyFromElement(el, dataKey = "settingId") {
    const func = `${funcPrefix}##getSettingKeyFromElement`;
    //todo: localize
    if (!(el instanceof HTMLElement)) throw this.#error("expected an element", { log: { div: el }, func });
    return this.#getSettingKeyFromString(el.dataset?.[dataKey] ?? htmlQuery(el, "button[data-key]")?.dataset?.key);
  }

  #expandPartialGroupName(group) {
    // we know the null group will always exist
    if (group === null) return null;
    group = this.#logCastString(group, "group", `${funcPrefix}##expandPartialGroupName`);
    if (!group.startsWith(".")) return group;
    return `${this.#options.settingPrefix}${this.#options.groupInfix}${group}`;
  }

  static validateIcons() {
    for (const manager of MHLSettingsManager.managers) {
      manager.#validateIcons();
    }
  }

  #validateIcons() {
    //logging for failure happens in the getIcon* functions
    for (const setting of this.#settings) {
      if (setting.menu && "icon" in setting) {
        setting.icon = getIconClasses(setting.icon) ?? CONFIG.MHL.fallbackIcon;
      }
      if ("button" in setting && "icon" in setting.button) {
        setting.button.icon = getIconHTMLString(setting.button.icon);
      }
    }
    if (typeof this.#options.groups.accordionIndicator === "string") {
      this.#options.groups.accordionIndicator = getIconClasses(this.#options.groups.accordionIndicator);
    }
    if (!isEmpty(this.#options.groups?.overrides)) {
      const or = this.#options.groups.overrides;
      for (const group in or) {
        if (typeof or[group]?.accordionIndicator === "string") {
          or[group].accordionIndicator = getIconClasses(or[group].accordionIndicator);
        }
      }
    }
  }

  #validateEnrichHintsOption() {
    const func = `${funcPrefix}##validateEnrichHintsOption`;
    let enrichers = deeperClone(this.#options.enrichHints);
    const badEnrichers = () => {
      this.#log(
        { enrichHints: this.#options.enrichHints },
        { func, prefix: `MHL.SettingsManager.Error.InvalidEnrichHintsOption` }
      );
      return false;
    };
    if (typeof enrichers === "boolean") return true;
    if (!Array.isArray(enrichers)) {
      if (enrichers instanceof Map) {
        enrichers = Array.from(enrichers);
      } else if (typeof enrichers === "object") {
        enrichers = Object.entries(enrichers);
      } else {
        return badEnrichers();
      }
    }
    if (
      !enrichers.every(
        (e) =>
          e.length === 2 &&
          (e[0] instanceof RegExp || typeof e[0] === "string") &&
          ["function", "string"].includes(typeof e[1])
      )
    ) {
      return badEnrichers();
    }
    for (const [pattern, replacement] of enrichers) {
      this.#enrichers.set(pattern, replacement);
    }
    return true;
  }

  #processGroupsOption() {
    const func = `${funcPrefix}##processGroupsOption`;
    const groups = deeperClone(this.#options.groups);
    const defaults = deeperClone(this.defaultOptions.groups);
    //todo: see if you can actually handle this as a data model in a way you like
    const overrideValidation = {
      accordionIndicator: (v) => ["boolean", "string"].includes(typeof v),
      animated: (v) => typeof v === "boolean",
      collapsible: (v) => typeof v === "boolean",
      classes: (v) => Array.isArray(v) && v.every((e) => typeof e === "string"),
    };
    const validation = {
      accordionIndicator: (v) => ["boolean", "string"].includes(typeof v),
      animated: (v) => typeof v === "boolean",
      collapsible: (v) => typeof v === "boolean",
      sort: (v) => typeof v === "function" || (Array.isArray(v) && v.every((e) => typeof e === "string")),
      classes: (v) => Array.isArray(v) && v.every((e) => typeof e === "string"),
      overrides: (v) => isPlainObject(v),
    };
    if (!groups) return groups;
    if (groups === true) return defaults;
    if (groups === "a") {
      defaults.sort = localeSort;
      return defaults;
    }
    if (isPlainObject(groups)) {
      //if all the provided keys are default, just use defaults
      if (Object.entries(groups).every(([key, value]) => value === defaults[key])) return defaults;
      const invalidKeys = getInvalidKeys(groups, defaults);
      if (invalidKeys.length) this.#logInvalidOptionKeys(invalidKeys, "groups", func);
      const out = filterObject(groups, defaults, { recursive: false });
      for (const key in out) {
        if (!validation[key](out[key])) {
          this.#logInvalidOptionValue(key, out[key], defaults[key], "groups", func);
          out[key] = defaults[key];
        }
        //special handling
        if (Array.isArray(out.sort)) {
          out.sort = generateSorterFromOrder(out.sort);
        }
      }
      if (!isEmpty(out.overrides)) {
        const validOverrides = {};
        for (const group in out.overrides) {
          const expanded = this.#expandPartialGroupName(group);
          const invalidKeys = getInvalidKeys(out.overrides[group], overrideValidation);
          if (invalidKeys.length) this.#logInvalidOptionKeys(invalidKeys, `group.overrides["${group}"]`, func);
          const groupOut = filterObject(out.overrides[group], overrideValidation);
          for (const overrideKey in groupOut) {
            if (!overrideValidation[overrideKey](groupOut[overrideKey])) {
              this.#log(
                { key: overrideKey, value: groupOut[overrideKey] },
                {
                  softType: "warn",
                  func,
                  prefix: "MHL.SettingsManager.Error.InvalidGroupOverrideOptionValue",
                  context: { group, key: overrideKey },
                }
              );
              delete groupOut[overrideKey];
            }
          }
          if (Object.keys(groupOut).length > 0) validOverrides[expanded] = groupOut;
        }
        out.overrides = validOverrides;
      }
      // at least one valid key was passed, use defaults for rest
      if (Object.keys(out).length > 0) return fu.mergeObject(defaults, out, { inplace: false });
    }
    this.#logInvalidOptionData(groups, "groups", func);
    return defaults;
  }

  #validateRegistrationData(data) {
    const func = `${funcPrefix}##validateRegistrationData`;
    if (typeof data === "function") data = data();
    //todo: figure out why isEmpty chokes when this is a Collection
    const registerable = new Map();
    if (Array.isArray(data)) {
      for (const setting of data) {
        if (!isPlainObject(setting) || typeof setting.key !== "string") {
          this.#log({ setting }, { type: "error", func, prefix: `MHL.SettingsManager.Error.InvalidSettingArrayEntry` });
          continue;
        }
        registerable.set(setting.key, setting);
      }
    }
    const entries = isPlainObject(data) ? Object.entries(data) : data instanceof Map ? [...data.entries()] : [];
    for (const [key, value] of entries) {
      if (!this.#validateSettingKey(key)) continue;
      if (registerable.has(key)) {
        this.#log("MHL.SettingsManager.Error.DuplicateSettingKey", {
          type: "error",
          func,
          context: { key },
        });
        continue;
      }
      registerable.set(key, value);
    }
    if (isEmpty(registerable)) {
      this.#log(
        { data },
        {
          type: "error",
          prefix: `MHL.SettingsManager.Error.NoValidSettings`,
          func,
        }
      );
      return false;
    }
    return registerable;
  }

  #processResetButtonsOption() {
    const func = `${funcPrefix}##processResetButtonsOption`;
    const defaults = deeperClone(this.defaultOptions.resetButtons);
    let rb = deeperClone(this.#options.resetButtons);
    //no reset buttons
    if (rb === false) return defaults;
    // all reset buttons, use icons from manager-defaults setting
    if (rb === true) return Object.fromEntries(Object.entries(defaults).map((e) => [e[0], true]));
    // arrays get transformed but then validated as objects
    if (Array.isArray(rb) && rb.every((s) => typeof s === "string"))
      rb = rb.reduce((acc, curr) => {
        acc[curr] = true;
        return acc;
      }, {});
    if (isPlainObject(rb)) {
      //if all the provided keys are default, just use defaults
      if (Object.entries(rb).every(([key, value]) => value === defaults[key])) return defaults;
      const invalidKeys = getInvalidKeys(rb, defaults);
      if (invalidKeys.length) this.#logInvalidOptionKeys(invalidKeys, "resetButtons", func);
      const out = filterObject(rb, defaults);
      for (const key in out) {
        // each key for this option shares the same validation criteria
        if (!["boolean", "string"].includes(typeof out[key])) {
          this.#logInvalidOptionValue(key, out[key], defaults[key], "sort", func);
          out[key] = defaults[key];
        }
      }
      if (Object.keys(out).length > 0) {
        out.disabledClass ??= true;
        return out;
      }
    }
    this.#logInvalidOptionData(rb, "resetButtons", func);
    return defaults;
  }

  #validateSettingKey(key) {
    if (typeof key !== "string") {
      this.#log("MHL.SettingsManager.Error.InvalidSettingKey", {
        type: "error",
        func,
        context: { key },
      });
      return false;
    }
    return true;
  }

  #processSortOption() {
    const func = `${funcPrefix}##processSortOption`;
    const sort = deeperClone(this.#options.sort);
    const defaults = deeperClone(this.defaultOptions.sort);
    const validation = {
      fn: (v) => typeof v === "function",
      menusFirst: (v) => typeof v === "boolean",
    };
    // no sorting beyond core's
    if (sort === false) return defaults;
    // no sorting at all, not even rendering menus first like core
    if (sort === null) return { menusFirst: false, fn: nullSort };
    // alphasort, menus first like core
    if (sort === true || sort === "a") return { menusFirst: true, fn: localeSort };
    // custom sort, but menus first like core
    if (typeof sort === "function") return { menusFirst: true, fn: sort };
    if (isPlainObject(sort)) {
      //if all the provided keys are default, just use defaults
      if (Object.entries(sort).every(([key, value]) => value === defaults[key])) return defaults;
      const invalidKeys = getInvalidKeys(sort, defaults);
      if (invalidKeys.length) this.#logInvalidOptionKeys(invalidKeys, "sort", func);
      const out = filterObject(sort, defaults);
      for (const key in out) {
        // test each key against its validator
        if (!validation[key](out[key])) {
          this.#logInvalidOptionValue(key, out[key], defaults[key], "sort", func);
          out[key] = defaults[key];
        }
      }
      // at least one valid key was passed, use defaults for rest
      if (Object.keys(out).length > 0) return fu.mergeObject(defaults, out, { inplace: false });
    }
    this.#logInvalidOptionData(sort, "sort", func);
    return defaults;
  }

  #error(errorstr, options = {}) {
    const opts = fu.mergeObject(
      options,
      {
        mod: this.#options.modPrefix,
        context: {
          module: this.#module.title,
        },
      },
      { inplace: false }
    );
    return modError(errorstr, opts);
  }

  #log(loggable, options = {}) {
    const opts = fu.mergeObject(
      options,
      {
        mod: this.#options.modPrefix,
        context: {
          module: this.#module.title,
        },
      },
      { inplace: false }
    );
    modLog(loggable, opts);
  }

  #requireSetting(key, { func = null, potential = false, errorstr = null, context = {} } = {}) {
    errorstr ??= `MHL.SettingsManager.Error.NotRegistered`;
    if (!this.has(key, { potential })) {
      this.#log(
        { key },
        {
          type: "error",
          context: { key, ...context },
          prefix: errorstr,
          func,
        }
      );
      return false;
    }
    return true;
  }

  #logCastString(variable, name, func) {
    return logCastString(variable, name, { func, mod: this.#options.modPrefix });
  }

  #logInvalidOptionData(data, option, func) {
    this.#log(
      { [option]: data },
      { softType: "error", func, prefix: `MHL.SettingsManager.Error.InvalidOptionData`, context: { option } }
    );
  }

  #logInvalidOptionValue(key, value, def, option, func) {
    this.#log(
      { key, value, default: def },
      {
        softType: "warn",
        prefix: "MHL.SettingsManager.Error.InvalidOptionValue",
        context: { key, option, default: def },
        func,
      }
    );
  }

  #logInvalidOptionKeys(keys, option, func) {
    this.#log(
      { keys },
      {
        softType: "warn",
        prefix: `MHL.SettingsManager.Error.InvalidOptionKeys`,
        context: { keys: keys.join(", "), option },
        func,
      }
    );
  }
}

const PREFIX = `MHL.Setting.ManagerDefaults`;

class SettingManagerDefaults extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      disabledClass: new fields.StringField({
        required: true,
        nullable: false,
        initial: "disabled-transparent",
        label: `${PREFIX}.DisabledClass.Label`,
        hint: `${PREFIX}.DisabledClass.Hint`,
        choices: () => CONFIG.MHL.disabledClasses,
        group: ".CSS",
      }),
      accordionIndicatorIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "fa-chevron-down",
        label: `${PREFIX}.AccordionIndicatorIcon.Label`,
        hint: `${PREFIX}.AccordionIndicatorIcon.Hint`,
      }),
      moduleResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: () => (AIF() ? "mdi-reply-all" : "fa-reply-all"),

        label: `${PREFIX}.ModuleResetIcon.Label`,
        hint: `${PREFIX}.ModuleResetIcon.Hint`,
      }),
      groupResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: () => (AIF() ? "mdi-reply" : "fa-reply"),
        label: `${PREFIX}.GroupResetIcon.Label`,
        hint: `${PREFIX}.GroupResetIcon.Hint`,
      }),
      settingResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: () => (AIF() ? "mdi-restore" : "fa-arrow-rotate-left"),
        label: `${PREFIX}.SettingResetIcon.Label`,
        hint: `${PREFIX}.SettingResetIcon.Hint`,
      }),
    };
  }
}

const SETTINGS = () => ({
  "manager-defaults": {
    type: SettingManagerDefaults,
    config: false,
    group: ".SettingsManager",
    scope: "world",
    default: getModelDefaults(SettingManagerDefaults),
  },
  "manager-defaults-menu": {
    type: MHLManagerDefaultsMenu,
    name: true,
    hint: true,
    label: true,
    icon: "icons",
    group: ".SettingsManager",
    for: "manager-defaults",
  },
  "debug-mode": {
    config: true,
    type: Boolean,
    name: true,
    hint: true,
    scope: "client",
    group: ".ErrorHandling",
    default: false,
  },
  "log-level": {
    config: true,
    type: String,
    name: true,
    hint: true,
    choices: {
      debug: true,
      info: true,
      warn: true,
      error: true,
    },
    default: "warn",
    scope: "client",
    group: ".ErrorHandling",
  },
  "global-access": {
    config: true,
    default: true,
    type: Boolean,
    hint: true,
    name: true,
    scope: "world",
    onChange: (value) => {
      if (!!value) globalThis.mhl = MHL();
      else delete globalThis.mhl;
    },
    group: ".Access",
  },
  "legacy-access": {
    config: true,
    default: false,
    type: Boolean,
    hint: true,
    name: true,
    scope: "world",
    onChange: (value) => {
      if (value) game.pf2emhl = MHL();
      else delete game.pf2emhl;
    },
    group: ".Access",
  },
  "aif-enabled": {
    config: false,
    type: Boolean,
    scope: "world",
  },
});

function setting(key) {
  const SM = MHLSettingsManager.managers.get(MODULE_ID);
  if (SM?.initialized) {
    return SM.get(key);
  }
  return undefined;
}

function log(loggable, { type, prefix } = {}) {
  const func = "log";
  const defaultType = "log";
  type = String(type ?? defaultType);
  prefix = String(prefix ?? "");
  if (!CONSOLE_TYPES.includes(type)) {
    mhlog$1(`MHL.Warning.Fallback.LogType`, {
      func,
      context: { type, defaultType },
    });
    type = defaultType;
  }
  console[type](prefix.trim(), loggable);
}
function warn$1(loggable, prefix = "") {
  log(loggable, { type: "warn", prefix });
}
function debug(loggable, prefix = "") {
  log(loggable, { type: "debug", prefix });
}
function error$1(loggable, prefix = "") {
  log(loggable, { type: "error", prefix });
}
function modLog(loggable, { type, prefix, context, func, mod, localize = true, dupe = false, softType } = {}) {
  if (isEmpty(type) || typeof type !== "string") {
    // if type is not provided or bad, and we're not in debug mode, bail.
    if (!setting("debug-mode") && !softType) return;
    type = setting("log-level") ?? softType;
  }
  if (typeof loggable === "string") {
    loggable = localize ? mhlocalize(loggable, context) : loggable;
    prefix = getLogPrefix(loggable, { mod, func, prefix });
  } else if (localize && prefix) {
    let localized = mhlocalize(prefix, context);
    prefix = getLogPrefix(localized, { mod, func }) + localized;
  } else {
    prefix = getLogPrefix("", { mod, func, prefix });
  }
  log(dupe ? deeperClone(loggable) : loggable, { type, prefix });
}

function mhlog$1(loggable, options = {}) {
  options.mod = "MHL";
  modLog(loggable, options);
}

function localizedBanner(text, options = {}) {
  const func = "localizedBanner";
  const defaultType = "info";
  let { context, prefix, type, console: doConsole, permanent, log: loggable } = options;
  prefix = String(prefix ?? "");
  type = String(type ?? "");
  console ??= false;
  permanent ??= false;
  if (!BANNER_TYPES.includes(type)) {
    mhlog$1(`MHL.Warning.Fallback.BannerType`, { type: "warn", func, context: { type, defaultType } });
    type = defaultType;
  }
  if (typeof text !== "string") {
    mhlog$1(`MHL.Warning.Fallback.Type`, {
      func,
      context: { arg: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  let bannerstr = prefix + mhlocalize(text, context);
  if (!game.ready) {
    console.error(mhlocalize(`MHL.Error.TooEarlyForBanner`, { type, bannerstr }));
  } else {
    ui.notifications[type](bannerstr, { console: doConsole, permanent });
  }
  if (typeof log === "object" && Object.keys(log).length) log(loggable, { type, prefix });
}

function modBanner(text, options = {}) {
  let { context, prefix, type, console, permanent, log, func, mod, softType } = options;
  if (isEmpty(type) || typeof type !== "string") {
    // if type is not provided, and we're passed setup and not in debug mode, bail.
    if (!setting("debug-mode") && !softType) return;
    // if we're logging before setup, assume error if no softType
    type = setting("log-level") ?? softType ?? "error";
  }
  prefix = getLogPrefix(text, { mod, func, prefix });
  options.prefix = prefix;
  if (typeof log === "object" && Object.keys(log).length) modLog(log, options);
  localizedBanner(text, { context, prefix, type, console, permanent });
}

function MHLBanner(text, options = {}) {
  options.mod = "MHL";
  modBanner(text, options);
}

function localizedError(text, options = {}) {
  const func = "localizedError";
  let { context, banner, prefix, permanent, log } = options;
  banner ??= false;
  prefix = String(prefix ?? "");
  permanent ??= false;
  if (typeof text !== "string") {
    mhlog$1(`MHL.Warning.Fallback.Type`, {
      func,
      context: { arg: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  const errorstr = prefix + mhlocalize(text, context);
  if (banner) localizedBanner(errorstr, { type: "error", console: false, permanent });
  if (typeof log === "object" && Object.keys(log).length) log(log, { type: "error", prefix });
  return Error(errorstr);
}

function modError(text, options = {}) {
  let { context, banner, prefix, log, func, permanent, mod } = options;
  banner ??= true;
  prefix = getLogPrefix(text, { prefix, mod, func });
  if (typeof log === "object" && Object.keys(log).length) modLog(log, { type: "error", prefix });
  if (banner && game.ready) modBanner(text, { context, prefix, type: "error", permanent, console: false });
  return localizedError(text, { context, prefix, type: "error", banner: false });
}

function MHLError(text, options = {}) {
  options.mod = "MHL";
  return modError(text, options);
}

function isPF2e() {
  return game.system.id === "pf2e";
}

function requireSystem(system, prefix = null) {
  //todo: add min/max version options
  if (game.system.id !== system)
    throw localizedError(`MHL.Error.RequiresSystem`, { context: { system }, prefix, banner: true });
}

function getLogPrefix(text, { prefix, mod, func } = {}) {
  let out = "";
  text = logCastString(text, "text", { func: "getLogPrefix", mod });
  mod = String(mod ?? "");
  func = String(func ?? "");
  prefix = String(prefix ?? "");
  if (mod && !text.startsWith(`${mod} |`)) out += `${mod} | `;
  if (func && !text.includes(`${func} |`)) out += `${func} | `;
  if (prefix) out += prefix;
  return out;
}
function logCastString(variable, name, { func = null, mod = "MHL" } = {}) {
  return logCast(variable, name, { type: String, func, mod });
}
function logCastNumber(variable, name, { func = null, mod = "MHL" } = {}) {
  return logCast(variable, name, { type: Number, func, mod });
}
function logCastBool(variable, name, { func = null, mod = "MHL" } = {}) {
  return logCast(variable, name, { type: Boolean, func, mod });
}
function logCast(variable, name, { type = String, func = null, mod = "MHL" } = {}) {
  type = typeof type === "function" ? type : globalThis[String(type)] ?? null;
  if (!type) return variable; //todo: logging lol
  const targetType = type.name.toLowerCase();
  if (typeof variable !== targetType) {
    debugger;
    modLog(
      { [name]: variable },
      {
        mod,
        prefix: `MHL.Warning.Fallback.Type`,
        func,
        context: { arg: name, type: typeof variable, expected: targetType },
      }
    );
    return type(variable);
  }
  return variable;
}

function chatLog(loggable, options) {
  //todo: improve
  getDocumentClass("ChatMessage").create({
    content: `<pre>${JSON.stringify(loggable, null, 2)}</pre>`,
  });
}

function levelBasedDC(level) {
  const func = "levelBasedDC";
  if (typeof level !== "number") {
    throw MHLError(`MHL.Error.Type.Number`, { context: { arg: "level" }, func, log: { level } });
  }
  const DCByLevel = [
    14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50,
  ];
  let DC = 0;
  if (level >= DCByLevel.length || level < -1) {
    mhlog({ level }, { prefix: `MHL.Warning.Fallback.LevelOutOfBounds`, func });
    level = 26;
  }
  if (level === -1) {
    DC = 13;
  } else {
    DC = DCByLevel[level];
  }
  return DC;
}

async function setInitiativeStatistic(actor, statistic = "perception") {
  return await actor.update({
    "system.initiative.statistic": statistic,
  });
}

async function pickItemFromActor$1(
  actor,
  { itemType = null, otherFilter = null, held = false, title = null, dialogOptions = {}, errorIfEmpty = true } = {}
) {
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
async function getAllFromAllowedPacks({
  type = "equipment",
  fields = [],
  filter = null,
  strictSourcing = true,
  fetch = false,
} = {}) {
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
    throw MHLError(`MHL.Error.Type.Function`, { context: { arg: "filter" }, func, log: { filter } });
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
  packList.filter(([_, p]) => !p.load).map(([pack]) => pack);
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

var pf2eHelpers = /*#__PURE__*/Object.freeze({
  __proto__: null,
  getAllFromAllowedPacks: getAllFromAllowedPacks,
  levelBasedDC: levelBasedDC,
  pickItemFromActor: pickItemFromActor$1,
  setInitiativeStatistic: setInitiativeStatistic
});

// thanks mdn
function randIntInRange(min,max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled); // The maximum is inclusive and the minimum is inclusive
}

function oneTargetOnly(options = {}) {
  let { user, useFirst, func } = options;
  const targets = anyTargets({ user, func });
  // if there were 0 targets it got caught by anyTargets
  const firstTarget = targets.first();
  if (targets.size > 1) {
    if (useFirst) {
      mhlog$1(`MHL.Warning.Fallback.FirstTarget`, { context: { name: firstTarget.name }, func });
    } else {
      throw MHLError(`MHL.Error.Target.NotOneTargetted`, { func });
    }
  }
  return firstTarget;
}
function anyTargets(options = {}) {
  let { user, func } = options;
  user ??= game.user;
  if (typeof user === "string") user = game.users.get(user) ?? game.users.getName(user);
  if (!(user instanceof User)) {
    throw MHLError(`MHL.Error.Type.User`, { context: { arg: "user" }, log: { user }, func });
  }
  if (user.targets.size === 0) {
    throw MHLError(`MHL.Error.Target.NotAnyTargetted`, { func });
  }
  return user.targets;
}

function oneTokenOnly(options = {}) {
  let { fallback, func, useFirst } = options;
  fallback ??= true;
  useFirst ??= false;
  const tokens = anyTokens({ fallback });
  //if it was 0 it got caught by anyTokens
  if (tokens.length > 1) {
    if (useFirst) {
      mhlog(`MHL.Warning.Fallback.FirstToken`, { context: { name: tokens[0].name }, func });
    } else {
      throw MHLError(`MHL.Error.Token.NotOneSelected`, { func });
    }
  }
  return tokens[0];
}
function anyTokens(options = {}) {
  let { fallback, func } = options;
  fallback ??= true;
  if (canvas.tokens.controlled.length === 0) {
    if (fallback && game.user.character) {
      const activeTokens = game.user.character.getActiveTokens();
      if (activeTokens.length) return activeTokens[0];
    }
    throw MHLError(`MHL.Error.Token.NotAnySelected`, {
      context: { fallback: fallback ? mhlocalize(`MHL.Error.Token.Fallback`) : "" },
      func,
    });
  }
  return canvas.tokens.controlled;
}

var helpers = /*#__PURE__*/Object.freeze({
  __proto__: null,
  MHLBanner: MHLBanner,
  MHLError: MHLError,
  activeRealGM: activeRealGM,
  anyTargets: anyTargets,
  anyTokens: anyTokens,
  applyOwnshipToFolderStructure: applyOwnshipToFolderStructure,
  chatLog: chatLog,
  createHTMLElement: createHTMLElement,
  debug: debug,
  deeperClone: deeperClone,
  doc: doc,
  elementFromString: elementFromString,
  error: error$1,
  escapeHTML: escapeHTML$1,
  filterObject: filterObject,
  generateSorterFromOrder: generateSorterFromOrder,
  getFunctionOptions: getFunctionOptions,
  getIDsFromFolder: getIDsFromFolder,
  getIconClasses: getIconClasses,
  getIconFontEntry: getIconFontEntry,
  getIconHTMLString: getIconHTMLString,
  getIconListFromCSS: getIconListFromCSS,
  getInvalidKeys: getInvalidKeys,
  getModelDefaults: getModelDefaults,
  getStringArgs: getStringArgs,
  htmlClosest: htmlClosest,
  htmlQuery: htmlQuery,
  htmlQueryAll: htmlQueryAll,
  isEmpty: isEmpty,
  isOwnedBy: isOwnedBy,
  isPF2e: isPF2e,
  isPlainObject: isPlainObject,
  isRealGM: isRealGM,
  isValidIcon: isValidIcon,
  localeSort: localeSort,
  localizedBanner: localizedBanner,
  localizedError: localizedError,
  log: log,
  logCast: logCast,
  logCastBool: logCastBool,
  logCastNumber: logCastNumber,
  logCastString: logCastString,
  mhlocalize: mhlocalize,
  mhlog: mhlog$1,
  modBanner: modBanner,
  modError: modError,
  modLog: modLog,
  mostDerivedClass: mostDerivedClass,
  nullSort: nullSort,
  oneTargetOnly: oneTargetOnly,
  oneTokenOnly: oneTokenOnly,
  oxfordList: oxfordList,
  pickAThingDialog: pickAThingDialog,
  prependIndefiniteArticle: prependIndefiniteArticle,
  randIntInRange: randIntInRange,
  requireSystem: requireSystem,
  signedInteger: signedInteger,
  sluggify: sluggify,
  systemhelpers_pf2e: pf2eHelpers,
  wait: wait,
  warn: warn$1
});

async function fascinatingPerformance() {
  const func = `fascinatingPerformance`;
  requireSystem("pf2e", `MHL | ${func}`);
  const token = oneTokenOnly();
  const actor = token.actor;

  const feat = actor.items.find((f) => f.slug === "fascinating-performance");
  if (!feat) {
    throw MHLError(`MHL.Macro.FascinatingPerformance.Error.MustHaveFeat`);
  }
  const targets = anyTargets({ func });

  const prfRank = actor.skills.performance.rank;
  switch (prfRank) {
    case 0:
      throw MHLError(`MHL.Macro.FascinatingPerformance.Error.MinimumTrained`);
    case 1:
      if (targets.size > 1) throw MHLError(`MHL.Macro.FascinatingPerformance.Error.SingleTargetOnly`);
      break;
    case 2:
      if (targets.size > 4) throw MHLError(`MHL.Macro.FascinatingPerformance.Error.FourTargetsOnly`);
      break;
    case 3:
      if (targets.size > 10) throw MHLError(`MHL.Macro.FascinatingPerformance.Error.TenTargetsOnly`);
      break;
    case 4:
      break;
    default:
      throw MHLError(`MHL.Error.Generic`);
  }
  let singleTarget = targets.size === 1;

  Handlebars.registerHelper("dosTable", (value, property = "label") => {
    const dosTable = [
      {
        color: "var(--degree-critical-failure, rgb(255, 0, 0))",
        label: "Critical Failure",
      },
      {
        color: "var(--degree-failure, rgb(255, 69, 0))",
        label: "Failure",
      },
      {
        color: "var(--degree-success, rgb(0, 0, 255))",
        label: "Success",
      },
      {
        color: "var(--degree-critical-success, rgb(0, 128, 0))",
        label: "Critical Success",
      },
    ];
    if (!["color", "label"].includes(property)) property = "label";
    return getProperty(dosTable[value], property);
  });

  const contentTemplate = `
  <div class="pf2e chat-card action-card">
  {{#if showPanache}}
    <section class="roll-note">
      <strong>Battledancer</strong>
      You gain @UUID[Compendium.pf2e.feat-effects.Item.uBJsxCzNhje8m8jj]
    </section>
  {{/if}}
  {{#if showFascinated}}
    <section class="roll-note">
      Noted targets become @UUID[Compendium.pf2e.conditionitems.Item.AdPVz7rbaVSRxHFg] for 1 round
    </section>
  {{/if}}

  {{#each targets as |target|}}
    {{log target}}
    <div data-actor-id="{{target.id}}">
      {{target.name}}: <span style='color: {{dosTable target.dos "color"}};'>{{dosTable target.dos "label"}}</span><br />
      DC: {{target.dc}} Total: {{target.rollTotal}} Fascinated: {{#if target.fascinated}}Yes{{else}}No{{/if}}
    </div>
  {{/each}}

  </div>
  `;
  const flavorTemplate = `
  <h4 class="action">
    <span class="action-glyph">1</span>
    Fascinating Performance: <i class="fa-solid fa-dice-d20"></i><span {{#unless (isNullish d20dos)}}style="color: {{dosTable d20dos "color"}}"{{/unless}}>{{d20}}</span>
  </h4>
  `;
  const compiledContentTemplate = Handlebars.compile(contentTemplate);
  const compiledFlavorTemplate = Handlebars.compile(flavorTemplate);

  //super janky hack to force the same d20 roll for all targets
  const d20 = (await new Roll("1d20").evaluate()).total;

  const ruleToAdd = {
    key: "SubstituteRoll",
    selector: "performance",
    value: d20,
    required: true,
  };
  const originalRules = deepClone(feat.system.rules);
  const rules = deepClone(originalRules);
  rules.push(ruleToAdd);
  await feat.update({
    "system.rules": rules,
  });

  const isBattledancer = !!(actor.items.find((i) => i.slug === "battledancer") ?? false);
  const isFocusedFascinator = !!(actor.items.find((i) => i.slug === "focused-fascination") ?? false);

  const templateData = {
    showPanache: false,
    fascinated: false,
    targets: [],
    d20,
    d20dos: d20 === 1 ? 0 : d20 === 20 ? 3 : null,
  };
  try {
    for (const targetToken of targets) {
      const target = targetToken.actor;
      const immunityEffect = target.items.find(
        (i) => i.name.toLowerCase().includes("immun") && i.name.toLowerCase().includes("fascinating performance")
      );
      if (immunityEffect) {
        MHLBanner(`MHL.Macro.FascinatingPerformance.Warning.TargetImmune`, { context: { name: targetToken.name }, func });
        continue;
      }
      const extraRollOptions = [];
      if (targetToken.inCombat) {
        extraRollOptions.push("incapacitation");
      }
      const dc = target.saves.will.dc.value;
      const perfRoll = await actor.skills.performance.roll({
        async: true,
        createMessage: false,
        dc,
        item: feat,
        target,
        extraRollOptions,
      });

      const dos = perfRoll.degreeOfSuccess;
      if (dos > 1 && isBattledancer) {
        templateData.showPanache = true;
      }
      const inCombat = targetToken.inCombat && game.combat?.started;
      let thisTargetFascinated = false;
      if (
        dos === 3 || //either a crit success
        (dos === 2 && ((isFocusedFascinator && singleTarget) || !inCombat)) // or a regular success when that counts
      ) {
        templateData.showFascinated = true;
        thisTargetFascinated = true;
      }
      templateData.targets.push({
        name: targetToken.name,
        rollTotal: perfRoll.total,
        inCombat: targetToken.inCombat,
        dos,
        dc,
        id: target.id,
        fascinated: thisTargetFascinated,
      });
    }

    await ChatMessage.create({
      flavor: compiledFlavorTemplate(templateData),
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ token: token }),
      content: compiledContentTemplate(templateData),
    });
  } finally {
    await feat.update({
      "system.rules": originalRules,
    });
  }
}

async function dropHeldTorch() {
  const func = "dropHeldTorch";
  requireSystem("pf2e", `MHL | ${func}`);
  //Check for exactly one selected token
  const token = oneTokenOnly();
  if (!game.modules.get("item-piles")?.active)
    throw MHLError(`MHL.Macros.DropHeldTorch.Error.ItemPilesDependency`, { func });
  const held = token.actor.items.filter((i) => i.carryType === "held");
  //eventually want this to be a select held item dialog, hardcoding to Torch for now)
  const [torch] = held.filter((i) => i.name === "Torch");
  if (!torch) {
    ui.notifications.warn("Token has no held torches!");
    return;
  }
  const [removed] = await game.itempiles.API.removeItems(token.actor, [{ _id: torch.id, quantity: 1 }]);
  const droppeditem = removed.item;

  //fix the quantity
  droppeditem.system.quantity = 1;

  let lightupdate = {};
  //if the item emits light..
  const [lightrule] = droppeditem.system?.rules?.filter((r) => r.key === "TokenLight");
  if (lightrule) {
    //...and that light is controlled by a toggle...
    if (lightrule.predicate?.length === 1) {
      //..and that toggle is on the item itself... (opu = option predicated upon)
      const [opu] = droppeditem.system.rules.filter((r) => r.toggleable && r.option === lightrule.predicate[0]);
      //..and that toggle is currently on..
      if (opu && opu.value) {
        //..turn it off and add the light to the token
        token.actor.toggleRollOption(opu.domain, opu.option);
        lightupdate = lightrule.value;
      }
    } else {
      //no predicate, always-on light, apply to the token
      lightupdate = lightrule.value;
    }
  }
  const aOverrides = {
    // "img": "Assets/icons/painterly/haste-fire-3.png"
  };
  const tOverrides = {
    "texture.scaleX": 0.5,
    "texture.scaleY": 0.5,
    // "texture.src": "Assets/icons/painterly/haste-fire-3.png",
    light: lightupdate,
    "flags.pf2e.linkToActorSize": false,
    "flags.pf2e.autoscale": false,
    name: droppeditem.name,
  };
  const options = {
    position: {
      x: token.position.x,
      y: token.position.y,
    },
    actorOverrides: aOverrides,
    tokenOverrides: tOverrides,
    items: [droppeditem],
    itemPileFlags: {
      type: game.itempiles.pile_types.PILE,
      displayOne: false,
      showItemName: true,
      overrideSingleItemScale: false,
    },
  };
  await game.itempiles.API.createItemPile(options);

  ChatMessage.create({
    user: game.user.id,
    type: CONST.CHAT_MESSAGE_TYPES.IC,
    speaker: ChatMessage.getSpeaker(),
    content: `${token.name} has dropped their ${droppeditem.name}!`,
  });
  // const pactor = fromUuidSync(pile.actorUuid);
  // const ptoken = fromUuidSync(pile.tokenUuid);
  // await ptoken.update(tOverrides);
}

async function lashingCurrents() {
  const func = "lashingCurrents";
  requireSystem("pf2e", `MHL | ${func}`);
  const token = oneTokenOnly();
  const actor = token.actor;
  const FORBIDDEN_RUNES = ["bloodbane", "kinWarding"];
  const rules = [
    {
      key: "Strike",
      category: "simple",
      damage: {
        base: {
          damageType: "bludgeoning",
          dice: 1,
          die: "d4",
        },
      },
      slug: "lashing-currents",
      label: "Lashing Currents",
      group: "flail",
      traits: ["disarm", "finesse", "reach-10", "trip", "versatile-s"],
      img: "icons/magic/water/waves-water-blue.webp",
    },
  ];
  const existingLC = await pickItemFromActor$1(actor, {
    itemType: "weapon",
    otherFilter: (i) => i.system.rules.find((r) => r?.slug === "lashing-currents"),
    errorIfEmpty: false,
  });
  if (!existingLC) {
    const relicWeapon = await pickItemFromActor$1(actor, {
      held: true,
      itemType: "weapon",
    });
    if (!relicWeapon) throw MHLError(`MHL.Macro.LashingCurrents.Error.NoneSelected`, { func });
    rules.push({
      key: "Striking",
      selector: "lashing-currents-damage",
      value: relicWeapon.system.runes.striking,
    });
    rules.push({
      key: "WeaponPotency",
      selector: "lashing-currents-attack",
      value: relicWeapon.system.runes.potency,
    });
    for (const propRune of relicWeapon.system.runes.property) {
      if (FORBIDDEN_RUNES.includes(propRune)) continue;
      rules.push({
        key: "AdjustStrike",
        mode: "add",
        property: "property-runes",
        value: propRune,
        definition: ["item:slug:lashing-currents"],
      });
    }
    await relicWeapon.update({ "system.rules": rules.concat(relicWeapon.system.rules) });
  } else {
    const oldRules = existingLC.system.rules.filter(
      (r) =>
        !(
          r?.selector?.includes("lashing-currents") ||
          r?.definition?.[0]?.includes("lashing-currents") ||
          r?.slug === "lashing-currents"
        )
    );
    await existingLC.update({ "system.rules": oldRules });
    localizedBanner(`MHL.Macro.LashingCurrents.Info.Removing`, { context: { name: existingLC.name }, console: false });
  }
}

async function recoverOldLashingCurrents() {
  const func = "recoverOldLashingCurrents";
  requireSystem("pf2e", `MHL | ${func}`);
  const token = oneTokenOnly();
  const actor = token.actor;
  const existingLC = await pickItemFromActor(actor, {
    itemType: "weapon",
    otherFilter: (i) => i.flags.pf2e.isLashingCurrents,
    errorIfEmpty: false,
  });
  if (!existingLC) {
    throw MHLError("MHL.Macros.LashingCurrents.Error.NoExistingFound", { context: { name: token.name }, func });
  }
  let originalRelicWeaponData = JSON.parse(existingLC.flags.pf2e.originalRelicWeapon);

  originalRelicWeaponData.system.runes.potency = originalRelicWeaponData.system.potencyRune;
  delete originalRelicWeaponData.system.potencyRune;

  originalRelicWeaponData.system.runes.striking = originalRelicWeaponData.system.strikingRune;
  delete originalRelicWeaponData.system.strikingRune;

  originalRelicWeaponData.system.runes.property = [];
  for (let i = 1; i <= 4; i++) {
    const rune = originalRelicWeaponData.system[`propertyRune${i}`].value ?? null;
    if (!rune) continue;
    delete originalRelicWeaponData.system[`propertyRune${i}`];
    originalRelicWeaponData.system.runes.property.push(rune);
  }

  const [originalRelicWeapon] = await actor.createEmbeddedDocuments("Item", [originalRelicWeaponData]);
  await originalRelicWeapon.update({
    "system.equipped.carryType": existingLC.system.equipped.carryType,
    "system.equipped.handsHeld": existingLC.system.equipped.handsHeld,
  });
  await existingLC.delete();
}

async function updateInitiativeStatistics() {
  const func = "updateInitiativeStatistics";
  requireSystem("pf2e", `MHL | ${func}`);
  const tokens = anyTokens().filter(
    (t) => ["character", "npc"].includes(t.actor.type) && !t.actor.traits.intersects(new Set(["minion", "eidolon"]))
  );
  if (!tokens.length) throw MHLError(`MHL.Macro.UpdateInitiativeStatistics.Error.NoValidTokens`, { func });

  const renderCallback = (html) => {
    const allSelect = html.querySelector("select[name=all]");
    const actorSelects = Array.from(html.querySelectorAll("select:not([name=all])"));
    allSelect.addEventListener("change", (ev) => {
      let disabled = false;
      if (ev.target.value) disabled = true;
      for (const select of actorSelects) {
        select.disabled = disabled;
        select.dataset.tooltip = disabled ? mhlocalize(`MHL.Macro.UpdateInitiativeStatistics.DisabledTooltip`) : "";
      }
    });
  };

  const universalSkills = fu.deepClone(CONFIG.PF2E.skillList);
  delete universalSkills.lore; //remove the generic Lore entry
  const lores = {};

  const actorsData = tokens.reduce((actoracc, t) => {
    // handle the rare case of more than one linked token of the same actor
    if (actoracc.find((a) => a.uiid === t.actor.uuid)) return actoracc;
    actoracc.push({
      name: t.name,
      uuid: t.actor.uuid,
      skills: [["perception", { label: "PF2E.PerceptionLabel" }]]
        .concat(Object.entries(t.actor.skills).sort(([aslug, _], [bslug, __]) => aslug.localeCompare(bslug))) //do the sorting here so perception stays on top
        .map(([slug, statistic]) => [slug, statistic.label])
        .reduce((acc, [slug, label]) => {
          if (!(slug in universalSkills)) {
            lores[slug] ??= {
              label,
              count: 0,
            };
            lores[slug].count++;
          }
          acc[slug] = label;
          return acc;
        }, {}),
      current: t.actor.initiative.statistic.label,
    });
    return actoracc;
  }, []);

  const sharedLores = Object.entries(lores).reduce((acc, [slug, data]) => {
    if (data.count === tokens.length) {
      acc.push([slug, data.label]);
    }
    return acc;
  }, []);

  const allSharedSkills = Object.fromEntries(
    [["perception", "PF2E.PerceptionLabel"]].concat(
      Object.entries(universalSkills)
        .concat(sharedLores)
        .sort(([aslug, _], [bslug, __]) => aslug.localeCompare(bslug))
    )
  );

  const contentData = {
    allSharedSkills,
    actorsData,
  };
  const dialogData = {
    contentData,
    title: `Set Initiative Statistics`,
    content: `modules/${MODULE_ID}/templates/updateInitiativeStatistics.hbs`,
    buttons: {
      yes: {
        icon: "<i class='fas fa-check'></i>",
        label: `Apply Changes`,
        callback: MHLDialog.getFormData,
      },
      no: {
        icon: "<i class='fas fa-times'></i>",
        label: `Cancel Changes`,
        callback: () => false,
      },
    },
    close: () => null,
    default: "yes",
    render: renderCallback,
  };
  const dialogOptions = {
    classes: ["update-initiative-statistics"],
    width: "auto",
  };
  const response = await MHLDialog.wait(dialogData, dialogOptions);
  if (!response) return;
  const { all, ...data } = response;
  const actorUpdates = [];
  const synthUpdates = [];
  for (const actorData of actorsData) {
    const actor = fromUuidSync(actorData.uuid);
    const newStat = all || data[actorData.uuid];
    if (!newStat) continue;
    if (actorData.uuid.startsWith("Scene")) {
      synthUpdates.push(actor.update({ "system.initiative.statistic": newStat }));
    } else {
      actorUpdates.push({ _id: actor._id, "system.initiative.statistic": newStat });
    }
  }
  await Actor.updateDocuments(actorUpdates);
  await Promise.all(synthUpdates);
}

var macros = /*#__PURE__*/Object.freeze({
  __proto__: null,
  dropHeldTorch: dropHeldTorch,
  fascinatingPerformance: fascinatingPerformance,
  lashingCurrents: lashingCurrents,
  recoverOldLashingCurrents: recoverOldLashingCurrents,
  updateInitiativeStatistics: updateInitiativeStatistics
});

// export * from './PickAThingPrompt.mjs';

var apps = /*#__PURE__*/Object.freeze({
  __proto__: null,
  MHLDialog: MHLDialog,
  MHLManagerDefaultsMenu: MHLManagerDefaultsMenu,
  MHLSettingMenu: MHLSettingMenu
});

var util = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Accordion: Accordion,
  MHLSettingsManager: MHLSettingsManager
});

// Lifted and de-TSified from the pf2e system
class DataUnionField extends foundry.data.fields.DataField {
  constructor(fields, options) {
    super(options);
    this.fields = fields;
  }

  _cast(value) {
    if (typeof value === "string") value = value.trim();
    return value;
  }

  clean(value, options) {
    if (Array.isArray(value) && this.fields.some((f) => f instanceof foundry.data.fields.ArrayField)) {
      const arrayField = this.fields.find((f) => f instanceof foundry.data.fields.ArrayField);
      return arrayField?.clean(value, options) ?? value;
    }
    return super.clean(value, options);
  }

  validate(value, options) {
    for (const field of this.fields) {
      if (field.validate(value, options) instanceof foundry.data.validation.DataModelValidationFailure) {
        continue;
      } else if (field instanceof foundry.data.fields.StringField && typeof value !== "string") {
        continue;
      } else {
        return;
      }
    }
    return this.fields[0].validate(value, options);
  }

  initialize(value, model, options) {
    const field = this.fields.find((f) => !f.validate(value));
    return field?.initialize(value, model, options);
  }
}

class FunctionField extends foundry.data.fields.DataField {
  _validateType(value) {
    return typeof value === "function";
  }
  _cast(value) {
    // wrap in pointless arrow function so that DataModel#initalize doesn't run it when accessed by the getter
    return () => value;
  }
}

class GroupsOptionSortField extends FunctionField {
  _cast(value) {
    if (!value) return () => () => 0;
    if (value === true || value === "a") return () => localeSort;
    return () => value;
  }
}

var fields = /*#__PURE__*/Object.freeze({
  __proto__: null,
  DataUnionField: DataUnionField,
  FunctionField: FunctionField,
  GroupsOptionSortField: GroupsOptionSortField
});

var data = /*#__PURE__*/Object.freeze({
  __proto__: null,
  fields: fields
});

//the following are provided by pf2e at least, maybe other systems; only register if necessary
const pf2eReplacements = {
  add: (a, b) => Number(a) + Number(b),
  any: (...args) => args.slice(0, -1).some((a) => !!a),
  capitalize: (value) => String(value).capitalize(),
  coalesce: (...args) => args.find((a) => a !== undefined && a !== null) ?? null,
  disabled: (condition) => (condition ? "disabled" : ""),
  includes: (data, element) => {
    if (Array.isArray(data)) return data.includes(element);
    if (typeof data === "string") return data.includes(String(element));
    if (data instanceof Set) return data.has(element);
    if (isPlainObject(data) && (typeof element === "number" || typeof element === "string")) {
      return element in data;
    }
    return false;
  },
  isNullish: (value) => value === undefined || value === null,
  isNumber: (value) => typeof value === "number",
  
  lower: (str) => String(str).toLowerCase(),
  multiply: (a, b) => Number(a) * Number(b),
  nor: (...args) => !args.slice(0, -1).some((a) => !!a),
  pad: (value, length, character) => `${value}`.padStart(length, character),
  percentage: (value, max) => (Number(value) * 100) / Number(max),
  raw: function (options) {
    return options.fn(this);
  },
  signedInteger: (value, options) => {
    const number = Number(value) || 0;
    const emptyStringZero = !!options.hash.emptyStringZero;
    const zeroIsNegative = !!options.hash.zeroIsNegative;
    return signedInteger(number, { emptyStringZero, zeroIsNegative });
  },
  sluggify: (value) => sluggify(String(value)),
};
const mhlOriginals = {
  mhlocalize: (value, options) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    const data = options.hash;
    return new Handlebars.SafeString(mhlocalize(value, data));
  },
  mhlIsColor: (value) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    return /^#[a-f0-9]{6}$/i.test(value);
  },
  mhlYesOrNo: (value) => {
    return !!value ? mhlocalize("Yes") : mhlocalize("No");
  },
  mhlCheckOrX: (value) => {
    const type = !!value ? "check" : "xmark";
    return new Handlebars.SafeString(`<i class="fa-solid fa-square-${type}"></i>`);
  },
  mhlIcon: (...args) => {
    return new Handlebars.SafeString(getIconHTMLString(...args));
  },
  contains: (...args) => {
    const options = getFunctionOptions(args);
    const [haystack, ...needles] = args;
    if (isEmpty(haystack) || (!Array.isArray(haystack) && typeof haystack !== "string") || isEmpty(needles))
      return false;
    const fn = options.all ? "every" : "some";
    return needles[fn]((n) => haystack.includes(n));
  },
  // will replace pf2e's json helper in pf2e worlds, but if the 2nd property is omitted no behaviour changes 
  // so I'm doin it unless someone finds something it breaks
  json: (data, indent) => JSON.stringify(data, null, Number(indent)),
  // selectOptionsGrouped: (...args) => {
  //   const options = getFunctionOptions(args);
  //   const opts = args[0];
  //todo: finish
  // }
};
function registerHandlebarsHelpers() {
  //register originals
  Handlebars.registerHelper(mhlOriginals);

  //register various helpers conditionally
  for (const [name, func] of Object.entries(pf2eReplacements)) {
    if (!(name in Handlebars.helpers)) Handlebars.registerHelper(name, func);
  }
}

class IconFontsHandler {
  #validateList(entry, target) {
    const func = `IconFontsHandler##validateList`;
    const fail = (errorstr) => {
      mhlog$1({ entry }, { type: "error", prefix: errorstr, func });
      return false;
    };

    if (!isPlainObject(entry)) return fail("MHL.IconFontsHandler.Error.PlainObject");
    if (typeof entry.name !== "string" || target.find((e) => e.name === entry.name))
      return fail("MHL.IconFontsHandler.Error.UniqueNameRequired");
    if (!Array.isArray(entry.prefixes) || entry.prefixes.some((p) => target.flatMap((e) => e.prefixes).includes(p)))
      return fail("MHL.IconFontsHandler.Error.UniquePrefixRequired");
    entry.list ??= getIconListFromCSS(entry.name, entry.prefixes);
    if (!Array.isArray(entry.list) || !entry.list.every((e) => !!e && typeof e === "string"))
      return fail("MHL.IconFontsHandler.Error.NonEmptyListRequired");
    if (isPlainObject(entry.schema) && "glyph" in entry.schema && "value" in entry.schema.glyph)
      return fail(`MHL.Error.Validation.IconSchemaGlyphExact`);
    if ("sort" in entry && !Number.isInteger(entry.sort)) return fail("MHL.IconFontsHandler.Error.SortInteger");
    if (!("sort" in entry) || target.find((e) => e.sort === sort)) {
      mhlog$1(`MHL.IconFontsHandler.Fallback.Sort`, { type: "debug", context: { name: entry.name } });
      let sort = target.length * 5;
      while (target.find((e) => e.sort === sort)) sort += 5;
      entry.sort = sort;
    }
    return true;
  }

  set(target, name, value) {
    const numIdx = Number(name);
    if (Number.isInteger(numIdx)) {
      if (numIdx >= target.length && numIdx !== target.length) {
        name = target.length;
      } else {
        name = numIdx;
      }
      if (!this.#validateList(value, target)) {
        return false;
      }
    }
    return Reflect.set(target, name, value);
  }
}

const iconFontsDefaults = [
  {
    name: "fontawesome",
    prefixes: ["fa-"],
    aliases: {
      fas: "fa-solid",
      far: "fa-regular",
      fal: "fa-light",
      fat: "fa-thin",
      fad: "fa-duotone",
      fass: "fa-sharp fa-solid",
      fasr: "fa-sharp fa-regular",
      fasl: "fa-sharp fa-light",
      fast: "fa-sharp fa-thin",
      fasd: "fa-sharp fa-duotone",
      fab: "fa-brands",
    },
    schema: {
      fw: {
        pattern: "fw",
      },
      brands: {
        pattern: "brands",
      },
      sharp: {
        pattern: "sharp",
      },
      rotate: {
        pattern: "rotate-(90|180|270|by)"
      },
      flip: {
        pattern: "flip-(horizonal|vertical|both)"
      },
      style: {
        choices: ["solid", "regular", "duotone", "light", "thin"],
        required: true,
        default: "fa-solid",
      },
    },
  },
];
function generateDefaultConfig() {
  const config = {};
  Object.defineProperty(config, "iconFonts", {
    writable: false,
    configurable: false,
    value: new Proxy(new Array(), new IconFontsHandler()),
  });
  config.fallbackIcon = "fa-solid fa-question mhl-fallback-icon";
  config.disabledClasses = ["disabled-transparent", "disabled-hidden", "disabled-blurry"];
  return config;
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

/* eslint-disable no-multi-assign */

function deepFreeze(obj) {
  if (obj instanceof Map) {
    obj.clear =
      obj.delete =
      obj.set =
        function () {
          throw new Error('map is read-only');
        };
  } else if (obj instanceof Set) {
    obj.add =
      obj.clear =
      obj.delete =
        function () {
          throw new Error('set is read-only');
        };
  }

  // Freeze self
  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((name) => {
    const prop = obj[name];
    const type = typeof prop;

    // Freeze prop if it is an object or function and also not already frozen
    if ((type === 'object' || type === 'function') && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  });

  return obj;
}

/** @typedef {import('highlight.js').CallbackResponse} CallbackResponse */
/** @typedef {import('highlight.js').CompiledMode} CompiledMode */
/** @implements CallbackResponse */

class Response {
  /**
   * @param {CompiledMode} mode
   */
  constructor(mode) {
    // eslint-disable-next-line no-undefined
    if (mode.data === undefined) mode.data = {};

    this.data = mode.data;
    this.isMatchIgnored = false;
  }

  ignoreMatch() {
    this.isMatchIgnored = true;
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHTML(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * performs a shallow merge of multiple objects into one
 *
 * @template T
 * @param {T} original
 * @param {Record<string,any>[]} objects
 * @returns {T} a single new object
 */
function inherit$1(original, ...objects) {
  /** @type Record<string,any> */
  const result = Object.create(null);

  for (const key in original) {
    result[key] = original[key];
  }
  objects.forEach(function(obj) {
    for (const key in obj) {
      result[key] = obj[key];
    }
  });
  return /** @type {T} */ (result);
}

/**
 * @typedef {object} Renderer
 * @property {(text: string) => void} addText
 * @property {(node: Node) => void} openNode
 * @property {(node: Node) => void} closeNode
 * @property {() => string} value
 */

/** @typedef {{scope?: string, language?: string, sublanguage?: boolean}} Node */
/** @typedef {{walk: (r: Renderer) => void}} Tree */
/** */

const SPAN_CLOSE = '</span>';

/**
 * Determines if a node needs to be wrapped in <span>
 *
 * @param {Node} node */
const emitsWrappingTags = (node) => {
  // rarely we can have a sublanguage where language is undefined
  // TODO: track down why
  return !!node.scope;
};

/**
 *
 * @param {string} name
 * @param {{prefix:string}} options
 */
const scopeToCSSClass = (name, { prefix }) => {
  // sub-language
  if (name.startsWith("language:")) {
    return name.replace("language:", "language-");
  }
  // tiered scope: comment.line
  if (name.includes(".")) {
    const pieces = name.split(".");
    return [
      `${prefix}${pieces.shift()}`,
      ...(pieces.map((x, i) => `${x}${"_".repeat(i + 1)}`))
    ].join(" ");
  }
  // simple scope
  return `${prefix}${name}`;
};

/** @type {Renderer} */
class HTMLRenderer {
  /**
   * Creates a new HTMLRenderer
   *
   * @param {Tree} parseTree - the parse tree (must support `walk` API)
   * @param {{classPrefix: string}} options
   */
  constructor(parseTree, options) {
    this.buffer = "";
    this.classPrefix = options.classPrefix;
    parseTree.walk(this);
  }

  /**
   * Adds texts to the output stream
   *
   * @param {string} text */
  addText(text) {
    this.buffer += escapeHTML(text);
  }

  /**
   * Adds a node open to the output stream (if needed)
   *
   * @param {Node} node */
  openNode(node) {
    if (!emitsWrappingTags(node)) return;

    const className = scopeToCSSClass(node.scope,
      { prefix: this.classPrefix });
    this.span(className);
  }

  /**
   * Adds a node close to the output stream (if needed)
   *
   * @param {Node} node */
  closeNode(node) {
    if (!emitsWrappingTags(node)) return;

    this.buffer += SPAN_CLOSE;
  }

  /**
   * returns the accumulated buffer
  */
  value() {
    return this.buffer;
  }

  // helpers

  /**
   * Builds a span element
   *
   * @param {string} className */
  span(className) {
    this.buffer += `<span class="${className}">`;
  }
}

/** @typedef {{scope?: string, language?: string, children: Node[]} | string} Node */
/** @typedef {{scope?: string, language?: string, children: Node[]} } DataNode */
/** @typedef {import('highlight.js').Emitter} Emitter */
/**  */

/** @returns {DataNode} */
const newNode = (opts = {}) => {
  /** @type DataNode */
  const result = { children: [] };
  Object.assign(result, opts);
  return result;
};

class TokenTree {
  constructor() {
    /** @type DataNode */
    this.rootNode = newNode();
    this.stack = [this.rootNode];
  }

  get top() {
    return this.stack[this.stack.length - 1];
  }

  get root() { return this.rootNode; }

  /** @param {Node} node */
  add(node) {
    this.top.children.push(node);
  }

  /** @param {string} scope */
  openNode(scope) {
    /** @type Node */
    const node = newNode({ scope });
    this.add(node);
    this.stack.push(node);
  }

  closeNode() {
    if (this.stack.length > 1) {
      return this.stack.pop();
    }
    // eslint-disable-next-line no-undefined
    return undefined;
  }

  closeAllNodes() {
    while (this.closeNode());
  }

  toJSON() {
    return JSON.stringify(this.rootNode, null, 4);
  }

  /**
   * @typedef { import("./html_renderer").Renderer } Renderer
   * @param {Renderer} builder
   */
  walk(builder) {
    // this does not
    return this.constructor._walk(builder, this.rootNode);
    // this works
    // return TokenTree._walk(builder, this.rootNode);
  }

  /**
   * @param {Renderer} builder
   * @param {Node} node
   */
  static _walk(builder, node) {
    if (typeof node === "string") {
      builder.addText(node);
    } else if (node.children) {
      builder.openNode(node);
      node.children.forEach((child) => this._walk(builder, child));
      builder.closeNode(node);
    }
    return builder;
  }

  /**
   * @param {Node} node
   */
  static _collapse(node) {
    if (typeof node === "string") return;
    if (!node.children) return;

    if (node.children.every(el => typeof el === "string")) {
      // node.text = node.children.join("");
      // delete node.children;
      node.children = [node.children.join("")];
    } else {
      node.children.forEach((child) => {
        TokenTree._collapse(child);
      });
    }
  }
}

/**
  Currently this is all private API, but this is the minimal API necessary
  that an Emitter must implement to fully support the parser.

  Minimal interface:

  - addText(text)
  - __addSublanguage(emitter, subLanguageName)
  - startScope(scope)
  - endScope()
  - finalize()
  - toHTML()

*/

/**
 * @implements {Emitter}
 */
class TokenTreeEmitter extends TokenTree {
  /**
   * @param {*} options
   */
  constructor(options) {
    super();
    this.options = options;
  }

  /**
   * @param {string} text
   */
  addText(text) {
    if (text === "") { return; }

    this.add(text);
  }

  /** @param {string} scope */
  startScope(scope) {
    this.openNode(scope);
  }

  endScope() {
    this.closeNode();
  }

  /**
   * @param {Emitter & {root: DataNode}} emitter
   * @param {string} name
   */
  __addSublanguage(emitter, name) {
    /** @type DataNode */
    const node = emitter.root;
    if (name) node.scope = `language:${name}`;

    this.add(node);
  }

  toHTML() {
    const renderer = new HTMLRenderer(this, this.options);
    return renderer.value();
  }

  finalize() {
    this.closeAllNodes();
    return true;
  }
}

/**
 * @param {string} value
 * @returns {RegExp}
 * */

/**
 * @param {RegExp | string } re
 * @returns {string}
 */
function source(re) {
  if (!re) return null;
  if (typeof re === "string") return re;

  return re.source;
}

/**
 * @param {RegExp | string } re
 * @returns {string}
 */
function lookahead(re) {
  return concat('(?=', re, ')');
}

/**
 * @param {RegExp | string } re
 * @returns {string}
 */
function anyNumberOfTimes(re) {
  return concat('(?:', re, ')*');
}

/**
 * @param {RegExp | string } re
 * @returns {string}
 */
function optional(re) {
  return concat('(?:', re, ')?');
}

/**
 * @param {...(RegExp | string) } args
 * @returns {string}
 */
function concat(...args) {
  const joined = args.map((x) => source(x)).join("");
  return joined;
}

/**
 * @param { Array<string | RegExp | Object> } args
 * @returns {object}
 */
function stripOptionsFromArgs(args) {
  const opts = args[args.length - 1];

  if (typeof opts === 'object' && opts.constructor === Object) {
    args.splice(args.length - 1, 1);
    return opts;
  } else {
    return {};
  }
}

/** @typedef { {capture?: boolean} } RegexEitherOptions */

/**
 * Any of the passed expresssions may match
 *
 * Creates a huge this | this | that | that match
 * @param {(RegExp | string)[] | [...(RegExp | string)[], RegexEitherOptions]} args
 * @returns {string}
 */
function either(...args) {
  /** @type { object & {capture?: boolean} }  */
  const opts = stripOptionsFromArgs(args);
  const joined = '('
    + (opts.capture ? "" : "?:")
    + args.map((x) => source(x)).join("|") + ")";
  return joined;
}

/**
 * @param {RegExp | string} re
 * @returns {number}
 */
function countMatchGroups(re) {
  return (new RegExp(re.toString() + '|')).exec('').length - 1;
}

/**
 * Does lexeme start with a regular expression match at the beginning
 * @param {RegExp} re
 * @param {string} lexeme
 */
function startsWith(re, lexeme) {
  const match = re && re.exec(lexeme);
  return match && match.index === 0;
}

// BACKREF_RE matches an open parenthesis or backreference. To avoid
// an incorrect parse, it additionally matches the following:
// - [...] elements, where the meaning of parentheses and escapes change
// - other escape sequences, so we do not misparse escape sequences as
//   interesting elements
// - non-matching or lookahead parentheses, which do not capture. These
//   follow the '(' with a '?'.
const BACKREF_RE = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;

// **INTERNAL** Not intended for outside usage
// join logically computes regexps.join(separator), but fixes the
// backreferences so they continue to match.
// it also places each individual regular expression into it's own
// match group, keeping track of the sequencing of those match groups
// is currently an exercise for the caller. :-)
/**
 * @param {(string | RegExp)[]} regexps
 * @param {{joinWith: string}} opts
 * @returns {string}
 */
function _rewriteBackreferences(regexps, { joinWith }) {
  let numCaptures = 0;

  return regexps.map((regex) => {
    numCaptures += 1;
    const offset = numCaptures;
    let re = source(regex);
    let out = '';

    while (re.length > 0) {
      const match = BACKREF_RE.exec(re);
      if (!match) {
        out += re;
        break;
      }
      out += re.substring(0, match.index);
      re = re.substring(match.index + match[0].length);
      if (match[0][0] === '\\' && match[1]) {
        // Adjust the backreference.
        out += '\\' + String(Number(match[1]) + offset);
      } else {
        out += match[0];
        if (match[0] === '(') {
          numCaptures++;
        }
      }
    }
    return out;
  }).map(re => `(${re})`).join(joinWith);
}

/** @typedef {import('highlight.js').Mode} Mode */
/** @typedef {import('highlight.js').ModeCallback} ModeCallback */

// Common regexps
const MATCH_NOTHING_RE = /\b\B/;
const IDENT_RE = '[a-zA-Z]\\w*';
const UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
const NUMBER_RE = '\\b\\d+(\\.\\d+)?';
const C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
const BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
const RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

/**
* @param { Partial<Mode> & {binary?: string | RegExp} } opts
*/
const SHEBANG = (opts = {}) => {
  const beginShebang = /^#![ ]*\//;
  if (opts.binary) {
    opts.begin = concat(
      beginShebang,
      /.*\b/,
      opts.binary,
      /\b.*/);
  }
  return inherit$1({
    scope: 'meta',
    begin: beginShebang,
    end: /$/,
    relevance: 0,
    /** @type {ModeCallback} */
    "on:begin": (m, resp) => {
      if (m.index !== 0) resp.ignoreMatch();
    }
  }, opts);
};

// Common modes
const BACKSLASH_ESCAPE = {
  begin: '\\\\[\\s\\S]', relevance: 0
};
const APOS_STRING_MODE = {
  scope: 'string',
  begin: '\'',
  end: '\'',
  illegal: '\\n',
  contains: [BACKSLASH_ESCAPE]
};
const QUOTE_STRING_MODE = {
  scope: 'string',
  begin: '"',
  end: '"',
  illegal: '\\n',
  contains: [BACKSLASH_ESCAPE]
};
const PHRASAL_WORDS_MODE = {
  begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
};
/**
 * Creates a comment mode
 *
 * @param {string | RegExp} begin
 * @param {string | RegExp} end
 * @param {Mode | {}} [modeOptions]
 * @returns {Partial<Mode>}
 */
const COMMENT = function(begin, end, modeOptions = {}) {
  const mode = inherit$1(
    {
      scope: 'comment',
      begin,
      end,
      contains: []
    },
    modeOptions
  );
  mode.contains.push({
    scope: 'doctag',
    // hack to avoid the space from being included. the space is necessary to
    // match here to prevent the plain text rule below from gobbling up doctags
    begin: '[ ]*(?=(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):)',
    end: /(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):/,
    excludeBegin: true,
    relevance: 0
  });
  const ENGLISH_WORD = either(
    // list of common 1 and 2 letter words in English
    "I",
    "a",
    "is",
    "so",
    "us",
    "to",
    "at",
    "if",
    "in",
    "it",
    "on",
    // note: this is not an exhaustive list of contractions, just popular ones
    /[A-Za-z]+['](d|ve|re|ll|t|s|n)/, // contractions - can't we'd they're let's, etc
    /[A-Za-z]+[-][a-z]+/, // `no-way`, etc.
    /[A-Za-z][a-z]{2,}/ // allow capitalized words at beginning of sentences
  );
  // looking like plain text, more likely to be a comment
  mode.contains.push(
    {
      // TODO: how to include ", (, ) without breaking grammars that use these for
      // comment delimiters?
      // begin: /[ ]+([()"]?([A-Za-z'-]{3,}|is|a|I|so|us|[tT][oO]|at|if|in|it|on)[.]?[()":]?([.][ ]|[ ]|\))){3}/
      // ---

      // this tries to find sequences of 3 english words in a row (without any
      // "programming" type syntax) this gives us a strong signal that we've
      // TRULY found a comment - vs perhaps scanning with the wrong language.
      // It's possible to find something that LOOKS like the start of the
      // comment - but then if there is no readable text - good chance it is a
      // false match and not a comment.
      //
      // for a visual example please see:
      // https://github.com/highlightjs/highlight.js/issues/2827

      begin: concat(
        /[ ]+/, // necessary to prevent us gobbling up doctags like /* @author Bob Mcgill */
        '(',
        ENGLISH_WORD,
        /[.]?[:]?([.][ ]|[ ])/,
        '){3}') // look for 3 words in a row
    }
  );
  return mode;
};
const C_LINE_COMMENT_MODE = COMMENT('//', '$');
const C_BLOCK_COMMENT_MODE = COMMENT('/\\*', '\\*/');
const HASH_COMMENT_MODE = COMMENT('#', '$');
const NUMBER_MODE = {
  scope: 'number',
  begin: NUMBER_RE,
  relevance: 0
};
const C_NUMBER_MODE = {
  scope: 'number',
  begin: C_NUMBER_RE,
  relevance: 0
};
const BINARY_NUMBER_MODE = {
  scope: 'number',
  begin: BINARY_NUMBER_RE,
  relevance: 0
};
const REGEXP_MODE = {
  scope: "regexp",
  begin: /\/(?=[^/\n]*\/)/,
  end: /\/[gimuy]*/,
  contains: [
    BACKSLASH_ESCAPE,
    {
      begin: /\[/,
      end: /\]/,
      relevance: 0,
      contains: [BACKSLASH_ESCAPE]
    }
  ]
};
const TITLE_MODE = {
  scope: 'title',
  begin: IDENT_RE,
  relevance: 0
};
const UNDERSCORE_TITLE_MODE = {
  scope: 'title',
  begin: UNDERSCORE_IDENT_RE,
  relevance: 0
};
const METHOD_GUARD = {
  // excludes method names from keyword processing
  begin: '\\.\\s*' + UNDERSCORE_IDENT_RE,
  relevance: 0
};

/**
 * Adds end same as begin mechanics to a mode
 *
 * Your mode must include at least a single () match group as that first match
 * group is what is used for comparison
 * @param {Partial<Mode>} mode
 */
const END_SAME_AS_BEGIN = function(mode) {
  return Object.assign(mode,
    {
      /** @type {ModeCallback} */
      'on:begin': (m, resp) => { resp.data._beginMatch = m[1]; },
      /** @type {ModeCallback} */
      'on:end': (m, resp) => { if (resp.data._beginMatch !== m[1]) resp.ignoreMatch(); }
    });
};

var MODES = /*#__PURE__*/Object.freeze({
  __proto__: null,
  APOS_STRING_MODE: APOS_STRING_MODE,
  BACKSLASH_ESCAPE: BACKSLASH_ESCAPE,
  BINARY_NUMBER_MODE: BINARY_NUMBER_MODE,
  BINARY_NUMBER_RE: BINARY_NUMBER_RE,
  COMMENT: COMMENT,
  C_BLOCK_COMMENT_MODE: C_BLOCK_COMMENT_MODE,
  C_LINE_COMMENT_MODE: C_LINE_COMMENT_MODE,
  C_NUMBER_MODE: C_NUMBER_MODE,
  C_NUMBER_RE: C_NUMBER_RE,
  END_SAME_AS_BEGIN: END_SAME_AS_BEGIN,
  HASH_COMMENT_MODE: HASH_COMMENT_MODE,
  IDENT_RE: IDENT_RE,
  MATCH_NOTHING_RE: MATCH_NOTHING_RE,
  METHOD_GUARD: METHOD_GUARD,
  NUMBER_MODE: NUMBER_MODE,
  NUMBER_RE: NUMBER_RE,
  PHRASAL_WORDS_MODE: PHRASAL_WORDS_MODE,
  QUOTE_STRING_MODE: QUOTE_STRING_MODE,
  REGEXP_MODE: REGEXP_MODE,
  RE_STARTERS_RE: RE_STARTERS_RE,
  SHEBANG: SHEBANG,
  TITLE_MODE: TITLE_MODE,
  UNDERSCORE_IDENT_RE: UNDERSCORE_IDENT_RE,
  UNDERSCORE_TITLE_MODE: UNDERSCORE_TITLE_MODE
});

/**
@typedef {import('highlight.js').CallbackResponse} CallbackResponse
@typedef {import('highlight.js').CompilerExt} CompilerExt
*/

// Grammar extensions / plugins
// See: https://github.com/highlightjs/highlight.js/issues/2833

// Grammar extensions allow "syntactic sugar" to be added to the grammar modes
// without requiring any underlying changes to the compiler internals.

// `compileMatch` being the perfect small example of now allowing a grammar
// author to write `match` when they desire to match a single expression rather
// than being forced to use `begin`.  The extension then just moves `match` into
// `begin` when it runs.  Ie, no features have been added, but we've just made
// the experience of writing (and reading grammars) a little bit nicer.

// ------

// TODO: We need negative look-behind support to do this properly
/**
 * Skip a match if it has a preceding dot
 *
 * This is used for `beginKeywords` to prevent matching expressions such as
 * `bob.keyword.do()`. The mode compiler automatically wires this up as a
 * special _internal_ 'on:begin' callback for modes with `beginKeywords`
 * @param {RegExpMatchArray} match
 * @param {CallbackResponse} response
 */
function skipIfHasPrecedingDot(match, response) {
  const before = match.input[match.index - 1];
  if (before === ".") {
    response.ignoreMatch();
  }
}

/**
 *
 * @type {CompilerExt}
 */
function scopeClassName(mode, _parent) {
  // eslint-disable-next-line no-undefined
  if (mode.className !== undefined) {
    mode.scope = mode.className;
    delete mode.className;
  }
}

/**
 * `beginKeywords` syntactic sugar
 * @type {CompilerExt}
 */
function beginKeywords(mode, parent) {
  if (!parent) return;
  if (!mode.beginKeywords) return;

  // for languages with keywords that include non-word characters checking for
  // a word boundary is not sufficient, so instead we check for a word boundary
  // or whitespace - this does no harm in any case since our keyword engine
  // doesn't allow spaces in keywords anyways and we still check for the boundary
  // first
  mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')(?!\\.)(?=\\b|\\s)';
  mode.__beforeBegin = skipIfHasPrecedingDot;
  mode.keywords = mode.keywords || mode.beginKeywords;
  delete mode.beginKeywords;

  // prevents double relevance, the keywords themselves provide
  // relevance, the mode doesn't need to double it
  // eslint-disable-next-line no-undefined
  if (mode.relevance === undefined) mode.relevance = 0;
}

/**
 * Allow `illegal` to contain an array of illegal values
 * @type {CompilerExt}
 */
function compileIllegal(mode, _parent) {
  if (!Array.isArray(mode.illegal)) return;

  mode.illegal = either(...mode.illegal);
}

/**
 * `match` to match a single expression for readability
 * @type {CompilerExt}
 */
function compileMatch(mode, _parent) {
  if (!mode.match) return;
  if (mode.begin || mode.end) throw new Error("begin & end are not supported with match");

  mode.begin = mode.match;
  delete mode.match;
}

/**
 * provides the default 1 relevance to all modes
 * @type {CompilerExt}
 */
function compileRelevance(mode, _parent) {
  // eslint-disable-next-line no-undefined
  if (mode.relevance === undefined) mode.relevance = 1;
}

// allow beforeMatch to act as a "qualifier" for the match
// the full match begin must be [beforeMatch][begin]
const beforeMatchExt = (mode, parent) => {
  if (!mode.beforeMatch) return;
  // starts conflicts with endsParent which we need to make sure the child
  // rule is not matched multiple times
  if (mode.starts) throw new Error("beforeMatch cannot be used with starts");

  const originalMode = Object.assign({}, mode);
  Object.keys(mode).forEach((key) => { delete mode[key]; });

  mode.keywords = originalMode.keywords;
  mode.begin = concat(originalMode.beforeMatch, lookahead(originalMode.begin));
  mode.starts = {
    relevance: 0,
    contains: [
      Object.assign(originalMode, { endsParent: true })
    ]
  };
  mode.relevance = 0;

  delete originalMode.beforeMatch;
};

// keywords that should have no default relevance value
const COMMON_KEYWORDS = [
  'of',
  'and',
  'for',
  'in',
  'not',
  'or',
  'if',
  'then',
  'parent', // common variable name
  'list', // common variable name
  'value' // common variable name
];

const DEFAULT_KEYWORD_SCOPE = "keyword";

/**
 * Given raw keywords from a language definition, compile them.
 *
 * @param {string | Record<string,string|string[]> | Array<string>} rawKeywords
 * @param {boolean} caseInsensitive
 */
function compileKeywords(rawKeywords, caseInsensitive, scopeName = DEFAULT_KEYWORD_SCOPE) {
  /** @type {import("highlight.js/private").KeywordDict} */
  const compiledKeywords = Object.create(null);

  // input can be a string of keywords, an array of keywords, or a object with
  // named keys representing scopeName (which can then point to a string or array)
  if (typeof rawKeywords === 'string') {
    compileList(scopeName, rawKeywords.split(" "));
  } else if (Array.isArray(rawKeywords)) {
    compileList(scopeName, rawKeywords);
  } else {
    Object.keys(rawKeywords).forEach(function(scopeName) {
      // collapse all our objects back into the parent object
      Object.assign(
        compiledKeywords,
        compileKeywords(rawKeywords[scopeName], caseInsensitive, scopeName)
      );
    });
  }
  return compiledKeywords;

  // ---

  /**
   * Compiles an individual list of keywords
   *
   * Ex: "for if when while|5"
   *
   * @param {string} scopeName
   * @param {Array<string>} keywordList
   */
  function compileList(scopeName, keywordList) {
    if (caseInsensitive) {
      keywordList = keywordList.map(x => x.toLowerCase());
    }
    keywordList.forEach(function(keyword) {
      const pair = keyword.split('|');
      compiledKeywords[pair[0]] = [scopeName, scoreForKeyword(pair[0], pair[1])];
    });
  }
}

/**
 * Returns the proper score for a given keyword
 *
 * Also takes into account comment keywords, which will be scored 0 UNLESS
 * another score has been manually assigned.
 * @param {string} keyword
 * @param {string} [providedScore]
 */
function scoreForKeyword(keyword, providedScore) {
  // manual scores always win over common keywords
  // so you can force a score of 1 if you really insist
  if (providedScore) {
    return Number(providedScore);
  }

  return commonKeyword(keyword) ? 0 : 1;
}

/**
 * Determines if a given keyword is common or not
 *
 * @param {string} keyword */
function commonKeyword(keyword) {
  return COMMON_KEYWORDS.includes(keyword.toLowerCase());
}

/*

For the reasoning behind this please see:
https://github.com/highlightjs/highlight.js/issues/2880#issuecomment-747275419

*/

/**
 * @type {Record<string, boolean>}
 */
const seenDeprecations = {};

/**
 * @param {string} message
 */
const error = (message) => {
  console.error(message);
};

/**
 * @param {string} message
 * @param {any} args
 */
const warn = (message, ...args) => {
  console.log(`WARN: ${message}`, ...args);
};

/**
 * @param {string} version
 * @param {string} message
 */
const deprecated = (version, message) => {
  if (seenDeprecations[`${version}/${message}`]) return;

  console.log(`Deprecated as of ${version}. ${message}`);
  seenDeprecations[`${version}/${message}`] = true;
};

/* eslint-disable no-throw-literal */

/**
@typedef {import('highlight.js').CompiledMode} CompiledMode
*/

const MultiClassError = new Error();

/**
 * Renumbers labeled scope names to account for additional inner match
 * groups that otherwise would break everything.
 *
 * Lets say we 3 match scopes:
 *
 *   { 1 => ..., 2 => ..., 3 => ... }
 *
 * So what we need is a clean match like this:
 *
 *   (a)(b)(c) => [ "a", "b", "c" ]
 *
 * But this falls apart with inner match groups:
 *
 * (a)(((b)))(c) => ["a", "b", "b", "b", "c" ]
 *
 * Our scopes are now "out of alignment" and we're repeating `b` 3 times.
 * What needs to happen is the numbers are remapped:
 *
 *   { 1 => ..., 2 => ..., 5 => ... }
 *
 * We also need to know that the ONLY groups that should be output
 * are 1, 2, and 5.  This function handles this behavior.
 *
 * @param {CompiledMode} mode
 * @param {Array<RegExp | string>} regexes
 * @param {{key: "beginScope"|"endScope"}} opts
 */
function remapScopeNames(mode, regexes, { key }) {
  let offset = 0;
  const scopeNames = mode[key];
  /** @type Record<number,boolean> */
  const emit = {};
  /** @type Record<number,string> */
  const positions = {};

  for (let i = 1; i <= regexes.length; i++) {
    positions[i + offset] = scopeNames[i];
    emit[i + offset] = true;
    offset += countMatchGroups(regexes[i - 1]);
  }
  // we use _emit to keep track of which match groups are "top-level" to avoid double
  // output from inside match groups
  mode[key] = positions;
  mode[key]._emit = emit;
  mode[key]._multi = true;
}

/**
 * @param {CompiledMode} mode
 */
function beginMultiClass(mode) {
  if (!Array.isArray(mode.begin)) return;

  if (mode.skip || mode.excludeBegin || mode.returnBegin) {
    error("skip, excludeBegin, returnBegin not compatible with beginScope: {}");
    throw MultiClassError;
  }

  if (typeof mode.beginScope !== "object" || mode.beginScope === null) {
    error("beginScope must be object");
    throw MultiClassError;
  }

  remapScopeNames(mode, mode.begin, { key: "beginScope" });
  mode.begin = _rewriteBackreferences(mode.begin, { joinWith: "" });
}

/**
 * @param {CompiledMode} mode
 */
function endMultiClass(mode) {
  if (!Array.isArray(mode.end)) return;

  if (mode.skip || mode.excludeEnd || mode.returnEnd) {
    error("skip, excludeEnd, returnEnd not compatible with endScope: {}");
    throw MultiClassError;
  }

  if (typeof mode.endScope !== "object" || mode.endScope === null) {
    error("endScope must be object");
    throw MultiClassError;
  }

  remapScopeNames(mode, mode.end, { key: "endScope" });
  mode.end = _rewriteBackreferences(mode.end, { joinWith: "" });
}

/**
 * this exists only to allow `scope: {}` to be used beside `match:`
 * Otherwise `beginScope` would necessary and that would look weird

  {
    match: [ /def/, /\w+/ ]
    scope: { 1: "keyword" , 2: "title" }
  }

 * @param {CompiledMode} mode
 */
function scopeSugar(mode) {
  if (mode.scope && typeof mode.scope === "object" && mode.scope !== null) {
    mode.beginScope = mode.scope;
    delete mode.scope;
  }
}

/**
 * @param {CompiledMode} mode
 */
function MultiClass(mode) {
  scopeSugar(mode);

  if (typeof mode.beginScope === "string") {
    mode.beginScope = { _wrap: mode.beginScope };
  }
  if (typeof mode.endScope === "string") {
    mode.endScope = { _wrap: mode.endScope };
  }

  beginMultiClass(mode);
  endMultiClass(mode);
}

/**
@typedef {import('highlight.js').Mode} Mode
@typedef {import('highlight.js').CompiledMode} CompiledMode
@typedef {import('highlight.js').Language} Language
@typedef {import('highlight.js').HLJSPlugin} HLJSPlugin
@typedef {import('highlight.js').CompiledLanguage} CompiledLanguage
*/

// compilation

/**
 * Compiles a language definition result
 *
 * Given the raw result of a language definition (Language), compiles this so
 * that it is ready for highlighting code.
 * @param {Language} language
 * @returns {CompiledLanguage}
 */
function compileLanguage(language) {
  /**
   * Builds a regex with the case sensitivity of the current language
   *
   * @param {RegExp | string} value
   * @param {boolean} [global]
   */
  function langRe(value, global) {
    return new RegExp(
      source(value),
      'm'
      + (language.case_insensitive ? 'i' : '')
      + (language.unicodeRegex ? 'u' : '')
      + (global ? 'g' : '')
    );
  }

  /**
    Stores multiple regular expressions and allows you to quickly search for
    them all in a string simultaneously - returning the first match.  It does
    this by creating a huge (a|b|c) regex - each individual item wrapped with ()
    and joined by `|` - using match groups to track position.  When a match is
    found checking which position in the array has content allows us to figure
    out which of the original regexes / match groups triggered the match.

    The match object itself (the result of `Regex.exec`) is returned but also
    enhanced by merging in any meta-data that was registered with the regex.
    This is how we keep track of which mode matched, and what type of rule
    (`illegal`, `begin`, end, etc).
  */
  class MultiRegex {
    constructor() {
      this.matchIndexes = {};
      // @ts-ignore
      this.regexes = [];
      this.matchAt = 1;
      this.position = 0;
    }

    // @ts-ignore
    addRule(re, opts) {
      opts.position = this.position++;
      // @ts-ignore
      this.matchIndexes[this.matchAt] = opts;
      this.regexes.push([opts, re]);
      this.matchAt += countMatchGroups(re) + 1;
    }

    compile() {
      if (this.regexes.length === 0) {
        // avoids the need to check length every time exec is called
        // @ts-ignore
        this.exec = () => null;
      }
      const terminators = this.regexes.map(el => el[1]);
      this.matcherRe = langRe(_rewriteBackreferences(terminators, { joinWith: '|' }), true);
      this.lastIndex = 0;
    }

    /** @param {string} s */
    exec(s) {
      this.matcherRe.lastIndex = this.lastIndex;
      const match = this.matcherRe.exec(s);
      if (!match) { return null; }

      // eslint-disable-next-line no-undefined
      const i = match.findIndex((el, i) => i > 0 && el !== undefined);
      // @ts-ignore
      const matchData = this.matchIndexes[i];
      // trim off any earlier non-relevant match groups (ie, the other regex
      // match groups that make up the multi-matcher)
      match.splice(0, i);

      return Object.assign(match, matchData);
    }
  }

  /*
    Created to solve the key deficiently with MultiRegex - there is no way to
    test for multiple matches at a single location.  Why would we need to do
    that?  In the future a more dynamic engine will allow certain matches to be
    ignored.  An example: if we matched say the 3rd regex in a large group but
    decided to ignore it - we'd need to started testing again at the 4th
    regex... but MultiRegex itself gives us no real way to do that.

    So what this class creates MultiRegexs on the fly for whatever search
    position they are needed.

    NOTE: These additional MultiRegex objects are created dynamically.  For most
    grammars most of the time we will never actually need anything more than the
    first MultiRegex - so this shouldn't have too much overhead.

    Say this is our search group, and we match regex3, but wish to ignore it.

      regex1 | regex2 | regex3 | regex4 | regex5    ' ie, startAt = 0

    What we need is a new MultiRegex that only includes the remaining
    possibilities:

      regex4 | regex5                               ' ie, startAt = 3

    This class wraps all that complexity up in a simple API... `startAt` decides
    where in the array of expressions to start doing the matching. It
    auto-increments, so if a match is found at position 2, then startAt will be
    set to 3.  If the end is reached startAt will return to 0.

    MOST of the time the parser will be setting startAt manually to 0.
  */
  class ResumableMultiRegex {
    constructor() {
      // @ts-ignore
      this.rules = [];
      // @ts-ignore
      this.multiRegexes = [];
      this.count = 0;

      this.lastIndex = 0;
      this.regexIndex = 0;
    }

    // @ts-ignore
    getMatcher(index) {
      if (this.multiRegexes[index]) return this.multiRegexes[index];

      const matcher = new MultiRegex();
      this.rules.slice(index).forEach(([re, opts]) => matcher.addRule(re, opts));
      matcher.compile();
      this.multiRegexes[index] = matcher;
      return matcher;
    }

    resumingScanAtSamePosition() {
      return this.regexIndex !== 0;
    }

    considerAll() {
      this.regexIndex = 0;
    }

    // @ts-ignore
    addRule(re, opts) {
      this.rules.push([re, opts]);
      if (opts.type === "begin") this.count++;
    }

    /** @param {string} s */
    exec(s) {
      const m = this.getMatcher(this.regexIndex);
      m.lastIndex = this.lastIndex;
      let result = m.exec(s);

      // The following is because we have no easy way to say "resume scanning at the
      // existing position but also skip the current rule ONLY". What happens is
      // all prior rules are also skipped which can result in matching the wrong
      // thing. Example of matching "booger":

      // our matcher is [string, "booger", number]
      //
      // ....booger....

      // if "booger" is ignored then we'd really need a regex to scan from the
      // SAME position for only: [string, number] but ignoring "booger" (if it
      // was the first match), a simple resume would scan ahead who knows how
      // far looking only for "number", ignoring potential string matches (or
      // future "booger" matches that might be valid.)

      // So what we do: We execute two matchers, one resuming at the same
      // position, but the second full matcher starting at the position after:

      //     /--- resume first regex match here (for [number])
      //     |/---- full match here for [string, "booger", number]
      //     vv
      // ....booger....

      // Which ever results in a match first is then used. So this 3-4 step
      // process essentially allows us to say "match at this position, excluding
      // a prior rule that was ignored".
      //
      // 1. Match "booger" first, ignore. Also proves that [string] does non match.
      // 2. Resume matching for [number]
      // 3. Match at index + 1 for [string, "booger", number]
      // 4. If #2 and #3 result in matches, which came first?
      if (this.resumingScanAtSamePosition()) {
        if (result && result.index === this.lastIndex) ; else { // use the second matcher result
          const m2 = this.getMatcher(0);
          m2.lastIndex = this.lastIndex + 1;
          result = m2.exec(s);
        }
      }

      if (result) {
        this.regexIndex += result.position + 1;
        if (this.regexIndex === this.count) {
          // wrap-around to considering all matches again
          this.considerAll();
        }
      }

      return result;
    }
  }

  /**
   * Given a mode, builds a huge ResumableMultiRegex that can be used to walk
   * the content and find matches.
   *
   * @param {CompiledMode} mode
   * @returns {ResumableMultiRegex}
   */
  function buildModeRegex(mode) {
    const mm = new ResumableMultiRegex();

    mode.contains.forEach(term => mm.addRule(term.begin, { rule: term, type: "begin" }));

    if (mode.terminatorEnd) {
      mm.addRule(mode.terminatorEnd, { type: "end" });
    }
    if (mode.illegal) {
      mm.addRule(mode.illegal, { type: "illegal" });
    }

    return mm;
  }

  /** skip vs abort vs ignore
   *
   * @skip   - The mode is still entered and exited normally (and contains rules apply),
   *           but all content is held and added to the parent buffer rather than being
   *           output when the mode ends.  Mostly used with `sublanguage` to build up
   *           a single large buffer than can be parsed by sublanguage.
   *
   *             - The mode begin ands ends normally.
   *             - Content matched is added to the parent mode buffer.
   *             - The parser cursor is moved forward normally.
   *
   * @abort  - A hack placeholder until we have ignore.  Aborts the mode (as if it
   *           never matched) but DOES NOT continue to match subsequent `contains`
   *           modes.  Abort is bad/suboptimal because it can result in modes
   *           farther down not getting applied because an earlier rule eats the
   *           content but then aborts.
   *
   *             - The mode does not begin.
   *             - Content matched by `begin` is added to the mode buffer.
   *             - The parser cursor is moved forward accordingly.
   *
   * @ignore - Ignores the mode (as if it never matched) and continues to match any
   *           subsequent `contains` modes.  Ignore isn't technically possible with
   *           the current parser implementation.
   *
   *             - The mode does not begin.
   *             - Content matched by `begin` is ignored.
   *             - The parser cursor is not moved forward.
   */

  /**
   * Compiles an individual mode
   *
   * This can raise an error if the mode contains certain detectable known logic
   * issues.
   * @param {Mode} mode
   * @param {CompiledMode | null} [parent]
   * @returns {CompiledMode | never}
   */
  function compileMode(mode, parent) {
    const cmode = /** @type CompiledMode */ (mode);
    if (mode.isCompiled) return cmode;

    [
      scopeClassName,
      // do this early so compiler extensions generally don't have to worry about
      // the distinction between match/begin
      compileMatch,
      MultiClass,
      beforeMatchExt
    ].forEach(ext => ext(mode, parent));

    language.compilerExtensions.forEach(ext => ext(mode, parent));

    // __beforeBegin is considered private API, internal use only
    mode.__beforeBegin = null;

    [
      beginKeywords,
      // do this later so compiler extensions that come earlier have access to the
      // raw array if they wanted to perhaps manipulate it, etc.
      compileIllegal,
      // default to 1 relevance if not specified
      compileRelevance
    ].forEach(ext => ext(mode, parent));

    mode.isCompiled = true;

    let keywordPattern = null;
    if (typeof mode.keywords === "object" && mode.keywords.$pattern) {
      // we need a copy because keywords might be compiled multiple times
      // so we can't go deleting $pattern from the original on the first
      // pass
      mode.keywords = Object.assign({}, mode.keywords);
      keywordPattern = mode.keywords.$pattern;
      delete mode.keywords.$pattern;
    }
    keywordPattern = keywordPattern || /\w+/;

    if (mode.keywords) {
      mode.keywords = compileKeywords(mode.keywords, language.case_insensitive);
    }

    cmode.keywordPatternRe = langRe(keywordPattern, true);

    if (parent) {
      if (!mode.begin) mode.begin = /\B|\b/;
      cmode.beginRe = langRe(cmode.begin);
      if (!mode.end && !mode.endsWithParent) mode.end = /\B|\b/;
      if (mode.end) cmode.endRe = langRe(cmode.end);
      cmode.terminatorEnd = source(cmode.end) || '';
      if (mode.endsWithParent && parent.terminatorEnd) {
        cmode.terminatorEnd += (mode.end ? '|' : '') + parent.terminatorEnd;
      }
    }
    if (mode.illegal) cmode.illegalRe = langRe(/** @type {RegExp | string} */ (mode.illegal));
    if (!mode.contains) mode.contains = [];

    mode.contains = [].concat(...mode.contains.map(function(c) {
      return expandOrCloneMode(c === 'self' ? mode : c);
    }));
    mode.contains.forEach(function(c) { compileMode(/** @type Mode */ (c), cmode); });

    if (mode.starts) {
      compileMode(mode.starts, parent);
    }

    cmode.matcher = buildModeRegex(cmode);
    return cmode;
  }

  if (!language.compilerExtensions) language.compilerExtensions = [];

  // self is not valid at the top-level
  if (language.contains && language.contains.includes('self')) {
    throw new Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.");
  }

  // we need a null object, which inherit will guarantee
  language.classNameAliases = inherit$1(language.classNameAliases || {});

  return compileMode(/** @type Mode */ (language));
}

/**
 * Determines if a mode has a dependency on it's parent or not
 *
 * If a mode does have a parent dependency then often we need to clone it if
 * it's used in multiple places so that each copy points to the correct parent,
 * where-as modes without a parent can often safely be re-used at the bottom of
 * a mode chain.
 *
 * @param {Mode | null} mode
 * @returns {boolean} - is there a dependency on the parent?
 * */
function dependencyOnParent(mode) {
  if (!mode) return false;

  return mode.endsWithParent || dependencyOnParent(mode.starts);
}

/**
 * Expands a mode or clones it if necessary
 *
 * This is necessary for modes with parental dependenceis (see notes on
 * `dependencyOnParent`) and for nodes that have `variants` - which must then be
 * exploded into their own individual modes at compile time.
 *
 * @param {Mode} mode
 * @returns {Mode | Mode[]}
 * */
function expandOrCloneMode(mode) {
  if (mode.variants && !mode.cachedVariants) {
    mode.cachedVariants = mode.variants.map(function(variant) {
      return inherit$1(mode, { variants: null }, variant);
    });
  }

  // EXPAND
  // if we have variants then essentially "replace" the mode with the variants
  // this happens in compileMode, where this function is called from
  if (mode.cachedVariants) {
    return mode.cachedVariants;
  }

  // CLONE
  // if we have dependencies on parents then we need a unique
  // instance of ourselves, so we can be reused with many
  // different parents without issue
  if (dependencyOnParent(mode)) {
    return inherit$1(mode, { starts: mode.starts ? inherit$1(mode.starts) : null });
  }

  if (Object.isFrozen(mode)) {
    return inherit$1(mode);
  }

  // no special dependency issues, just return ourselves
  return mode;
}

var version = "11.9.0";

class HTMLInjectionError extends Error {
  constructor(reason, html) {
    super(reason);
    this.name = "HTMLInjectionError";
    this.html = html;
  }
}

/*
Syntax highlighting with language autodetection.
https://highlightjs.org/
*/



/**
@typedef {import('highlight.js').Mode} Mode
@typedef {import('highlight.js').CompiledMode} CompiledMode
@typedef {import('highlight.js').CompiledScope} CompiledScope
@typedef {import('highlight.js').Language} Language
@typedef {import('highlight.js').HLJSApi} HLJSApi
@typedef {import('highlight.js').HLJSPlugin} HLJSPlugin
@typedef {import('highlight.js').PluginEvent} PluginEvent
@typedef {import('highlight.js').HLJSOptions} HLJSOptions
@typedef {import('highlight.js').LanguageFn} LanguageFn
@typedef {import('highlight.js').HighlightedHTMLElement} HighlightedHTMLElement
@typedef {import('highlight.js').BeforeHighlightContext} BeforeHighlightContext
@typedef {import('highlight.js/private').MatchType} MatchType
@typedef {import('highlight.js/private').KeywordData} KeywordData
@typedef {import('highlight.js/private').EnhancedMatch} EnhancedMatch
@typedef {import('highlight.js/private').AnnotatedError} AnnotatedError
@typedef {import('highlight.js').AutoHighlightResult} AutoHighlightResult
@typedef {import('highlight.js').HighlightOptions} HighlightOptions
@typedef {import('highlight.js').HighlightResult} HighlightResult
*/


const escape = escapeHTML;
const inherit = inherit$1;
const NO_MATCH = Symbol("nomatch");
const MAX_KEYWORD_HITS = 7;

/**
 * @param {any} hljs - object that is extended (legacy)
 * @returns {HLJSApi}
 */
const HLJS = function(hljs) {
  // Global internal variables used within the highlight.js library.
  /** @type {Record<string, Language>} */
  const languages = Object.create(null);
  /** @type {Record<string, string>} */
  const aliases = Object.create(null);
  /** @type {HLJSPlugin[]} */
  const plugins = [];

  // safe/production mode - swallows more errors, tries to keep running
  // even if a single syntax or parse hits a fatal error
  let SAFE_MODE = true;
  const LANGUAGE_NOT_FOUND = "Could not find the language '{}', did you forget to load/include a language module?";
  /** @type {Language} */
  const PLAINTEXT_LANGUAGE = { disableAutodetect: true, name: 'Plain text', contains: [] };

  // Global options used when within external APIs. This is modified when
  // calling the `hljs.configure` function.
  /** @type HLJSOptions */
  let options = {
    ignoreUnescapedHTML: false,
    throwUnescapedHTML: false,
    noHighlightRe: /^(no-?highlight)$/i,
    languageDetectRe: /\blang(?:uage)?-([\w-]+)\b/i,
    classPrefix: 'hljs-',
    cssSelector: 'pre code',
    languages: null,
    // beta configuration options, subject to change, welcome to discuss
    // https://github.com/highlightjs/highlight.js/issues/1086
    __emitter: TokenTreeEmitter
  };

  /* Utility functions */

  /**
   * Tests a language name to see if highlighting should be skipped
   * @param {string} languageName
   */
  function shouldNotHighlight(languageName) {
    return options.noHighlightRe.test(languageName);
  }

  /**
   * @param {HighlightedHTMLElement} block - the HTML element to determine language for
   */
  function blockLanguage(block) {
    let classes = block.className + ' ';

    classes += block.parentNode ? block.parentNode.className : '';

    // language-* takes precedence over non-prefixed class names.
    const match = options.languageDetectRe.exec(classes);
    if (match) {
      const language = getLanguage(match[1]);
      if (!language) {
        warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
        warn("Falling back to no-highlight mode for this block.", block);
      }
      return language ? match[1] : 'no-highlight';
    }

    return classes
      .split(/\s+/)
      .find((_class) => shouldNotHighlight(_class) || getLanguage(_class));
  }

  /**
   * Core highlighting function.
   *
   * OLD API
   * highlight(lang, code, ignoreIllegals, continuation)
   *
   * NEW API
   * highlight(code, {lang, ignoreIllegals})
   *
   * @param {string} codeOrLanguageName - the language to use for highlighting
   * @param {string | HighlightOptions} optionsOrCode - the code to highlight
   * @param {boolean} [ignoreIllegals] - whether to ignore illegal matches, default is to bail
   *
   * @returns {HighlightResult} Result - an object that represents the result
   * @property {string} language - the language name
   * @property {number} relevance - the relevance score
   * @property {string} value - the highlighted HTML code
   * @property {string} code - the original raw code
   * @property {CompiledMode} top - top of the current mode stack
   * @property {boolean} illegal - indicates whether any illegal matches were found
  */
  function highlight(codeOrLanguageName, optionsOrCode, ignoreIllegals) {
    let code = "";
    let languageName = "";
    if (typeof optionsOrCode === "object") {
      code = codeOrLanguageName;
      ignoreIllegals = optionsOrCode.ignoreIllegals;
      languageName = optionsOrCode.language;
    } else {
      // old API
      deprecated("10.7.0", "highlight(lang, code, ...args) has been deprecated.");
      deprecated("10.7.0", "Please use highlight(code, options) instead.\nhttps://github.com/highlightjs/highlight.js/issues/2277");
      languageName = codeOrLanguageName;
      code = optionsOrCode;
    }

    // https://github.com/highlightjs/highlight.js/issues/3149
    // eslint-disable-next-line no-undefined
    if (ignoreIllegals === undefined) { ignoreIllegals = true; }

    /** @type {BeforeHighlightContext} */
    const context = {
      code,
      language: languageName
    };
    // the plugin can change the desired language or the code to be highlighted
    // just be changing the object it was passed
    fire("before:highlight", context);

    // a before plugin can usurp the result completely by providing it's own
    // in which case we don't even need to call highlight
    const result = context.result
      ? context.result
      : _highlight(context.language, context.code, ignoreIllegals);

    result.code = context.code;
    // the plugin can change anything in result to suite it
    fire("after:highlight", result);

    return result;
  }

  /**
   * private highlight that's used internally and does not fire callbacks
   *
   * @param {string} languageName - the language to use for highlighting
   * @param {string} codeToHighlight - the code to highlight
   * @param {boolean?} [ignoreIllegals] - whether to ignore illegal matches, default is to bail
   * @param {CompiledMode?} [continuation] - current continuation mode, if any
   * @returns {HighlightResult} - result of the highlight operation
  */
  function _highlight(languageName, codeToHighlight, ignoreIllegals, continuation) {
    const keywordHits = Object.create(null);

    /**
     * Return keyword data if a match is a keyword
     * @param {CompiledMode} mode - current mode
     * @param {string} matchText - the textual match
     * @returns {KeywordData | false}
     */
    function keywordData(mode, matchText) {
      return mode.keywords[matchText];
    }

    function processKeywords() {
      if (!top.keywords) {
        emitter.addText(modeBuffer);
        return;
      }

      let lastIndex = 0;
      top.keywordPatternRe.lastIndex = 0;
      let match = top.keywordPatternRe.exec(modeBuffer);
      let buf = "";

      while (match) {
        buf += modeBuffer.substring(lastIndex, match.index);
        const word = language.case_insensitive ? match[0].toLowerCase() : match[0];
        const data = keywordData(top, word);
        if (data) {
          const [kind, keywordRelevance] = data;
          emitter.addText(buf);
          buf = "";

          keywordHits[word] = (keywordHits[word] || 0) + 1;
          if (keywordHits[word] <= MAX_KEYWORD_HITS) relevance += keywordRelevance;
          if (kind.startsWith("_")) {
            // _ implied for relevance only, do not highlight
            // by applying a class name
            buf += match[0];
          } else {
            const cssClass = language.classNameAliases[kind] || kind;
            emitKeyword(match[0], cssClass);
          }
        } else {
          buf += match[0];
        }
        lastIndex = top.keywordPatternRe.lastIndex;
        match = top.keywordPatternRe.exec(modeBuffer);
      }
      buf += modeBuffer.substring(lastIndex);
      emitter.addText(buf);
    }

    function processSubLanguage() {
      if (modeBuffer === "") return;
      /** @type HighlightResult */
      let result = null;

      if (typeof top.subLanguage === 'string') {
        if (!languages[top.subLanguage]) {
          emitter.addText(modeBuffer);
          return;
        }
        result = _highlight(top.subLanguage, modeBuffer, true, continuations[top.subLanguage]);
        continuations[top.subLanguage] = /** @type {CompiledMode} */ (result._top);
      } else {
        result = highlightAuto(modeBuffer, top.subLanguage.length ? top.subLanguage : null);
      }

      // Counting embedded language score towards the host language may be disabled
      // with zeroing the containing mode relevance. Use case in point is Markdown that
      // allows XML everywhere and makes every XML snippet to have a much larger Markdown
      // score.
      if (top.relevance > 0) {
        relevance += result.relevance;
      }
      emitter.__addSublanguage(result._emitter, result.language);
    }

    function processBuffer() {
      if (top.subLanguage != null) {
        processSubLanguage();
      } else {
        processKeywords();
      }
      modeBuffer = '';
    }

    /**
     * @param {string} text
     * @param {string} scope
     */
    function emitKeyword(keyword, scope) {
      if (keyword === "") return;

      emitter.startScope(scope);
      emitter.addText(keyword);
      emitter.endScope();
    }

    /**
     * @param {CompiledScope} scope
     * @param {RegExpMatchArray} match
     */
    function emitMultiClass(scope, match) {
      let i = 1;
      const max = match.length - 1;
      while (i <= max) {
        if (!scope._emit[i]) { i++; continue; }
        const klass = language.classNameAliases[scope[i]] || scope[i];
        const text = match[i];
        if (klass) {
          emitKeyword(text, klass);
        } else {
          modeBuffer = text;
          processKeywords();
          modeBuffer = "";
        }
        i++;
      }
    }

    /**
     * @param {CompiledMode} mode - new mode to start
     * @param {RegExpMatchArray} match
     */
    function startNewMode(mode, match) {
      if (mode.scope && typeof mode.scope === "string") {
        emitter.openNode(language.classNameAliases[mode.scope] || mode.scope);
      }
      if (mode.beginScope) {
        // beginScope just wraps the begin match itself in a scope
        if (mode.beginScope._wrap) {
          emitKeyword(modeBuffer, language.classNameAliases[mode.beginScope._wrap] || mode.beginScope._wrap);
          modeBuffer = "";
        } else if (mode.beginScope._multi) {
          // at this point modeBuffer should just be the match
          emitMultiClass(mode.beginScope, match);
          modeBuffer = "";
        }
      }

      top = Object.create(mode, { parent: { value: top } });
      return top;
    }

    /**
     * @param {CompiledMode } mode - the mode to potentially end
     * @param {RegExpMatchArray} match - the latest match
     * @param {string} matchPlusRemainder - match plus remainder of content
     * @returns {CompiledMode | void} - the next mode, or if void continue on in current mode
     */
    function endOfMode(mode, match, matchPlusRemainder) {
      let matched = startsWith(mode.endRe, matchPlusRemainder);

      if (matched) {
        if (mode["on:end"]) {
          const resp = new Response(mode);
          mode["on:end"](match, resp);
          if (resp.isMatchIgnored) matched = false;
        }

        if (matched) {
          while (mode.endsParent && mode.parent) {
            mode = mode.parent;
          }
          return mode;
        }
      }
      // even if on:end fires an `ignore` it's still possible
      // that we might trigger the end node because of a parent mode
      if (mode.endsWithParent) {
        return endOfMode(mode.parent, match, matchPlusRemainder);
      }
    }

    /**
     * Handle matching but then ignoring a sequence of text
     *
     * @param {string} lexeme - string containing full match text
     */
    function doIgnore(lexeme) {
      if (top.matcher.regexIndex === 0) {
        // no more regexes to potentially match here, so we move the cursor forward one
        // space
        modeBuffer += lexeme[0];
        return 1;
      } else {
        // no need to move the cursor, we still have additional regexes to try and
        // match at this very spot
        resumeScanAtSamePosition = true;
        return 0;
      }
    }

    /**
     * Handle the start of a new potential mode match
     *
     * @param {EnhancedMatch} match - the current match
     * @returns {number} how far to advance the parse cursor
     */
    function doBeginMatch(match) {
      const lexeme = match[0];
      const newMode = match.rule;

      const resp = new Response(newMode);
      // first internal before callbacks, then the public ones
      const beforeCallbacks = [newMode.__beforeBegin, newMode["on:begin"]];
      for (const cb of beforeCallbacks) {
        if (!cb) continue;
        cb(match, resp);
        if (resp.isMatchIgnored) return doIgnore(lexeme);
      }

      if (newMode.skip) {
        modeBuffer += lexeme;
      } else {
        if (newMode.excludeBegin) {
          modeBuffer += lexeme;
        }
        processBuffer();
        if (!newMode.returnBegin && !newMode.excludeBegin) {
          modeBuffer = lexeme;
        }
      }
      startNewMode(newMode, match);
      return newMode.returnBegin ? 0 : lexeme.length;
    }

    /**
     * Handle the potential end of mode
     *
     * @param {RegExpMatchArray} match - the current match
     */
    function doEndMatch(match) {
      const lexeme = match[0];
      const matchPlusRemainder = codeToHighlight.substring(match.index);

      const endMode = endOfMode(top, match, matchPlusRemainder);
      if (!endMode) { return NO_MATCH; }

      const origin = top;
      if (top.endScope && top.endScope._wrap) {
        processBuffer();
        emitKeyword(lexeme, top.endScope._wrap);
      } else if (top.endScope && top.endScope._multi) {
        processBuffer();
        emitMultiClass(top.endScope, match);
      } else if (origin.skip) {
        modeBuffer += lexeme;
      } else {
        if (!(origin.returnEnd || origin.excludeEnd)) {
          modeBuffer += lexeme;
        }
        processBuffer();
        if (origin.excludeEnd) {
          modeBuffer = lexeme;
        }
      }
      do {
        if (top.scope) {
          emitter.closeNode();
        }
        if (!top.skip && !top.subLanguage) {
          relevance += top.relevance;
        }
        top = top.parent;
      } while (top !== endMode.parent);
      if (endMode.starts) {
        startNewMode(endMode.starts, match);
      }
      return origin.returnEnd ? 0 : lexeme.length;
    }

    function processContinuations() {
      const list = [];
      for (let current = top; current !== language; current = current.parent) {
        if (current.scope) {
          list.unshift(current.scope);
        }
      }
      list.forEach(item => emitter.openNode(item));
    }

    /** @type {{type?: MatchType, index?: number, rule?: Mode}}} */
    let lastMatch = {};

    /**
     *  Process an individual match
     *
     * @param {string} textBeforeMatch - text preceding the match (since the last match)
     * @param {EnhancedMatch} [match] - the match itself
     */
    function processLexeme(textBeforeMatch, match) {
      const lexeme = match && match[0];

      // add non-matched text to the current mode buffer
      modeBuffer += textBeforeMatch;

      if (lexeme == null) {
        processBuffer();
        return 0;
      }

      // we've found a 0 width match and we're stuck, so we need to advance
      // this happens when we have badly behaved rules that have optional matchers to the degree that
      // sometimes they can end up matching nothing at all
      // Ref: https://github.com/highlightjs/highlight.js/issues/2140
      if (lastMatch.type === "begin" && match.type === "end" && lastMatch.index === match.index && lexeme === "") {
        // spit the "skipped" character that our regex choked on back into the output sequence
        modeBuffer += codeToHighlight.slice(match.index, match.index + 1);
        if (!SAFE_MODE) {
          /** @type {AnnotatedError} */
          const err = new Error(`0 width match regex (${languageName})`);
          err.languageName = languageName;
          err.badRule = lastMatch.rule;
          throw err;
        }
        return 1;
      }
      lastMatch = match;

      if (match.type === "begin") {
        return doBeginMatch(match);
      } else if (match.type === "illegal" && !ignoreIllegals) {
        // illegal match, we do not continue processing
        /** @type {AnnotatedError} */
        const err = new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.scope || '<unnamed>') + '"');
        err.mode = top;
        throw err;
      } else if (match.type === "end") {
        const processed = doEndMatch(match);
        if (processed !== NO_MATCH) {
          return processed;
        }
      }

      // edge case for when illegal matches $ (end of line) which is technically
      // a 0 width match but not a begin/end match so it's not caught by the
      // first handler (when ignoreIllegals is true)
      if (match.type === "illegal" && lexeme === "") {
        // advance so we aren't stuck in an infinite loop
        return 1;
      }

      // infinite loops are BAD, this is a last ditch catch all. if we have a
      // decent number of iterations yet our index (cursor position in our
      // parsing) still 3x behind our index then something is very wrong
      // so we bail
      if (iterations > 100000 && iterations > match.index * 3) {
        const err = new Error('potential infinite loop, way more iterations than matches');
        throw err;
      }

      /*
      Why might be find ourselves here?  An potential end match that was
      triggered but could not be completed.  IE, `doEndMatch` returned NO_MATCH.
      (this could be because a callback requests the match be ignored, etc)

      This causes no real harm other than stopping a few times too many.
      */

      modeBuffer += lexeme;
      return lexeme.length;
    }

    const language = getLanguage(languageName);
    if (!language) {
      error(LANGUAGE_NOT_FOUND.replace("{}", languageName));
      throw new Error('Unknown language: "' + languageName + '"');
    }

    const md = compileLanguage(language);
    let result = '';
    /** @type {CompiledMode} */
    let top = continuation || md;
    /** @type Record<string,CompiledMode> */
    const continuations = {}; // keep continuations for sub-languages
    const emitter = new options.__emitter(options);
    processContinuations();
    let modeBuffer = '';
    let relevance = 0;
    let index = 0;
    let iterations = 0;
    let resumeScanAtSamePosition = false;

    try {
      if (!language.__emitTokens) {
        top.matcher.considerAll();

        for (;;) {
          iterations++;
          if (resumeScanAtSamePosition) {
            // only regexes not matched previously will now be
            // considered for a potential match
            resumeScanAtSamePosition = false;
          } else {
            top.matcher.considerAll();
          }
          top.matcher.lastIndex = index;

          const match = top.matcher.exec(codeToHighlight);
          // console.log("match", match[0], match.rule && match.rule.begin)

          if (!match) break;

          const beforeMatch = codeToHighlight.substring(index, match.index);
          const processedCount = processLexeme(beforeMatch, match);
          index = match.index + processedCount;
        }
        processLexeme(codeToHighlight.substring(index));
      } else {
        language.__emitTokens(codeToHighlight, emitter);
      }

      emitter.finalize();
      result = emitter.toHTML();

      return {
        language: languageName,
        value: result,
        relevance,
        illegal: false,
        _emitter: emitter,
        _top: top
      };
    } catch (err) {
      if (err.message && err.message.includes('Illegal')) {
        return {
          language: languageName,
          value: escape(codeToHighlight),
          illegal: true,
          relevance: 0,
          _illegalBy: {
            message: err.message,
            index,
            context: codeToHighlight.slice(index - 100, index + 100),
            mode: err.mode,
            resultSoFar: result
          },
          _emitter: emitter
        };
      } else if (SAFE_MODE) {
        return {
          language: languageName,
          value: escape(codeToHighlight),
          illegal: false,
          relevance: 0,
          errorRaised: err,
          _emitter: emitter,
          _top: top
        };
      } else {
        throw err;
      }
    }
  }

  /**
   * returns a valid highlight result, without actually doing any actual work,
   * auto highlight starts with this and it's possible for small snippets that
   * auto-detection may not find a better match
   * @param {string} code
   * @returns {HighlightResult}
   */
  function justTextHighlightResult(code) {
    const result = {
      value: escape(code),
      illegal: false,
      relevance: 0,
      _top: PLAINTEXT_LANGUAGE,
      _emitter: new options.__emitter(options)
    };
    result._emitter.addText(code);
    return result;
  }

  /**
  Highlighting with language detection. Accepts a string with the code to
  highlight. Returns an object with the following properties:

  - language (detected language)
  - relevance (int)
  - value (an HTML string with highlighting markup)
  - secondBest (object with the same structure for second-best heuristically
    detected language, may be absent)

    @param {string} code
    @param {Array<string>} [languageSubset]
    @returns {AutoHighlightResult}
  */
  function highlightAuto(code, languageSubset) {
    languageSubset = languageSubset || options.languages || Object.keys(languages);
    const plaintext = justTextHighlightResult(code);

    const results = languageSubset.filter(getLanguage).filter(autoDetection).map(name =>
      _highlight(name, code, false)
    );
    results.unshift(plaintext); // plaintext is always an option

    const sorted = results.sort((a, b) => {
      // sort base on relevance
      if (a.relevance !== b.relevance) return b.relevance - a.relevance;

      // always award the tie to the base language
      // ie if C++ and Arduino are tied, it's more likely to be C++
      if (a.language && b.language) {
        if (getLanguage(a.language).supersetOf === b.language) {
          return 1;
        } else if (getLanguage(b.language).supersetOf === a.language) {
          return -1;
        }
      }

      // otherwise say they are equal, which has the effect of sorting on
      // relevance while preserving the original ordering - which is how ties
      // have historically been settled, ie the language that comes first always
      // wins in the case of a tie
      return 0;
    });

    const [best, secondBest] = sorted;

    /** @type {AutoHighlightResult} */
    const result = best;
    result.secondBest = secondBest;

    return result;
  }

  /**
   * Builds new class name for block given the language name
   *
   * @param {HTMLElement} element
   * @param {string} [currentLang]
   * @param {string} [resultLang]
   */
  function updateClassName(element, currentLang, resultLang) {
    const language = (currentLang && aliases[currentLang]) || resultLang;

    element.classList.add("hljs");
    element.classList.add(`language-${language}`);
  }

  /**
   * Applies highlighting to a DOM node containing code.
   *
   * @param {HighlightedHTMLElement} element - the HTML element to highlight
  */
  function highlightElement(element) {
    /** @type HTMLElement */
    let node = null;
    const language = blockLanguage(element);

    if (shouldNotHighlight(language)) return;

    fire("before:highlightElement",
      { el: element, language });

    if (element.dataset.highlighted) {
      console.log("Element previously highlighted. To highlight again, first unset `dataset.highlighted`.", element);
      return;
    }

    // we should be all text, no child nodes (unescaped HTML) - this is possibly
    // an HTML injection attack - it's likely too late if this is already in
    // production (the code has likely already done its damage by the time
    // we're seeing it)... but we yell loudly about this so that hopefully it's
    // more likely to be caught in development before making it to production
    if (element.children.length > 0) {
      if (!options.ignoreUnescapedHTML) {
        console.warn("One of your code blocks includes unescaped HTML. This is a potentially serious security risk.");
        console.warn("https://github.com/highlightjs/highlight.js/wiki/security");
        console.warn("The element with unescaped HTML:");
        console.warn(element);
      }
      if (options.throwUnescapedHTML) {
        const err = new HTMLInjectionError(
          "One of your code blocks includes unescaped HTML.",
          element.innerHTML
        );
        throw err;
      }
    }

    node = element;
    const text = node.textContent;
    const result = language ? highlight(text, { language, ignoreIllegals: true }) : highlightAuto(text);

    element.innerHTML = result.value;
    element.dataset.highlighted = "yes";
    updateClassName(element, language, result.language);
    element.result = {
      language: result.language,
      // TODO: remove with version 11.0
      re: result.relevance,
      relevance: result.relevance
    };
    if (result.secondBest) {
      element.secondBest = {
        language: result.secondBest.language,
        relevance: result.secondBest.relevance
      };
    }

    fire("after:highlightElement", { el: element, result, text });
  }

  /**
   * Updates highlight.js global options with the passed options
   *
   * @param {Partial<HLJSOptions>} userOptions
   */
  function configure(userOptions) {
    options = inherit(options, userOptions);
  }

  // TODO: remove v12, deprecated
  const initHighlighting = () => {
    highlightAll();
    deprecated("10.6.0", "initHighlighting() deprecated.  Use highlightAll() now.");
  };

  // TODO: remove v12, deprecated
  function initHighlightingOnLoad() {
    highlightAll();
    deprecated("10.6.0", "initHighlightingOnLoad() deprecated.  Use highlightAll() now.");
  }

  let wantsHighlight = false;

  /**
   * auto-highlights all pre>code elements on the page
   */
  function highlightAll() {
    // if we are called too early in the loading process
    if (document.readyState === "loading") {
      wantsHighlight = true;
      return;
    }

    const blocks = document.querySelectorAll(options.cssSelector);
    blocks.forEach(highlightElement);
  }

  function boot() {
    // if a highlight was requested before DOM was loaded, do now
    if (wantsHighlight) highlightAll();
  }

  // make sure we are in the browser environment
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('DOMContentLoaded', boot, false);
  }

  /**
   * Register a language grammar module
   *
   * @param {string} languageName
   * @param {LanguageFn} languageDefinition
   */
  function registerLanguage(languageName, languageDefinition) {
    let lang = null;
    try {
      lang = languageDefinition(hljs);
    } catch (error$1) {
      error("Language definition for '{}' could not be registered.".replace("{}", languageName));
      // hard or soft error
      if (!SAFE_MODE) { throw error$1; } else { error(error$1); }
      // languages that have serious errors are replaced with essentially a
      // "plaintext" stand-in so that the code blocks will still get normal
      // css classes applied to them - and one bad language won't break the
      // entire highlighter
      lang = PLAINTEXT_LANGUAGE;
    }
    // give it a temporary name if it doesn't have one in the meta-data
    if (!lang.name) lang.name = languageName;
    languages[languageName] = lang;
    lang.rawDefinition = languageDefinition.bind(null, hljs);

    if (lang.aliases) {
      registerAliases(lang.aliases, { languageName });
    }
  }

  /**
   * Remove a language grammar module
   *
   * @param {string} languageName
   */
  function unregisterLanguage(languageName) {
    delete languages[languageName];
    for (const alias of Object.keys(aliases)) {
      if (aliases[alias] === languageName) {
        delete aliases[alias];
      }
    }
  }

  /**
   * @returns {string[]} List of language internal names
   */
  function listLanguages() {
    return Object.keys(languages);
  }

  /**
   * @param {string} name - name of the language to retrieve
   * @returns {Language | undefined}
   */
  function getLanguage(name) {
    name = (name || '').toLowerCase();
    return languages[name] || languages[aliases[name]];
  }

  /**
   *
   * @param {string|string[]} aliasList - single alias or list of aliases
   * @param {{languageName: string}} opts
   */
  function registerAliases(aliasList, { languageName }) {
    if (typeof aliasList === 'string') {
      aliasList = [aliasList];
    }
    aliasList.forEach(alias => { aliases[alias.toLowerCase()] = languageName; });
  }

  /**
   * Determines if a given language has auto-detection enabled
   * @param {string} name - name of the language
   */
  function autoDetection(name) {
    const lang = getLanguage(name);
    return lang && !lang.disableAutodetect;
  }

  /**
   * Upgrades the old highlightBlock plugins to the new
   * highlightElement API
   * @param {HLJSPlugin} plugin
   */
  function upgradePluginAPI(plugin) {
    // TODO: remove with v12
    if (plugin["before:highlightBlock"] && !plugin["before:highlightElement"]) {
      plugin["before:highlightElement"] = (data) => {
        plugin["before:highlightBlock"](
          Object.assign({ block: data.el }, data)
        );
      };
    }
    if (plugin["after:highlightBlock"] && !plugin["after:highlightElement"]) {
      plugin["after:highlightElement"] = (data) => {
        plugin["after:highlightBlock"](
          Object.assign({ block: data.el }, data)
        );
      };
    }
  }

  /**
   * @param {HLJSPlugin} plugin
   */
  function addPlugin(plugin) {
    upgradePluginAPI(plugin);
    plugins.push(plugin);
  }

  /**
   * @param {HLJSPlugin} plugin
   */
  function removePlugin(plugin) {
    const index = plugins.indexOf(plugin);
    if (index !== -1) {
      plugins.splice(index, 1);
    }
  }

  /**
   *
   * @param {PluginEvent} event
   * @param {any} args
   */
  function fire(event, args) {
    const cb = event;
    plugins.forEach(function(plugin) {
      if (plugin[cb]) {
        plugin[cb](args);
      }
    });
  }

  /**
   * DEPRECATED
   * @param {HighlightedHTMLElement} el
   */
  function deprecateHighlightBlock(el) {
    deprecated("10.7.0", "highlightBlock will be removed entirely in v12.0");
    deprecated("10.7.0", "Please use highlightElement now.");

    return highlightElement(el);
  }

  /* Interface definition */
  Object.assign(hljs, {
    highlight,
    highlightAuto,
    highlightAll,
    highlightElement,
    // TODO: Remove with v12 API
    highlightBlock: deprecateHighlightBlock,
    configure,
    initHighlighting,
    initHighlightingOnLoad,
    registerLanguage,
    unregisterLanguage,
    listLanguages,
    getLanguage,
    registerAliases,
    autoDetection,
    inherit,
    addPlugin,
    removePlugin
  });

  hljs.debugMode = function() { SAFE_MODE = false; };
  hljs.safeMode = function() { SAFE_MODE = true; };
  hljs.versionString = version;

  hljs.regex = {
    concat: concat,
    lookahead: lookahead,
    either: either,
    optional: optional,
    anyNumberOfTimes: anyNumberOfTimes
  };

  for (const key in MODES) {
    // @ts-ignore
    if (typeof MODES[key] === "object") {
      // @ts-ignore
      deepFreeze(MODES[key]);
    }
  }

  // merge all the modes/regexes into our main object
  Object.assign(hljs, MODES);

  return hljs;
};

// Other names for the variable may break build script
const highlight = HLJS({});

// returns a new instance of the highlighter to be used for extensions
// check https://github.com/wooorm/lowlight/issues/47
highlight.newInstance = () => HLJS({});

var core = highlight;
highlight.HighlightJS = highlight;
highlight.default = highlight;

var HighlightJS = /*@__PURE__*/getDefaultExportFromCjs(core);

/*
Language: JSON
Description: JSON (JavaScript Object Notation) is a lightweight data-interchange format.
Author: Ivan Sagalaev <maniac@softwaremaniacs.org>
Website: http://www.json.org
Category: common, protocols, web
*/

function json(hljs) {
  const ATTRIBUTE = {
    className: 'attr',
    begin: /"(\\.|[^\\"\r\n])*"(?=\s*:)/,
    relevance: 1.01
  };
  const PUNCTUATION = {
    match: /[{}[\],:]/,
    className: "punctuation",
    relevance: 0
  };
  const LITERALS = [
    "true",
    "false",
    "null"
  ];
  // NOTE: normally we would rely on `keywords` for this but using a mode here allows us
  // - to use the very tight `illegal: \S` rule later to flag any other character
  // - as illegal indicating that despite looking like JSON we do not truly have
  // - JSON and thus improve false-positively greatly since JSON will try and claim
  // - all sorts of JSON looking stuff
  const LITERALS_MODE = {
    scope: "literal",
    beginKeywords: LITERALS.join(" "),
  };

  return {
    name: 'JSON',
    keywords:{
      literal: LITERALS,
    },
    contains: [
      ATTRIBUTE,
      PUNCTUATION,
      hljs.QUOTE_STRING_MODE,
      LITERALS_MODE,
      hljs.C_NUMBER_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE
    ],
    illegal: '\\S'
  };
}

HighlightJS.registerLanguage("json", json);

const MODULE = () => game.modules.get(MODULE_ID);
const MHL$1 = () => MODULE().api;
const AIF = () => game.modules.get("additional-icon-fonts")?.active;
const SM$1 = () => MHL$1().managers.get(MODULE_ID);

Hooks.once("init", () => {
  // CONFIG.debug.hooks = true;
  const mod = MODULE();
  mod.api = {
    macros,
    apps,
    util,
    data,
    hljs: HighlightJS,
  };

  //helpers go in the root of the api object
  for (const [key, helper] of Object.entries(helpers)) {
    // only fill out system specific helpers if we're in that system
    if (key.startsWith("systemhelpers_")) {
      const system = key.substring(14);
      if (game.system.id !== system) continue;
      for (const [pkey, phelper] of Object.entries(helper)) {
        mod.api[pkey] = phelper;
      }
    }
    mod.api[key] = helper;
  }
  //special exposure for ease of grabbing MHL settings
  mod.api.mhlSetting = setting;

  CONFIG.MHL = generateDefaultConfig();
});
Hooks.once("i18nInit", () => {
  //do as much as possible here or later so errors can be localized
  const settingManagerOptions = {
    settingPrefix: "MHL.Setting",
    resetButtons: true,
    groups: {
      collapsible: false,
    },
    settings: SETTINGS,
  };
  new MHLSettingsManager(MODULE_ID, settingManagerOptions);
  CONFIG.MHL.iconFonts.push(...iconFontsDefaults);
  MHL$1().managers = MHLSettingsManager.managers;
});

Hooks.once("setup", () => {
  if (setting("legacy-access")) game.pf2emhl = MHL$1();
  if (setting("global-access")) globalThis.mhl = MHL$1();
});

Hooks.once("ready", () => {
  // handle defaults fallback as best as possible
  if (AIF()) {
    // if aif is ever enabled, record that fact
    SM$1().set("aif-enabled", true);
  } else {
    if (SM$1().beenSet("manager-defaults") && setting("aif-enabled")) ;
  }
  //register helpers late so checks can be done on existing helpers
  registerHandlebarsHelpers();

  const verifiedFor = VERIFIED_SYSTEM_VERSIONS[game.system.id] ?? false;
  if (verifiedFor && !fu.isNewerVersion(game.system.version, verifiedFor))
    MHLBanner(`MHL.Warning.SystemBelowVerified`, {
      context: { version: game.system.version, verified: verifiedFor },
      type: "warn",
      permanent: true,
    });
});

export { AIF, MHL$1 as MHL, MODULE, SM$1 as SM };
