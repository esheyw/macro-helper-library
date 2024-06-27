import { getFunctionOptions, isEmpty, isPlainObject } from "./helpers/index.mjs";
import { mhlocalize, signedInteger, sluggify } from "./helpers/stringHelpers.mjs";
import { getIconHTMLString } from "./helpers/iconHelpers.mjs";
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
  sluggify: (value) => sluggify(String(value)),
};
const mhlOriginals = {
  mhlocalize: (value, options) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    const data = options.hash;
    return new Handlebars.SafeString(mhlocalize(value, data));
  },
  mhlIsColor: (value) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    return /^#[a-f0-9]{6}$/i.test(value);
  },
  mhlYesOrNo: (value) => {
    return !!value ? mhlocalize("Yes") : mhlocalize("No");
  },
  mhlCheckOrX: (value) => {
    const type = !!value ? "check" : "xmark";
    return new Handlebars.SafeString(`<i class="fa-solid fa-square-${type}"></i>`);
  },
  mhlIcon: (...args) => {
    return new Handlebars.SafeString(getIconHTMLString(...args));
  },
  contains: (...args) => {
    const options = getFunctionOptions(args);
    const [haystack, ...needles] = args;
    if (isEmpty(haystack) || (!Array.isArray(haystack) && typeof haystack !== "string") || isEmpty(needles))
      return false;
    const fn = options.all ? "every" : "some";
    return needles[fn]((n) => haystack.includes(n));
  },
  // will replace pf2e's json helper in pf2e worlds, but if the 2nd property is omitted no behaviour changes 
  // so I'm doin it unless someone finds something it breaks
  json: (data, indent) => JSON.stringify(data, null, Number(indent)),
  // selectOptionsGrouped: (...args) => {
  //   const options = getFunctionOptions(args);
  //   const opts = args[0];
  //todo: finish
  // }
};
export function registerHandlebarsHelpers() {
  //register originals
  Handlebars.registerHelper(mhlOriginals);

  //register various helpers conditionally
  for (const [name, func] of Object.entries(pf2eReplacements)) {
    if (!(name in Handlebars.helpers)) Handlebars.registerHelper(name, func);
  }
}
