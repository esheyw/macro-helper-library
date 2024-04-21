import { fu } from "../constants.mjs";
import { elementFromString } from "./DOMHelpers.mjs";
import { isEmpty, mhlog } from "./errorHelpers.mjs";
import { getFunctionOptions, isPlainObject } from "./otherHelpers.mjs";

export function getIconString(...args) {
  const func = `getIconString`;
  const originalOptions = getFunctionOptions(args, { handlebars: true }) ?? {};
  const options = fu.mergeObject({ fallback: undefined, strict: false, infer: true, element: "i" }, originalOptions);
  const stringed = args
    .flat(Infinity)
    .filter((s) => !isEmpty(s))
    .map((s) => String(s))
    .flatMap((s) => s.split(/\s+/));
  const failValidation = () => {
    mhlog(
      { args: isEmpty(originalOptions) ? args : [...args, originalOptions] },
      { type: "warn", localize: true, prefix: `MHL.Error.Validation.IconGeneric`, func }
    );
    return "";
  };
  if (stringed.length === 0) return failValidation();
  const containsHTML = stringed.find((s) => /<[^>]+>/.test(s));
  if (containsHTML) {
    const element = elementFromString(containsHTML);
    if (!element || !element.className) return failValidation();
    const parts = element.className.split(/\s+/);
    for (const part of parts) {
      const list = getIconList(part);
      if (!list) continue;
      const validated = list.validate(element.className, options);
      if (!validated) continue;
      element.className = validated;
      return element.outerHTML;
    }
    return "";
  } else {
    mhlog({ stringed }, { type: "warn", prefix: "didnt contain html", func });
    const list = getIconList(stringed);
    const validated = list.validator(stringed, options) ?? null;
    if (!list || !validated) return failValidation();
    return `<${options.element} class="${validated}"></${options.element}>`;
  }
}
export function getFontAwesomeString(...args) {
  const func = "getFontAwesomeString";
  const options = getFunctionOptions(args, { handlebars: true }) ?? {};
  const element = options?.element ?? "i";
  const stringed = args.filter((s) => !isEmpty(s)).map((s) => String(s));
  const failValidation = () => {
    mhlog({ args, options }, { localize: true, prefix: `MHL.Error.Validation.FontAwesomeIcon`, func });
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
  if (!isEmpty(options)) args.push(options);
  const classes = getFontAwesomeClasses(...args);
  if (!classes) return failValidation();

  return `<${element} class="${classes}"></${element}>`;
}

export function getGamesIconClasses(...args) {
  const func = "getGanesIconClasses";
  if (args.length === 0 || isPlainObject(args[0])) return "";
  const options = getFunctionOptions(args, { handlebars: true }) ?? {};
  const { infer, strict, fallback } = fu.mergeObject({ infer: true, strict: false, fallback: undefined }, options);
  const partsSeen = {
    glyph: null,
    others: [],
  };
  const parts = args
    .flat(Infinity)
    .filter((a) => !isEmpty(a))
    .map((a) => String(a));
  for (const part of parts) {
    const glyphMatches = /^(ginf-)?([-a-z0-9_]+)$/i.exec(part);
    if (glyphMatches) {
      const potential = glyphMatches[2].toLowerCase();
      const validIcon = isValidIcon(potential, "game-icons.net");
      if (partsSeen.glyph !== null) {
        //only add to others if it's not a duplicate explicit icon class, and if we're allowed to by options.strict
        if (!strict && (!glyphMatches[1] || !validIcon)) partsSeen.others.push(part);
        continue;
      }
      //it's a valid icon, and either starts with ginf- or we're allowed to infer
      if (validIcon && (glyphMatches[1] ? true : infer)) {
        partsSeen.glyph = `ginf-${potential}`;
        continue;
      }
    } else if (!strict) {
      partsSeen.others.push(part);
    }
  }
  if (!partsSeen.glyph) {
    if (fallback !== undefined) {
      partsSeen.glyph = fallback;
    } else {
      mhlog(
        { args: isEmpty(options) ? [...args, options] : args },
        { localize: true, prefix: `MHL.Error.Validation.GameIconsClasses`, func }
      );
      return "";
    }
  }
  return Object.values(partsSeen)
    .flat()
    .filter((p) => !isEmpty(p))
    .join(" ")
    .trim();
}

export function getFontAwesomeClasses(...inputs) {
  const func = "getFontAwesomeClasses";
  const options = getFunctionOptions(inputs, { handlebars: true }) ?? {};
  options.default ??= undefined;
  options.infer ??= true;
  const stringed = inputs
    .flat(Infinity)
    .filter((s) => !isEmpty(s))
    .map((s) => String(s));
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
      if (!options.infer && !fwMatch[1]) {
        partsSeen.others.push(part);
      } else if (partsSeen.fw === null) {
        partsSeen.fw = "fa-fw";
      }
      continue;
    }

    const sharpMatch = /^(fa-)?(sharp)$/i.exec(part);
    if (sharpMatch) {
      if (!options.infer && !sharpMatch[1]) {
        partsSeen.others.push(part);
      } else if (partsSeen.sharp === null) {
        partsSeen.sharp = "fa-sharp";
      }
      continue;
    }

    const styleMatches = /^(fa-)?(regular|thin|solid|light|duotone)$/i.exec(part);
    if (styleMatches) {
      if (!options.infer && !styleMatches[1]) {
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
      if (validIcon && (glyphMatches[1] ? true : options.infer)) {
        partsSeen.glyph = `fa-${potential}`;
        continue;
      }
    }
    //final fallback
    partsSeen.others.push(part);
  }
  if (!partsSeen.glyph) {
    if (options.default !== undefined) {
      partsSeen.glyph = options.default;
    } else {
      mhlog({ inputs }, { localize: true, prefix: `MHL.Error.Validation.FontAwesomeClasses`, func });
      return "";
    }
  }
  partsSeen.style ??= "fa-solid";
  return Object.values(partsSeen)
    .flat()
    .filter((p) => !isEmpty(p))
    .join(" ")
    .trim();
}

export function isValidIcon(input, limitTo = null) {
  return !!getIconList(input, limitTo);
}

export function getIconList(input, limitTo = null) {
  const func = `getIconList`;
  let parts;
  if (input instanceof HTMLElement) {
    parts = input.className.split(/\s+/);
  } else if (typeof input === "string") {
    parts = (elementFromString(input)?.className ?? input).split(/\s+/);
  } else if (Array.isArray(input)) {
    parts = input
      .flat(Infinity)
      .filter((e) => !isEmpty(e))
      .map((s) => String(s).trim());
  } else {
    return null;
  }

  limitTo = isEmpty(limitTo) ? null : Array.isArray(limitTo) ? limitTo : [limitTo];
  const validLists = CONFIG.MHL.iconLists
    .filter((l) => (limitTo ? limitTo.includes(l.name) : true))
    .toSorted((a, b) => (a.sort < b.sort ? -1 : a.sort === b.sort ? 0 : 1));
  for (const list of validLists) {
    for (const part of parts) {
      const testString = part.startsWith(list.prefix) ? part.substring(list.prefix.length) : part;
      if (list.list.includes(testString)) return list;
    }
  }
  return null;
}

export function getIconListFromCSS(sheetNeedle, prefix) {
  const sheet = Array.from(document.styleSheets).find((s) => s?.href?.includes(String(sheetNeedle)));
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
