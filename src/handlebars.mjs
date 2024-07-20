import { getFunctionOptions, isEmpty, isPlainObject, mhlog } from "./helpers/index.mjs";
import { localize, signedInteger, sluggify } from "./helpers/stringHelpers.mjs";
import { getIconHTMLString } from "./helpers/iconHelpers.mjs";
import { MODULE_ID } from "./constants.mjs";
//the following are provided by pf2e at least, maybe other systems; only register if necessary
const pf2eReplacements = {
  add: (a, b) => Number(a) + Number(b),
  any: (...args) => args.slice(0, -1).some((a) => !!a),
  capitalize: (value) => String(value).capitalize(),
  coalesce: (...args) => args.find((a) => a !== undefined && a !== null) ?? null,
  disabled: (condition) => (condition ? "disabled" : ""),
  includes: (data, element) => {
    if (Array.isArray(data)) return data.includes(element);
    if (typeof data === "string") return data.includes(String(element));
    if (data instanceof Set) return data.has(element);
    if (isPlainObject(data) && (typeof element === "number" || typeof element === "string")) {
      return element in data;
    }
    return false;
  },
  isNullish: (value) => value === undefined || value === null,
  isNumber: (value) => typeof value === "number",

  lower: (str) => String(str).toLowerCase(),
  multiply: (a, b) => Number(a) * Number(b),
  nor: (...args) => !args.slice(0, -1).some((a) => !!a),
  pad: (value, length, character) => `${value}`.padStart(length, character),
  percentage: (value, max) => (Number(value) * 100) / Number(max),
  raw: function (options) {
    return options.fn(this);
  },
  signedInteger: (value, options) => {
    const number = Number(value) || 0;
    const emptyStringZero = !!options.hash.emptyStringZero;
    const zeroIsNegative = !!options.hash.zeroIsNegative;
    return signedInteger(number, { emptyStringZero, zeroIsNegative });
  },
};
const mhlOriginals = {
  "mhl-localize": (value, options) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    const data = options.hash;
    return new Handlebars.SafeString(localize(value, data));
  },
  "mhl-isColor": (value) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    return /^#[a-f0-9]{6}$/i.test(value);
  },
  "mhl-yesOrNo": (value) => {
    return !!value ? localize("Yes") : localize("No");
  },
  "mhl-checkOrX": (value) => {
    const type = !!value ? "check" : "xmark";
    return new Handlebars.SafeString(`<i class="fa-solid fa-square-${type}"></i>`);
  },
  "mhl-icon": (stringOrStrings, options) => {
    return new Handlebars.SafeString(getIconHTMLString(stringOrStrings, options.hash));
  },
  "mhl-contains": (...args) => {
    const options = getFunctionOptions(args);
    const [haystack, ...needles] = args;
    if (isEmpty(haystack) || (!Array.isArray(haystack) && typeof haystack !== "string") || isEmpty(needles))
      return false;
    const fn = options.all ? "every" : "some";
    return needles[fn]((n) => haystack.includes(n));
  },
  "mhl-json": (data, indent) => JSON.stringify(data, null, Number(indent)),
  "mhl-sluggify": (value, options) => sluggify(String(value), options.hash),
  "mhl-array": (...args) => args.slice(0, -1),
  "mhl-settingTypeIcon": (type, options) => {
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
  },
};
export function registerHandlebarsHelpers() {
  //register originals
  Handlebars.registerHelper(mhlOriginals);

  // keep system replacement helpers separate for.. reasons? used to matter. todo: revisit
  for (const [name, func] of Object.entries(pf2eReplacements)) {
    Handlebars.registerHelper(`mhl-${name}`, func);
  }
}
