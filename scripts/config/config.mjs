import { IconFontsHandler } from "./IconFontsHandler.mjs";
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
      style: {
        choices: ["solid", "regular", "duotone", "light", "thin"],
        required: true,
        default: "fa-solid",
      },
    },
  },
];
export function generateDefaultConfig() {
  const config = {};
  Object.defineProperty(config, "iconFonts", {
    writable: false,
    configurable: false,
    value: new Proxy(new Array(), new IconFontsHandler()),
  });
  config.fallbackIcon = "fa-solid fa-question mhl-fallback-icon";
  config.disabledClasses = ["disabled-transparent", "disabled-hidden", "disabled-blurry"];
  return config;
}
