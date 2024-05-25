import { MODULE_ID, fu } from "../constants.mjs";
import { MHLError, isEmpty, isPlainObject, logCast, mhlog } from "./index.mjs";

export function prependIndefiniteArticle(text) {
  const vowels = "aeiou";
  if (typeof text !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func: "prependIndefiniteArticle",
      localize: true,
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

export function mhlocalize(text, context = {}, { defaultEmpty = true } = {}) {
  const func = "mhlocalize";
  text = logCast(text, String, 'text', func);
  const processedContext =
    isEmpty(context) || !isPlainObject(context)
      ? {}
      : Object.entries(context).reduce((acc, [k, v]) => {
          acc[k] = isPlainObject(v) ? mhlocalize(String(v.key ?? ""), v.context ?? {}, { defaultEmpty }) : mhlocalize(String(v));
          return acc;
        }, {});
  if (fu.isEmpty(game.i18n?.translations)) {
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
export function sluggify(text, { camel = null } = {}) {
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
    mhlog(`MHL.Warning.Fallback.Type`, {
      func: "sluggify",
      localize: true,
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
export function signedInteger(value, { emptyStringZero = false, zeroIsNegative = false } = {}) {
  if (value === 0 && emptyStringZero) return "";
  const nf = (intlNumberFormat ??= new Intl.NumberFormat(game.i18n.lang, {
    maximumFractionDigits: 0,
    signDisplay: "always",
  }));
  const maybeNegativeZero = zeroIsNegative && value === 0 ? -0 : value;

  return nf.format(maybeNegativeZero);
}

export function oxfordList(list) {
  list = (Array.isArray(list) ? list : [list]).filter((e) => !!e).map((e) => String(e));
  if (list.length <= 1) return list?.[0] ?? "";
  if (list.length === 2) return list.join(" and ");
  const last = list.at(-1);
  const others = list.splice(0, list.length - 1);
  return `${others.join(", ")}, and ${last}`;
}
