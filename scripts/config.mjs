import { mhlog } from "./helpers/errorHelpers.mjs";
import { isPlainObject } from "./helpers/otherHelpers.mjs";
import { getFontAwesomeClasses, getGamesIconClasses, getIconListFromCSS } from "./helpers/iconHelpers.mjs";

class IconListHandler {
  #validateList(entry, target) {
    let invalid = false;
    let errorstr = "";
    if (!isPlainObject(entry)) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.PlainObject";
    } else if (typeof entry?.name !== "string" || target.find((e) => e.name === entry.name)) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.UniqueNameRequired";
    } else if (typeof entry?.prefix !== "string" || target.find((e) => e.prefix === entry.prefix)) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.UniquePrefixRequired";
    } else if (!Array.isArray(entry?.list) || !entry.list.every((e) => !!e && typeof e === "string")) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.NonEmptyListRequired";
    } else if ("sort" in entry && !Number.isInteger(entry.sort)) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.SortInteger";
    } else if (typeof entry?.validator === "function") {
      invalid = true
      errorstr = "MHL.IconListsManager.Error.ValidatorFunction"
    } else if (!("sort" in entry) || target.find((e) => e.sort === sort)) {
      let sort = target.length * 5;
      while (target.find((e) => e.sort === sort)) sort += 5;
      entry.sort = sort;
    }
    if (invalid) {
      mhlog({ entry }, { type: "error", localize: true, prefix: errorstr, func: `IconListsManager#validateList` });
      return false;
    }
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
Object.defineProperty(DEFAULT_CONFIG, "iconLists", {
  writable: false,
  configurable: false,
  value: new Proxy(new Array(), new IconListHandler()),
});

DEFAULT_CONFIG.iconLists.push({
  name: "fontawesome",
  prefix: "fa-",
  list: getIconListFromCSS("fontawesome", "fa-"),
  validator: getFontAwesomeClasses,
});
DEFAULT_CONFIG.iconLists.push({
  name: "game-icons.net",
  prefix: "ginf-",
  list: getIconListFromCSS("game-icons-net", "ginf-"),
  validator: getGamesIconClasses,
});
