import { isEmpty, mhlog } from "./helpers/errorHelpers.mjs";
import { isPlainObject } from "./helpers/otherHelpers.mjs";
import { getIconListFromCSS } from "./helpers/iconHelpers.mjs";


class IconListsManager extends Array {
  constructor(...args) {
    super();
    if (!isEmpty(args)) this.push(...args);
  }

  #validateList(entry) {
    let invalid = false;
    let errorstr = "";
    if (!isPlainObject(entry)) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.PlainObject";
    } else if (typeof entry?.name !== "string" || this.find((e) => e.name === entry.name)) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.UniqueNameRequired";
    } else if (typeof entry?.prefix !== "string" || this.find((e) => e.prefix === entry.prefix)) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.UniquePrefixRequired";
    } else if (!Array.isArray(entry?.list) || !entry.list.every((e) => !!e && typeof e === "string")) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.NonEmptyListRequired";
    } else if ("sort" in entry && !Number.isInteger(entry.sort)) {
      invalid = true;
      errorstr = "MHL.IconListsManager.Error.SortInteger";
    } else if (!("sort" in entry) || this.find((e) => e.sort === sort)) {
      let sort = this.length * 5;
      while (this.find((e) => e.sort === sort)) sort += 5;
      entry.sort = sort;
    }
    if (invalid) {
      mhlog({ entry }, { type: "error", localize: true, prefix: errorstr, func: `IconListsManager#validateList` });
      return false;
    }
    return true;
  }

  push(...args) {
    for (const arg of args) {
      if (this.#validateList(arg)) super.push(arg);
    }
  }
}
export const DEFAULT_CONFIG = {};
Object.defineProperty(DEFAULT_CONFIG, "iconLists", {
  writable: false,
  configurable: false,
  value: new IconListsManager({
    name: "fontawesome",
    prefix: "fa-",
    list: getIconListFromCSS("fontawesome", "fa-"),
  }),
});
DEFAULT_CONFIG.iconLists.push({
  name: "game-icons-net",
  prefix: "ginf-",
  list: getIconListFromCSS("game-icons-net", "ginf-"),
});
