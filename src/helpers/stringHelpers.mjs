import { MODULE_ID } from "../constants.mjs";
import { logCastString, mhlError, mhlog } from "./errorHelpers.mjs";
import { isEmpty, isPlainObject } from "./otherHelpers.mjs";

/**
 * Prepends "a " or "an " to a string as appropriate for its first character.
 * Only really useful in English.
 *
 * @param {string} text The text to be prepended to
 * @returns {string} The
 */
export function prependIndefiniteArticle(text) {
  const vowels = "aeiou";
  text = logCastString(text, "text", { func: "prependIndefiniteArticle" });
  const article =
    vowels.indexOf(text[0].toLowerCase()) > -1
      ? localize(`MHL.Grammar.Articles.An`)
      : localize(`MHL.Grammar.Articles.A`);
  return `${article} ${text}`;
}

/**
 * @typedef {{[key: string]: string|{key: string, transform?: string, context?: MHLLocalizationContext}}} MHLLocalizationContext
 */

/**
 * Wraps game.i18n.format with extra options and reduced restrictions.
 * Localization is recursive through the context object by default,
 * and translation values that contain curly braces are supported via
 * escaping them (e.g `"\{This} is not a variable resolution but {this} is"`)
 *
 * @export
 * @param {string} key The top level string to attempt localization of
 * @param {MHLLocalizationContext} [context={}] Data required to format the provided key. May be recurisve
 * @param {object} [options={}]
 * @param {boolean} [options.recursive=true] Whether context keys whose values are simple strings should also be localized
 * You can always forse localization by providing a LocalizationContext instead of a string value
 * @param {boolean} [options.defaultEmpty=true] Whether placeholders without data passed should resolve to `""` (`true`) or `"undefined"` (foundry's behaviour)
 * @returns {string} The localized value, or the original string if no matching key was found
 *
 * @example
 * A recursive context structure. `package` is treated as its own localization call regardless of `recursive`.
 * `optionalClause` will only be localized if `recursive` is `true`. `registered` will check if `transform` is
 * the name of an instance method on Strings and call it if so.
 *
 * ```
 * {
 *   settingName: setting.name,
 *   optionalClause: "MHL.Localization.Key",
 *   registered: {
 *     key: "MHL.Registered" // "Registered",
 *     transform: "toLocaleLowercase"
 *   }
 *   package: {
 *     key: "MHL.Localization.Key2",
 *     context: {
 *       packageType: "module",
 *       packageName: module.title
 *     }
 *   }
 * }
 * ```
 */
export function localize(key, context = {}, { recursive = true, defaultEmpty = true } = {}) {
  key = String(key);
  if (!key) return;
  const processedContext =
    isEmpty(context) || !isPlainObject(context)
      ? {}
      : Object.entries(context).reduce((acc, [k, v]) => {
          let value;
          if (isPlainObject(v)) {
            value = localize(v.key ?? "", v.context ?? {}, { recursive, defaultEmpty });
            if (typeof value[v.transform] === "function") value[v.transform]();
          } else {
            value = recursive ? localize(v) : String(v);
          }
          acc[k] = value;
          return acc;
        }, {});
  if (isEmpty(game.i18n?.translations)) {
    return `Localization attempted before i18n initialization, pasteable command: \n
    game.modules.get('${MODULE_ID}').api.localize('${key}', ${JSON.stringify(context)}, ${JSON.stringify({
      recursive,
      defaultEmpty,
    })})`;
  }
  return game.i18n
    .localize(key)
    .replace(/(?<!\\)({[^}]+})/g, (match) => {
      // match all {} not preceded by \
      return processedContext[match.slice(1, -1)] ?? (defaultEmpty ? "" : undefined);
    })
    .replace(/\\{/, "{"); //strip \ before { from final string
}

/**
 * @typedef {"bactrian"|"dromedary"|null} MHLCamel
 */

