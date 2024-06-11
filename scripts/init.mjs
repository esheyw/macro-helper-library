import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import * as apps from "./apps/index.mjs";
import * as util from "./util/index.mjs";
import { SETTINGS, setting } from "./settings/settings.mjs";
import { MODULE_ID, VERIFIED_SYSTEM_VERSIONS, fu } from "./constants.mjs";
import { registerHandlebarsHelpers } from "./handlebars.mjs";
import { generateDefaultConfig, iconFontsDefaults } from "./config/config.mjs";
export const MODULE = () => game.modules.get(MODULE_ID);
Hooks.once("init", () => {
  // CONFIG.debug.hooks = true;
  const mod = MODULE();
  mod.api = {
    macros,
    apps,
    util,
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
  mod.settingsManager = new util.MHLSettingsManager(MODULE_ID, settingManagerOptions);
  //special exposure
  mod.api.mhlSetting = setting;
  //todo: remove before release
  mod.api.sm = mod.settingsManager;

  CONFIG.MHL = generateDefaultConfig();
  mod.init = true;
  mod.i18nInit = false;
  mod.setup = false;
});
Hooks.once("i18nInit", () => {
  //do as much here as possible so errors can be localized
  const mod = MODULE();
  CONFIG.MHL.iconFonts.push(...iconFontsDefaults);
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
