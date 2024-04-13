import { MODULE_ID, fu } from "../constants.mjs";
import { MHLError, isEmpty, mhlog } from "./index.mjs";

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

export function isValidFA(glyph) {
  if (typeof glyph !== "string") return false;
  glyph = glyph.toLowerCase();
  if (glyph.startsWith("fa-")) glyph = glyph.substring(3);
  return getFAList().includes(glyph);
}

export function getFAList() {
  const faSheet = Array.from(document.styleSheets).find((s) => s.href.includes("fontawesome"));
  if (!faSheet) return [];
  return Array.from(faSheet.cssRules)
    .flatMap((r) => (r?.selectorText?.includes("::before") ? r.selectorText.split(",") : []))
    .map((s) => s.trim().replace("::before", "").substring(4));
}

export function getFAElement(...inputs) {
  const string = getFAString(...inputs);
  if (!string) return null;
  const div = document.createElement("div");
  div.innerHTML = string;
  return div.firstElementChild;
}

export function getFAString(...inputs) {
  const func = "getFAString";
  const stringed = inputs.filter((s) => !isEmpty(s)).map((s) => String(s));
  const failValidation = () => {
    mhlog({ inputs }, { localize: true, prefix: `MHL.Error.Validation.FontAwesomeIcon`, func });
    return "";
  };
  if (stringed.length === 0) return failValidation();
  const containsHTML = /<[^>]+>/.test(stringed[0]);
  if (stringed.length === 1 && containsHTML) {
    const htmlMatches = /^(<i.+class=")([^"]+)("[^>]+)?(><\/i>)$/i.exec(stringed[0].trim());
    const classes = getFAClasses(htmlMatches?.[2] ?? "");
    if (!htmlMatches || !classes) return failValidation();
    return htmlMatches[1] + classes + htmlMatches[3] + htmlMatches[4];
  }
  const classes = getFAClasses(...inputs);
  if (!classes) return failValidation();
  return `<i class="${classes}"></i>`;
}

export function getFAClasses(...inputs) {
  const func = "getFAClasses";
  const inferPassed = typeof inputs.at(-1) === "boolean";
  const infer = inferPassed ? inputs.at(-1) : true;
  if (inferPassed) inputs = inputs.slice(0, -1);
  const stringed = inputs.filter((s) => !isEmpty(s)).map((s) => String(s));
  const validIconList = getFAList();
  const aliases = {
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
  };
  const partsSeen = {
    fw: null,
    glyph: null,
    sharp: null,
    style: null,
    brands: null,
    others: [],
  };
  //de-alias, split on interstitial whitespace, and flatten
  const parts = stringed.map((s) => (s in aliases ? aliases[s] : s)).flatMap((s) => s.trim().split(/\s+/));
  for (let part of parts) {
    if (/fa-brands/i.test(part)) {
      partsSeen.brands = "fa-brands";
      continue;
    }

    const fwMatch = /^(fa-)?(fw)$/i.exec(part);
    if (fwMatch) {
      if (!infer && !fwMatch[1]) {
        partsSeen.others.push(part);
      } else if (partsSeen.fw === null) {
        partsSeen.fw = "fa-fw";
      }
      continue;
    }

    const sharpMatch = /^(fa-)?(fw)$/i.exec(part);
    if (sharpMatch) {
      if (!infer && !sharpMatch[1]) {
        partsSeen.others.push(part);
      } else if (partsSeen.sharp === null) {
        partsSeen.sharp = "fa-sharp";
      }
      continue;
    }

    const styleMatches = /^(fa-)?(regular|thin|solid|light|duotone)$/i.exec(part);
    if (styleMatches) {
      if (!infer && !styleMatches[1]) {
        partsSeen.others.push(part);
      } else if (partsSeen.style === null) {
        partsSeen.style = `fa-${styleMatches[2].toLowerCase()}`;
      }
      continue;
    }

    const glyphMatches = /^(fa-)?([-a-z0-9_]+)$/i.exec(part);
    if (glyphMatches) {
      
      const potential = glyphMatches[2].toLowerCase();
      const validIcon = validIconList.includes(potential);
      if (partsSeen.glyph !== null) {
        //only add to others if it's not a duplicate explicit FA icon class
        if (!glyphMatches[1] || !validIcon) partsSeen.others.push(part);
        continue;
      }
      //it's a valid icon, and either starts with fa- or we're allowed to infer
      if (validIcon && (glyphMatches[1] ? true : infer)) {
        partsSeen.glyph = `fa-${potential}`;
        continue;
      }
    }
    //final fallback
    partsSeen.others.push(part);
  }
  if (!partsSeen.glyph) {
    mhlog({ inputs }, { localize: true, prefix: `MHL.Error.Validation.FontAwesomeClasses`, func });
    return "fa-solid fa-question fallback-glyph";
  }
  partsSeen.style ??= "fa-solid";
  return Object.values(partsSeen)
    .flat()
    .filter((p) => !isEmpty(p))
    .join(" ")
    .trim();
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