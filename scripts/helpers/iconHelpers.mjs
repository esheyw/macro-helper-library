import { elementFromString } from "./DOMHelpers.mjs";
import { isEmpty, mhlog } from "./errorHelpers.mjs";
import { getFunctionOptions } from "./otherHelpers.mjs";

export function getFontAwesomeString(...inputs) {
  const func = "getFontAwesomeString";
  let options = getFunctionOptions(inputs);
  if (options?.hash) options = options.hash; // handlebars
  const element = options?.element ?? "i";
  const stringed = inputs.filter((s) => !isEmpty(s)).map((s) => String(s));
  const failValidation = () => {
    mhlog({ inputs, options }, { localize: true, prefix: `MHL.Error.Validation.FontAwesomeIcon`, func });
    return "";
  };
  if (stringed.length === 0) return failValidation();
  const containsHTML = /<[^>]+>/.test(stringed[0]);
  if (stringed.length === 1 && containsHTML) {
    const regex = new RegExp(`^(<${element}.+class=")([^"]+)("[^>]+)?(><\/${element}>)$`, "i");
    const htmlMatches = regex.exec(stringed[0].trim());
    const classes = getFontAwesomeClasses(htmlMatches?.[2] ?? "");
    if (!htmlMatches || !classes) return failValidation();
    return htmlMatches[1] + classes + htmlMatches[3] + htmlMatches[4];
  }
  if (!isEmpty(options)) inputs.push(options);
  const classes = getFontAwesomeClasses(...inputs);
  if (!classes) return failValidation();

  return `<${element} class="${classes}"></${element}>`;
}

export function getFontAwesomeClasses(...inputs) {
  const func = "getFontAwesomeClasses";
  const { infer, default: defaultValue } = getFunctionOptions(inputs) ?? {};
  const stringed = inputs.filter((s) => !isEmpty(s)).map((s) => String(s));
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

    const sharpMatch = /^(fa-)?(sharp)$/i.exec(part);
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
      const validIcon = isValidIcon(potential, "fontawesome");
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
    if (defaultValue !== undefined) return defaultValue;
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
export function isValidIcon(input, list = null) {
  const func = `isValidIcon`;
  const classes =
    input instanceof HTMLElement
      ? input.className
      : typeof input === "string"
      ? elementFromString(input)?.className ?? input
      : null;
  if (!classes) return false;
  const parts = classes.trim().split(/\s+/);
  list = isEmpty(list) ? null : Array.isArray(list) ? list : [list];
  const validLists = CONFIG.MacroHelperLibrary.iconLists
    .filter((l) => (list ? list.includes(l.name) : !!l))
    .toSorted((a, b) => (a.sort < b.sort ? -1 : a.sort === b.sort ? 0 : 1));
  for (const data of validLists) {
    for (const part of parts) {
      const testString = part.startsWith(data.prefix) ? part.substring(data.prefix.length) : part;
      if (data.list.includes(testString)) return true;
    }
  }
  return false;
}

export function getIconListFromCSS(sheetNeedle, prefix) {
  const sheet = Array.from(document.styleSheets).find((s) => s.href.includes(String(sheetNeedle)));
  if (!sheet) return []; //todo add logging
  return Array.from(sheet.cssRules)
    .flatMap((r) => (r?.selectorText?.includes(":before") ? r.selectorText.split(",") : []))
    .reduce((acc, s) => {
      // made this a reduce because some entries are resolving to ''
      //todo: be more thorough here (check end of produced list for weirdness)
      const processed = s
        .trim()
        .replace(/:{1,2}before/, "")
        .substring(String(prefix).length + 1); // +1 to account for the . in the selector
      if (processed) acc.push(processed);
      return acc;
    }, []);
}
