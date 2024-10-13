import { fu, MODULE_ID } from "../constants.mjs";
import { hasTags, localize } from "./stringHelpers.mjs";
import { createHTMLElement, elementFromString } from "./DOMHelpers.mjs";
import { escapeHTML } from "./stringHelpers.mjs";
import { logCastString, mhlog } from "./errorHelpers.mjs";
import { isEmpty } from "./otherHelpers.mjs";
import { getStringArgs } from "./otherHelpers.mjs";

export function getIconHTMLString(input, { element = "i", infer = true, strict = false, fallback = true, font } = {}) {
  const func = `getIconHTMLString`;
  const options = { element, infer, strict, fallback, font };
  const fallbackIconClasses = getFallbackIconClasses(fallback);
  const failureReturn = !fallbackIconClasses
    ? ""
    : `<${element} class="${fallbackIconClasses}" 
          data-tooltip-class="mhl-pre-tooltip" 
          data-tooltip="${localize(`MHL.Fallback.Icon.Tooltip`, { input: escapeHTML(JSON.stringify(input)) })}">`;
  const context = {
    ...(fallbackIconClasses && { fallback: { key: "MHL.Fallback.Icon.Classes", context: { fallbackIconClasses } } }),
  };

  // don't split yet so we can test for whole elements
  const stringed = getStringArgs(input, { split: false });
  if (stringed.length === 0) {
    mhlog({ input, ...options }, { func, context, text: "MHL.Validation.Generic" });
    return failureReturn;
  }
  const containsHTML = stringed.find((s) => hasTags(s));
  if (containsHTML) {
    const node = elementFromString(htmlString);
    if (!node || !node.className) {
      mhlog({ input, ...options }, { func, context, text: "MHL.Validation.Icon.ExistingHTML" });
      return failureReturn;
    }
    const validated = getIconClasses(node.className, { infer, strict, fallback, font, log: false });
    // getIconClasses already logged
    if (!validated || validated === fallbackIconClasses) return failureReturn;
    node.className = validated;
    return node.outerHTML;
  } else {
    const validated = getIconClasses(stringed, { options });
    // getIconClasses already logged
    if (isEmpty(validated) || validated === fallbackIconClasses) return failureReturn;
    return `<${element} class="${validated}"></${element}>`;
  }
}
/**
 * Gets the current fallback icon classes for the given context
 *
 * @param {boolean|string} fallback The classList string to return if icon validation fails. If `true`, uses `CONFIG["macro-helper-library"].fallbackIconClasses`.
 * If `false`, returns `""` on failure.
 * @returns {string|null}
 */
function getFallbackIconClasses(fallback = true) {
  const func = `getFallbackIconClasses`;
  let fallbackIconClasses;
  if (fallback === true) {
    fallbackIconClasses = getIconClasses(CONFIG[MODULE_ID].fallbackIconClasses, { fallback: false });
  } else if (fallback !== false) {
    fallbackIconClasses = getIconClasses(logCastString(fallback, "fallback", { func }), { fallback: false });
  }

  return fallbackIconClasses || null;
}
/**
 * @typedef {import("../_types.mjs").IconFontEntry} IconFontEntry
 */
/**
 * Returns a set of valid icon font css classes, or `""` if validation fails
 * @param {string|string[]} input The input to process
 * @param {object}         [options={}]
 * @param {boolean}        [options.infer=true] Whether or not to check if a given input works with any of the registered icon font prefixes.
 * Uses the first found according to icon font sort order (FA first unless you've meddled with it in your world)
 * @param {boolean}        [options.strict=false] If true, will strip any classes that don't appear in the icon font schema
 * @param {string|boolean} [options.fallback=true] The classList string to return if icon validation fails. If `true`, uses `CONFIG["macro-helper-library"].fallbackIconClasses`.
 * If `false`, returns `""` on failure.
 * @param {IconFontEntry|string|string[]} [options.font] The icon font entry, or string name of a registered entry, or array of such, to limit inference to
 * @param {boolean} [log=true] Whether to log fallback or validation failure or rely on the caller to do so
 * @returns {string} A valid classlist for the provided/inferred icon glyph, or `""` if none found and fallback was `false` or malformed
 */
