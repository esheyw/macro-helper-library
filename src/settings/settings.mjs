import { MHLManagerDefaultsMenu } from "../apps/MHLManagerDefaultsMenu.mjs";
import { MODULE_ID } from "../constants.mjs";
import { mhlError } from "../helpers/errorHelpers.mjs";
import { MHL, SM } from "../init.mjs";
import { MHLSettingsManager } from "../util/MHLSettingsManager.mjs";
import { SettingManagerDefaults } from "./models/SettingsManagerDefaults.mjs";

export const SETTINGS = () => ({
  "manager-defaults": {
    type: SettingManagerDefaults,
    config: false,
    group: ".SettingsManager",
    scope: "world",
    default: SettingManagerDefaults.prototype.schema.getInitialValue(),
  },
  "manager-defaults-menu": {
    type: MHLManagerDefaultsMenu,
    name: true,
    hint: true,
    label: true,
    icon: "icons",
    group: ".SettingsManager",
    for: "manager-defaults",
    restricted: true,
  },
  "accordion-speed": {
    name: true,
    hint: true,
    type: Number,
    range: {
      min: 10,
      max: 1000,
      step: 10,
    },
    default: 350,
    config: true,
    scope: "world",
    group: ".SettingsManager",
    onChange: MHLSettingsManager.updateAccordionSpeed
  },
  "debug-mode": {
    config: true,
    type: Boolean,
    name: true,
    hint: true,
    scope: "client",
    group: ".ErrorHandling",
    default: false,
  },
  "log-level": {
    config: true,
    type: String,
    name: true,
    hint: true,
    choices: {
      debug: true,
      info: true,
      warn: true,
      error: true,
    },
    default: "warn",
    scope: "client",
    group: ".ErrorHandling",
  },
  "global-access": {
    config: true,
    default: true,
    type: Boolean,
    hint: true,
    name: true,
    scope: "world",
    onChange: toggleGlobalAccess,
    group: ".Access",
  },
  "legacy-access": {
    config: true,
    default: false,
    type: Boolean,
    hint: true,
    name: true,
    scope: "world",
    onChange: toggleLegacyAccess,
    group: ".Access",
  },
});

export function toggleGlobalAccess(value) {
  if (value) {
    if ("mhl" in globalThis && globalThis.mhl !== MHL()) {
      //todo: localize?
      SM().set("global-access", false, { defer: true });
      throw mhlError("mhl is already registered in the global scope");
    }
    globalThis.mhl = MHL();
  } else if (globalThis.mhl === MHL()) delete globalThis.mhl;
}

export function toggleLegacyAccess(value) {
  if (value) {
    if ("pf2emhl" in game && game.pf2emhl !== MHL()) {
      //todo: localize?
      SM().set("legacy-access", false, { defer: true });
      const errorstr = game.modules.get("pf2e-macro-helper-library")?.active
        ? "Disable PF2e Macro & Helper Library before enabling legacy access."
        : "game.pf2emhl already registered by an unknown source, cannot enable legacy access.";
      throw mhlError(errorstr);
    }
    globalThis.mhl = MHL();
  } else if (globalThis.mhl === MHL()) delete globalThis.mhl;
}

export function setting(key, { suppress = false } = {}) {
  const SM = MHLSettingsManager.managers.get(MODULE_ID);
  if (SM?.initialized) {
    return SM.get(key);
  } else {
    let value;
    try {
      value = game.settings.get(MODULE_ID, key);
    } catch (error) {
      if (!suppress) console.error(error);
      return undefined;
    }
    return value;
  }
}
