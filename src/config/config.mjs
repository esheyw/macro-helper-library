import { IconFontsHandler } from "./IconFontsHandler.mjs";
/**
 * @typedef {import("../_types.mjs").IconFontEntry} IconFontEntry
 */
/** @type {Array<IconFontEntry>} */
export const iconFontsDefaults = [
  {
    name: "fontawesome",
    prefixes: ["fa-"],
    aliases: {
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
    },
    schema: {
      fw: {
        pattern: "fw",
      },
      brands: {
        pattern: "brands",
      },
      sharp: {
        pattern: "sharp",
      },
      rotate: {
        pattern: "rotate-(90|180|270|by)",
      },
      flip: {
        pattern: "flip-(horizonal|vertical|both)",
      },
      style: {
        choices: ["solid", "regular", "duotone", "light", "thin"],
        required: true,
        default: "fa-solid",
      },
    },
  },
];
export function generateDefaultConfig() {
  const config = {
    typeIconMap: new Collection([
      [String, "format-quote-close-outline"],
      ["StringField", "format-quote-close-outline"],
      [Number, "numeric"],
      ["NumberField", "numeric"],
      [Boolean, "checkbox-outline"],
      ["BooleanField", "checkbox-outline"],
      [Object, "code-braces"],
      ["ObjectField", "code-braces"],
      ["SchemaField", "code-braces"],
      ["ColorField", "palette"],
      ["model", "database"],
      ["field", "code-braces"], //todo: find better
      ["function", "function"],
      ["unknown", "question flip-vertical"],
    ]),
    fallbackIconClasses: "fa-solid fa-question mhl-fallback-icon",
    disabledClasses: ["disabled-transparent", "disabled-hidden", "disabled-blurry"],
  };
  Object.defineProperty(config, "iconFonts", {
    writable: false,
    configurable: false,
    value: new Proxy(new Array(), new IconFontsHandler()),
  });
  return config;
}