/**
 * PF2e's sluggify implementation, slightly tweaked for integration
 *
 * @export
 * @param {string} text The string to be sluggified
 * @param {object} [options={}]
 * @param {MHLCamel} [options.camel=null] If non-null, the camel type to use. You can remember which is which,
 * because BactrianCase has two humps and dromedaryCase has only one.
 * @returns {string} The transformed string
 */
export function sluggify(text, { camel = null } = {}) {
  const wordCharacter = String.raw`[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
  const nonWordCharacter = String.raw`[^\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
  const nonWordBoundary = String.raw`(?=^|$|${wordCharacter})`;
  const lowerCaseLetter = String.raw`\p{Lowercase_Letter}`;
  const upperCaseLetter = String.raw`\p{Uppercase_Letter}`;

  const nonWordCharacterRE = new RegExp(nonWordCharacter, "gu");
  const lowerCaseThenUpperCaseRE = new RegExp(`(${lowerCaseLetter})(${upperCaseLetter}${nonWordBoundary})`, "gu");
  const nonWordCharacterHyphenOrSpaceRE =
    /[^-\p{White_Space}\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]/gu;
  const upperOrWordBoundariedLowerRE = new RegExp(`${upperCaseLetter}|${nonWordCharacter}${lowerCaseLetter}`, "gu");

  text = logCastString(text, "text", { func: "sluggify" });
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
      throw mhlError({ camel }, { context: { camel }, text: `MHL.Error.InvalidCamel`, func: "sluggify" });
  }
}

/**
 * Taken from the PF2e system
 * Truncates a number value to an integer and returns it as a string with the sign prepended
 *
 * @export
 * @param {number} value
 * @param {object} [options={}]
 * @param {boolean} [options.emptyStringZero=false] Whether to return `""` if `value === 0` or not
 * @param {boolean} [options.zeroIsNegative=false] Whether to return `"-0"` if value === 0` or not
 * @returns {string}
 */
export function signedInteger(value, { emptyStringZero = false, zeroIsNegative = false } = {}) {
  if (value === 0 && emptyStringZero) return "";
  const nf = new Intl.NumberFormat(game.i18n.lang, {
    maximumFractionDigits: 0,
    signDisplay: "always",
  });
  const maybeNegativeZero = zeroIsNegative && value === 0 ? -0 : value;

  return nf.format(maybeNegativeZero);
}

/**
 * Takes a list of strings and produces a single, gramatically correct, list string of them,
 * respecting the Oxford Comma
 *
 * @export
 * @param {StringArgs} list
 * @returns {string}
 */
export function oxfordList(list) {
  list = (Array.isArray(list) ? list : [list]).filter((e) => !!e).map((e) => String(e));
  if (list.length <= 1) return list?.[0] ?? "";
  if (list.length === 2) return list.join(" and ");
  const last = list.at(-1);
  const others = list.splice(0, list.length - 1);
  return `${others.join(", ")}, and ${last}`;
}

/**
 * A standard alpha sort that yells at you if you pass it non-strings
 * For use as a `.sort()` callback
 *
 * @export
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 */
export function localeSort(a, b) {
  const func = `localeSort`;
  a = logCastString(a, "a", { func });
  b = logCastString(b, "b", { func });
  return a.localeCompare(b);
}

/**
 * A sort callback that does no sorting
 *
 * @export
 * @returns {0}
 */
export function nullSort() {
  return 0;
}

/**
 * Escape certain characters with their &; html equivalent for tag safety
 *
 * @export
 * @param {string|HTMLElement} text The data to be cleaned. If passed an `HTMLElement`, uses its `.outerHTML`
 * @returns {string}
 */
export function escapeHTML(text) {
  if (text instanceof HTMLElement) text = text.outerHTML;
  text = logCastString(text, "text", { func: "escapeHTML" });
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

/**
 * Returns true if any tag-like sequence is found
 *
 * @export
 * @param {string} text
 * @returns {boolean}
 */
export function hasTags(text) {
  text = logCastString(text, "text", { func: "hasTags" });
  return /<[^>]+>/.test(text);
}

export function stripTags(text) {
  text = logCastString(text, "text", { func: "stripTags" });
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}
