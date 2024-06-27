import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import * as apps from "./apps/index.mjs";
import * as util from "./util/index.mjs";
import * as data from "./data/index.mjs";
import { SETTINGS, setting } from "./settings/settings.mjs";
import { MODULE_ID, VERIFIED_SYSTEM_VERSIONS, fu } from "./constants.mjs";
import { registerHandlebarsHelpers } from "./handlebars.mjs";
import { generateDefaultConfig, iconFontsDefaults } from "./config/config.mjs";
import hljs from "highlight.js/lib/core";
import hljsJSON from "highlight.js/lib/languages/json";
hljs.registerLanguage("json", hljsJSON);

export const MODULE = () => game.modules.get(MODULE_ID);
export const MHL = () => MODULE().api;
export const AIF = () => game.modules.get("additional-icon-fonts")?.active;
export const SM = () => MHL().managers.get(MODULE_ID);

Hooks.once("init", () => {
  // CONFIG.debug.hooks = true;
  const mod = MODULE();
  mod.api = {
    macros,
    apps,
    util,
    data,
    hljs,
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
  //special exposure for ease of grabbing MHL settings
  mod.api.mhlSetting = setting;

  CONFIG.MHL = generateDefaultConfig();
});
Hooks.once("i18nInit", () => {
  //do as much as possible here or later so errors can be localized
  const settingManagerOptions = {
    settingPrefix: "MHL.Setting",
    resetButtons: true,
    groups: {
      collapsible: false,
    },
    settings: SETTINGS,
  };
  new util.MHLSettingsManager(MODULE_ID, settingManagerOptions);
  CONFIG.MHL.iconFonts.push(...iconFontsDefaults);
  MHL().managers = util.MHLSettingsManager.managers;
});

Hooks.once("setup", () => {
  if (setting("legacy-access")) game.pf2emhl = MHL();
  if (setting("global-access")) globalThis.mhl = MHL();
});

Hooks.once("ready", () => {
  // handle defaults fallback as best as possible
  if (AIF()) {
    // if aif is ever enabled, record that fact
    SM().set("aif-enabled", true);
  } else {
    if (SM().beenSet("manager-defaults") && setting("aif-enabled")) {
      //todo: 'do you want to reset' dialog
    }
  }
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
