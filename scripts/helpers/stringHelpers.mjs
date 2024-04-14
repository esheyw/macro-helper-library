import { MODULE_ID, fu } from "../constants.mjs";
import { MHLError, isPlainObject, mhlog } from "./index.mjs";

export function getLogPrefix(text, options = {}) {
  let out = "";
  let { prefix, mod, func } = options;
  if (typeof text !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func: `getLogPrefix`,
      localize: true,
      context: { var: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  mod = String(mod ?? "");
  func = String(func ?? "");
  prefix = String(prefix ?? "");
  if (mod && !text.startsWith(`${mod} |`)) out += `${mod} | `;
  if (func && !text.includes(`${func} |`)) out += `${func} | `;
  if (prefix) out += prefix;
  return out;
}

export function prependIndefiniteArticle(text) {
  const vowels = "aeiou";
  if (typeof text !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func: "prependIndefiniteArticle",
      localize: true,
      context: { var: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  const article =
    vowels.indexOf(text[0].toLowerCase()) > -1
      ? localize(`MHL.Grammar.Articles.An`)
      : localize(`MHL.Grammar.Articles.A`);
  return `${article} ${text}`;
}

export function localize(text, data = {}, { defaultEmpty = true } = {}) {
  if (typeof text !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func: "localize",
      localize: true,
      context: { var: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  if (fu.isEmpty(game.i18n?.translations)) {
    return `Localization attempted before i18n initialization, pasteable command: 
    game.modules.get('${MODULE_ID}').api.localize('${text}', ${JSON.stringify(data)})`;
  }
  return game.i18n
    .localize(text)
    .replace(/(?<!\\)({[^}]+})/g, (match) => {
      // match all {} not preceded by \
      return data[match.slice(1, -1)] ?? (defaultEmpty ? "" : undefined);
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
      context: { var: "text", type: typeof text, expected: "string" },
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
