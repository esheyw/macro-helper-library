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

export function getIconClasses(...args) {
  const func = `getIconClasses`;
  if (args.length === 0 || isPlainObject(args[0])) return "";
  const options = getFunctionOptions(args) ?? {};
  const stringed = getStringArgs(args, { map: (s) => s.toLowerCase() });
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
  const schema = fu.duplicate(font.schema ?? {});
  delete schema.glyph; // ensure glyph is last entry
  schema.glyph = fu.mergeObject(glyphDefault, glyphSchema);
  const aliases = font.aliases ?? {};
  mhlog({stringed, aliases}, {func, prefix: 'before alias', dupe: true})
  const parts = getStringArgs(stringed,{map:(s) => (s in aliases ? aliases[s] : s)})    
  mhlog({parts}, {func, prefix: 'after alias', dupe: true})
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
        break;
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