export function getIconClasses(input, { infer = true, strict = false, fallback = true, font } = {}) {
  const func = `getIconClasses`;
  const stringed = getStringArgs(input, { map: (s) => s.toLowerCase() });
  const fallbackIconClasses = getFallbackIconClasses(fallback);
  const fontEntry = getIconFontEntry(stringed, font);
  if (!fontEntry) {
    // getIconFontEntry already logged
    return fallbackIconClasses ?? "";
  }
  const glyphDefault = {
    pattern: "[-a-z0-9_]+",
    required: true,
  };
  const glyphSchema = fontEntry.schema.glyph ?? {};
  const schema = fu.duplicate(fontEntry.schema);
  delete schema.glyph; // ensure glyph is last entry
  schema.glyph = fu.mergeObject(glyphDefault, glyphSchema, { inplace: false });
  const aliases = fontEntry.aliases ?? {};
  // pass through getStringArgs again because some aliases expand to more than one class
  const parts = getStringArgs(stringed, { map: (s) => (s in aliases ? aliases[s] : s) });
  //most parts have an implicit max of 1, but its easier to handle if they're all arrays
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
        const prefixes = getStringArgs(data.prefixes ?? fontEntry.prefixes);
        matches = new RegExp(
          `^(${prefixes.map(RegExp.escape).join("|")})?(${
            "choices" in data ? data.choices.map(RegExp.escape).join("|") : data.pattern ?? "\n"
            //presumably/hopefully a \n will never match?
            //TODO: what did I mean by that?!
          })$`,
          "i"
        ).exec(part);
      }
      if (matches || exact) {
        const prefixFound = matches ? !!matches[1] : false;
        // not exact, can't infer, and no prefix
        if (!exact && !infer && !prefixFound) continue;
        // matched = don't add to others if otherwise unhandled
        matched = true;
        // an exact match is precluded, discard
        if (precluded.includes(slug) && (exact || prefixFound)) continue;

        if (partsSeen[slug].length >= (data.max ?? 1)) {
          //cap reached, discard
          if (!prefixFound) matched = false; // if we were inferring, it can get dumped to others
          continue;
        }
        if (slug === "glyph" && !isValidIcon(matches[2].toLowerCase(), fontEntry.name)) {
          matched = false; // dump to fallback handling
          continue;
        }
        partsSeen[slug].push(exact ? part : (matches[1] || data.prefixes?.[0] || fontEntry.prefixes[0]) + matches[2]);
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
      if ("default" in data) {
        partsSeen[slug].push(data.default);
      } else {
        mhlog(
          { input, infer, strict, fallback, font },
          {
            func,
            text: "MHL.Validation.Icon.MissingRequired",
            context: {
              ...(fallbackIconClasses && {
                fallback: { key: "MHL.Fallback.Icon.Classes", context: { fallbackIconClasses } },
              }),
              ...(font && { allowed: { key: "MHL.Allowed", transform: "toLocaleLowercase" } }),
              ...(!font && { registered: { key: "MHL.Registered", transform: "toLocaleLowercase" } }),
            },
          }
        );
      }
    }
  }
  return getStringArgs(Object.values(partsSeen), { split: false, join: true });
}

export function isValidIcon(input, limitTo = null) {
  return !!getIconFontEntry(input, limitTo);
}

/**
 * Returns the first icon font entry a given input is valid for, or null if none found
 * @param {string|string[]} input StringArgs input
 * @param {string|string[]} limitTo A font or fonts to limit the search to (by `name`)
 * @returns {string|null}
 */
export function getIconFontEntry(input, limitTo = null) {
  const func = `getIconFontEntry`;
  let parts;
  if (input instanceof HTMLElement) {
    parts = getStringArgs(input.className);
  } else if (typeof input === "string") {
    parts = getStringArgs(elementFromString(input)?.className ?? input);
  } else if (Array.isArray(input)) {
    parts = getStringArgs(input);
  } else {
    mhlog({ input, limitTo }, { func, text: "MHL.Validation.Generic" });
    return null;
  }

  limitTo = !isEmpty(limitTo) ? getStringArgs(limitTo) : null;
  const allowedIconFonts = CONFIG[MODULE_ID].iconFonts
    .filter((f) => (limitTo ? limitTo.includes(f.name) : true))
    .toSorted((a, b) => (a.sort < b.sort ? -1 : a.sort === b.sort ? 0 : 1));
  for (const font of allowedIconFonts) {
    for (const part of parts) {
      const prefix = font.prefixes.find((p) => part.startsWith(p));
      const testString = prefix ? part.substring(prefix.length) : part;
      if (font.list.includes(testString)) return font;
    }
  }
  mhlog({ parts, input, limitTo }, { func, text: "MHL.Validation.Icon.Generic" });
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
export function getTypeIcon(type) {
  const map = CONFIG[MODULE_ID].typeIconMap;
  let glyph, tooltip;
  if ((glyph = map.get(type))) {
    tooltip = type.name;
  } else if ((glyph = map.get(type?.constructor?.name))) {
    tooltip = type.constructor.name;
  } else if (type instanceof foundry.data.fields.DataField) {
    glyph = map.get("field");
    tooltip = type.constructor.name;
  } else if (type?.prototype instanceof foundry.abstract.DataModel) {
    glyph = map.get("model");
    tooltip = `DataModel: ${type.name}`;
  } else if (typeof type === "function") {
    glyph = map.get("function");
    tooltip = `Function: ${type.name}`;
  } else {
    glyph = map.get("unknown");
    tooltip = `Unknown: ${String(type)}`;
    mhlog({ type }, { func: "mhl-settingTypeIcon", text: "MHL.SettingsManagerReset.Error.UnknownSettingType" });
  }
  return { glyph, tooltip };
}
export function getTypeIconHTML(type) {
  let { glyph, tooltip } = getTypeIcon(type);
  const primaryIcon = getIconHTMLString(glyph);
  let secondaryIcon;
  if (type instanceof foundry.data.fields.SetField) {
    const { glyph: innerGlyph, tooltip: innerTooltip } = getTypeIcon(type.element);
    secondaryIcon = `<span class="inner-type">${getIconHTMLString(innerGlyph)}</span>`;
    tooltip += `(${innerTooltip})`;
  }
  const span = createHTMLElement("span", { dataset: { tooltip } });
  span.innerHTML = primaryIcon + (secondaryIcon ? `(${secondaryIcon})` : "");
  return span.outerHTML;
}
