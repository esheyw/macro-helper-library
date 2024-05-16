import { mhlog } from "./helpers/errorHelpers.mjs";
import { isPlainObject } from "./helpers/otherHelpers.mjs";
import { getFontAwesomeClasses, getGameIconsClasses, getIconListFromCSS } from "./helpers/iconHelpers.mjs";

class IconFontsHandler {
  #validateList(entry, target) {
    let errorstr = "";
    const fail = (errorstr) => {
      mhlog({ entry }, { type: "error", localize: true, prefix: errorstr, func: `IconFontsHandler#validateList` });
      return false;
    };

    if (!isPlainObject(entry)) return fail("MHL.IconFontsHandler.Error.PlainObject");
    if (typeof entry.name !== "string" || target.find((e) => e.name === entry.name))
      return fail("MHL.IconFontsHandler.Error.UniqueNameRequired");
    if (!Array.isArray(entry.prefixes) || entry.prefixes.some((p) => target.flatMap((e) => e.prefixes).includes(p)))
      return fail("MHL.IconFontsHandler.Error.UniquePrefixRequired");
    entry.list ??= getIconListFromCSS(entry.name, entry.prefixes);
    if (!Array.isArray(entry.list) || !entry.list.every((e) => !!e && typeof e === "string"))
      return fail("MHL.IconFontsHandler.Error.NonEmptyListRequired");
    if ("schema" in entry) {
      //todo: glyph can't be deterministic validation
    }
    if ("sort" in entry && !Number.isInteger(entry.sort)) return fail("MHL.IconFontsHandler.Error.SortInteger");
    if (!("sort" in entry) || target.find((e) => e.sort === sort)) {
      mhlog(`MHL.IconFontsHandler.Fallback.Sort`, { type: "debug" });
      let sort = target.length * 5;
      while (target.find((e) => e.sort === sort)) sort += 5;
      entry.sort = sort;
    }
    if (errorstr) return fail(errorstr);
    return true;
  }

  set(target, name, value) {
    const numIdx = Number(name);
    if (Number.isInteger(numIdx)) {
      if (numIdx >= target.length && numIdx !== target.length) {
        name = target.length;
      } else {
        name = numIdx;
      }
      if (!this.#validateList(value, target)) {
        return false;
      }
    }
    return Reflect.set(target, name, value);
  }
}
export const DEFAULT_CONFIG = {};
Object.defineProperty(DEFAULT_CONFIG, "iconFonts", {
  writable: false,
  configurable: false,
  value: new Proxy(new Array(), new IconFontsHandler()),
});
