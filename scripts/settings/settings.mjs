import { MHLManagerDefaultsMenu } from "../apps/MHLManagerDefaultsMenu.mjs";
import { MODULE_ID } from "../constants.mjs";
import { getModelDefaults } from "../helpers/foundryHelpers.mjs";
import { MODULE } from "../init.mjs";
import { MHLSettingsManager } from "../util/MHLSettingsManager.mjs";
import { SettingManagerDefaults } from "./models/SettingsManagerDefaults.mjs";

export const SETTINGS = () => ({
  "manager-defaults": {
    type: SettingManagerDefaults,
    config: false,
    group: ".SettingsManager",
    scope: "world",
    default: getModelDefaults(SettingManagerDefaults),
  },
  "manager-defaults-menu": {
    type: MHLManagerDefaultsMenu,
    name: true,
    hint: true,
    label: true,
    icon: "icons",
    group: ".SettingsManager",
    for: "manager-defaults",
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
    onChange: (value) => {
      if (!!value) globalThis.mhl = MHL();
      else delete globalThis.mhl;
    },
    group: ".Access",
  },
  "legacy-access": {
    config: true,
    default: false,
    type: Boolean,
    hint: true,
    name: true,
    scope: "world",
    onChange: (value) => {
      if (value) game.pf2emhl = MHL();
      else delete game.pf2emhl;
    },
    group: ".Access",
  },
  "aif-enabled": {
    config: false,
    type: Boolean,
    scope: "world",
  },
});

export function setting(key) {
  const SM = MHLSettingsManager.managers.get(MODULE_ID);
  if (SM?.initialized) {
    return SM.get(key);
  }
  return undefined;
}
