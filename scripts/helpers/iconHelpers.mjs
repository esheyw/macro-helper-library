import { fu } from "../constants.mjs";
import { mhlocalize } from "./stringHelpers.mjs";
import { elementFromString, escapeHTML } from "./HTMLHelpers.mjs";
import { isEmpty, mhlog } from "./errorHelpers.mjs";
import { getFunctionOptions, getStringArgs, isPlainObject } from "./otherHelpers.mjs";

export function getIconHTMLString(...args) {
  const func = `getIconString`;
  const options = getFunctionOptions(args) ?? {};
  const element = options.element ?? "i";
  const stringed = getStringArgs(args);
  const failValidation = () => {
    mhlog({ args, options }, { type: "warn", prefix: `MHL.Error.Validation.IconGeneric`, func });
    return "";
  };
  if (stringed.length === 0) return failValidation();
  const containsHTML = stringed.find((s) => /<[^>]+>/.test(s));
  if (containsHTML) {
    const node = elementFromString(containsHTML);
    if (!node || !node.className) return failValidation();
    const validated = getIconClasses(node.className, options);
    if (!validated) return "";
    node.className = validated;
    return node.outerHTML;
  } else {
    const validated = getIconClasses(stringed, { options });
    if (isEmpty(validated)) return failValidation();
    return `<${element} class="${validated}"${
      validated === (options.fallback ?? CONFIG.MHL.fallbackIcon)
        ? `data-tooltip-class="mhl-pre-tooltip" data-tooltip="${mhlocalize(`MHL.Warning.Fallback.FallbackIconTooltip`, {
            args: escapeHTML(JSON.stringify(args)),
          })}"`
        : ``
    }></${element}>`;
  }
}

export function getIconClasses(...args) {
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
      mhlog({ args, options }, { func, prefix: `MHL.Warning.Fallback.FallbackIcon`, context: { fallback } });
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
  schema.glyph = fu.mergeObject(glyphDefault, glyphSchema);
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
        // mhlog({ matches, exact, infer, strict, part, slug }, { func, prefix: "match!" });
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
