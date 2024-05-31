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
  {
    name: "materialdesign",
    prefixes: ["mdi-"],
    schema: {
      domain: {
        required: true,
        value: "mdi",
        default: "mdi",
      },
      rotate: {
        choices: ["rotate-45", "rotate-90", "rotate-135", "rotate-180", "rotate-225", "rotate-270", "rotate-315"],
        precludes: "flip",
      },
      flip: {
        choices: ["flip-h", "flip-v"],
        precludes: "rotate",
      },
      spin: {
        value: "spin",
      },
    },
  },
  {
    name: "game-icons.net",
    prefixes: ["ginf-"],
  },
  {
    name: "boxicons",
    prefixes: ["bx-", "bxs-", "bxl-"],
    schema: {
      domain: {
        required: true,
        value: "bx",
        default: "bx",
      },
      fw: {
        prefixes: ["bx-"],
        pattern: "fw",
      },
      size: {
        prefixes: ["bx-"],
        choices: ["xs", "sm", "md", "lg"],
      },
      flip: {
        prefixes: ["bx-"],
        prefixes: ["bx-"],
        precludes: "rotate",
        choices: ["flip-horizontal", "flip-vertical"],
      },
      rotate: {
        prefixes: ["bx-"],
        precludes: "flip",
        choices: ["rotate-90", "rotate-180", "rotate-270"],
      },
      border: {
        prefixes: ["bx-"],
        choices: ["border", "border-circle"],
      },
      animation: {
        prefixes: ["bx-"],
        choices: ["spin", "tada", "flashing", "burst", "fade-left", "fade-right", "fade-up", "fade-down"],
      },
      hover: {
        prefixes: ["bx-"],
        choices: ["spin", "tada", "flashing", "burst", "fade-left", "fade-right", "fade-up", "fade-down"],
      },
    },
  },
  {
    name: "jamicons",
    prefixes: ["jam-"],
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
