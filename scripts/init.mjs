import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import * as classes from "./classes/index.mjs";
import { SETTINGS, setting } from "./settings.mjs";
import { MODULE_ID, VERIFIED_SYSTEM_VERSIONS, fu } from "./constants.mjs";
import { registerHandlebarsHelpers } from "./handlebars.mjs";
import { DEFAULT_CONFIG } from "./config.mjs";
export const MODULE = () => game.modules.get(MODULE_ID);
Hooks.on("init", () => {
  // CONFIG.debug.hooks = true;
  const mod = MODULE();
  mod.api = {
    macros,
    classes,
    settingsManagers: new Collection(),
  };

  //helpers go in the root of the api object
  for (const [key, helper] of Object.entries(helpers)) {
    // only fill out system specific helpers if we're in that system
    if (key.startsWith("systemhelpers_")) {
      const system = key.substring(14);
      if (game.system.id !== system) continue;
      for (const [pkey, phelper] of Object.entries(helper)) {
        mod.api[pkey] = phelper;
      }
    }
    mod.api[key] = helper;
  }

  const settingManagerOptions = {
    settingPrefix: "MHL.Setting",
    disabledResetClass: "disabled-transparent",
    resetButtons: ["settings", "module"],
    groups: true,
    // sort: "a"
  };
  mod.settingsManager = new classes.MHLSettingsManager(MODULE_ID, settingManagerOptions);
  //special exposure
  mod.api.mhlSetting = setting;
  //todo: remove before release
  mod.api.sm = mod.settingsManager;

  CONFIG.MHL = DEFAULT_CONFIG;
  mod.init = true;
  mod.i18nInit = false;
  mod.setup = false;
});
Hooks.once("i18nInit", () => {
  //do as much here as possible so errors can be localized
  const mod = MODULE();
  CONFIG.MHL.iconFonts.push(
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
    }
  );
  mod.settingsManager.registerSettings(SETTINGS);
});
Hooks.once("setup", () => {
  const mod = MODULE();
  if (setting("legacy-access")) game.pf2emhl = mod.api;
  if (setting("global-access")) globalThis.mhl = mod.api;
});

Hooks.once("ready", () => {
  //register helpers late so checks can be done on existing helpers
  registerHandlebarsHelpers();
  const verifiedFor = VERIFIED_SYSTEM_VERSIONS[game.system.id] ?? false;
  if (verifiedFor && !fu.isNewerVersion(game.system.version, verifiedFor))
    helpers.MHLBanner(`MHL.Warning.SystemBelowVerified`, {
      context: { version: game.system.version, verified: verifiedFor },
      type: "warn",
      permanent: true,
    });
});
