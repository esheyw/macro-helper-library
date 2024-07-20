import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import * as apps from "./apps/index.mjs";
import * as util from "./util/index.mjs";
// import * as data from "./data/index.mjs";
import * as elements from "./elements/index.mjs";
import { SETTINGS, setting, toggleGlobalAccess, toggleLegacyAccess } from "./settings/settings.mjs";
import { MODULE_ID, VERIFIED_SYSTEM_VERSIONS, fu } from "./constants.mjs";
import { registerHandlebarsHelpers } from "./handlebars.mjs";
import { generateDefaultConfig, iconFontsDefaults } from "./config/config.mjs";
import hljs from "highlight.js/lib/core";
import hljsJSON from "highlight.js/lib/languages/json";
hljs.registerLanguage("json", hljsJSON);

export const MODULE = () => game.modules.get(MODULE_ID);
export const MHL = () => MODULE().api;
export const AIF_ACTIVE = () => game.modules.get("additional-icon-fonts")?.active;
export const SM = () => MHL().managers.get(MODULE_ID);

Hooks.once("init", () => {
  // CONFIG.debug.hooks = true;
  const mod = MODULE();
  mod.api = {
    macros,
    apps,
    util,
    // data,
    hljs,
    elements,
  };

  //helpers go in the root of the api object
  for (const [key, helper] of Object.entries(helpers)) {
    // only fill out system specific helpers if we're in that system
    if (key === "systemHelpers") {
      const systemHelpers = helper[game.system.id];
      if (!systemHelpers) continue;
      for (const [systemKey, systemHelper] of Object.entries(systemHelpers)) {
        mod.api[systemKey] = systemHelper;
      }
      continue;
    }
    mod.api[key] = helper;
  }
  //special exposure for ease of grabbing MHL settings
  mod.api.mhlSetting = setting;

  CONFIG[MODULE_ID] = generateDefaultConfig();
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
    cleanOnReady: true,
  };
  new util.MHLSettingsManager(MODULE_ID, settingManagerOptions);
  CONFIG[MODULE_ID].iconFonts.push(...iconFontsDefaults);
  MHL().managers = util.MHLSettingsManager.managers;
});

Hooks.once("setup", () => {
  if (game.user !== helpers.activeRealGM()) return;
  const aifManager = MHL().managers.get("additional-icon-fonts");
  const mdi = aifManager.get("materialdesign");
  if (!mdi) {
    aifManager.set("materialdesign", true, {
      defer: true,
      deferMessage: async () =>
        apps.MHLDialog.confirm({
          title: "Enable Material Design Font",
          content:
            "Macro & Helper Library requires the Material Design font from Additional Icon Fonts to be enabled or several icons will fail to display. Enable?",
        }),
    });
  }
  toggleLegacyAccess(setting("legacy-access"));
  toggleGlobalAccess(setting("global-access"));
});

Hooks.once("ready", () => {
  //register helpers late so checks can be done on existing helpers
  registerHandlebarsHelpers();

  const verifiedFor = VERIFIED_SYSTEM_VERSIONS[game.system.id] ?? false;
  if (verifiedFor && game.system.version !== verifiedFor && !fu.isNewerVersion(game.system.version, verifiedFor))
    helpers.mhlWarn(`MHL.Warning.SystemBelowVerified`, {
      context: { version: game.system.version, verified: verifiedFor },
      permanent: true,
    });
});
