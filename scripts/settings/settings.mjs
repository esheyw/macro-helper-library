import { MHLManagerDefaultsMenu } from "../apps/MHLManagerDefaultsMenu.mjs";
import { MODULE_ID } from "../constants.mjs";
import { getModelDefaults } from "../helpers/foundryHelpers.mjs";
import { MODULE } from "../init.mjs";
import { MHLSettingsManager } from "../util/MHLSettingsManager.mjs";
import { SettingManagerDefaults } from "./models/SettingsManagerDefaults.mjs";

export const SETTINGS = () => ({
  "manager-defaults-menu": {
    type: MHLManagerDefaultsMenu,
    name: null,
    hint: null,
    label: null,
    icon: "icons",
    group: ".SettingsManager",
    for: "sm-settings",
  },
  "manager-defaults": {
    type: SettingManagerDefaults,
    config: false,
    group: ".SettingsManager",
    scope: "world",
    default: getModelDefaults(SettingManagerDefaults),
  },
  "debug-mode": {
    config: true,
    type: Boolean,
    name: null,
    hint: null,
    scope: "client",
    group: ".ErrorHandling",
    default: false,
  },
  "log-level": {
    config: true,
    type: String,
    name: null,
    hint: null,
    choices: {
      debug: null,
      info: null,
      warn: null,
      error: null,
    },
    default: "warn",
    scope: "client",
    group: ".ErrorHandling",
  },
  "global-access": {
    config: true,
    default: true,
    type: Boolean,
    hint: null,
    name: null,
    scope: "world",
    onChange: (value) => {
      if (!!value) globalThis.mhl = MODULE().api;
      else delete globalThis.mhl;
    },
    group: ".Access",
  },
  "legacy-access": {
    config: true,
    default: false,
    type: Boolean,
    hint: null,
    name: null,
    scope: "world",
    onChange: (value) => {
      if (value) game.pf2emhl = MODULE().api;
      else delete game.pf2emhl;
    },
    group: ".Access",
  },
});

export function setting(key) {
  const SM = MHLSettingsManager.managers.get(MODULE_ID)
  if (SM?.initialized) {
    return SM.get(key);
  }
  return undefined;
}
