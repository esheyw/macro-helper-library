import { fu } from "../constants.mjs";
import { elementFromString } from "./DOMHelpers.mjs";
import { isEmpty, mhlog } from "./errorHelpers.mjs";
import { getFunctionOptions, getStringArgs, isPlainObject } from "./otherHelpers.mjs";

export function getIconHTMLString(...args) {
  const func = `getIconString`;
  const originalOptions = getFunctionOptions(args) ?? {};
  const options = fu.mergeObject({ strict: false, infer: true, element: "i" }, originalOptions);
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
    const validated = getIconClasses(element.className, options);
    if (!validated) return "";
    element.className = validated;
    return element.outerHTML;
  } else {
    const validated = getIconClasses(stringed, options) ?? null;
    if (!validated) return failValidation();
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

export function getGameIconsClasses(...args) {
  const func = "getGameIconsClasses";
  if (args.length === 0 || isPlainObject(args[0])) return "";
  const options = getFunctionOptions(args, { handlebars: true }) ?? {};
  const { infer, strict, fallback } = fu.mergeObject({ infer: true, strict: false, fallback: undefined }, options);
  const partsSeen = {
    glyph: null,
    others: [],
  };
  const parts = getStringArgs(args);
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

export function getIconClasses(...args) {
  const func = `getIconClasses`;
  if (args.length === 0 || isPlainObject(args[0])) return "";
  const options = getFunctionOptions(args) ?? {};
  const stringed = getStringArgs(args, { split: /\s+/ });
  const infer = options?.infer ?? true;
  const strict = options?.strict ?? false;
  let font;
  if (isPlainObject(options?.font)) {
    font = options.font;
  } else if (!("font" in options) || isEmpty(options.font) || typeof options.font === "string") {
    font = getIconFontEntry(stringed, typeof options?.font === "string" ? options.font : null);
    if (!font) return ""; //todo: logging
  }
  if (!Array.isArray(getStringArgs(font?.prefixes))) return ""; //todo: more logging
  const glyphDefault = {
    pattern: "[-a-z0-9_]+",
    required: true,
  };
  const glyphSchema = font?.schema?.glyph ?? {};
  const schema = fu.duplicate(font?.schema ?? {});
  delete schema.glyph; // ensure glyph is last entry
  schema.glyph = fu.mergeObject(glyphDefault, glyphSchema);
  const aliases = font?.aliases ?? {};
  const parts = stringed
    .map((s) => (s in aliases ? aliases[s] : s))
    .flatMap((s) => s.trim().toLowerCase().split(/\s+/));
  const partsSeen = Object.fromEntries(Object.keys(schema).map((slug) => [slug, []]));
  partsSeen.others = [];
  const precluded = [];
  for (const part of parts) {
    let matched = false;
    for (const [slug, data] of Object.entries(schema)) {
      let matches, exact;
      if ("value" in data) {
        if (slug === "glyph") {
          mhlog(`MHL.Error.Validation.IconSchemaGlyphExact`, { type: error, localize: true, func });
          return "";
        }
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
        mhlog({ matches, exact, infer, strict, part, slug }, { func, prefix: "match!" });
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
      }
    }
    //strict means no classes not explicitly in the schema
    if (!matched && !strict) {
      partsSeen.others.push(part);
    }
  }
  mhlog({ parts, ps: fu.duplicate(partsSeen), schema }, { prefix: "before", func });
  for (const [slug, data] of Object.entries(schema)) {
    if (data.required && partsSeen[slug].length === 0) {
      if ("default" in data) partsSeen[slug].push(data.default);
      else return ""; //todo: add logging
    }
  }
  mhlog({ ps: fu.duplicate(partsSeen) }, { prefix: "after", func });
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
  const stringed = getStringArgs(inputs);
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
  return !!getIconFontEntry(input, limitTo);
}

export function getIconFontEntry(input, limitTo = null) {
  const func = `getIconFontEntry`;
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
  mhlog({ parts, limitTo, allowedIconFonts }, { func });
  for (const font of allowedIconFonts) {
    for (const part of parts) {
      const prefix = font.prefixes.find((p) => part.startsWith(p));
      const testString = prefix ? part.substring(prefix.length) : part;
      if (font.list.includes(testString)) return font;
    }
  }
  return null;
}

export function getIconListFromCSS(needle, prefixes) {
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
