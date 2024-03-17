import { mhlog } from "./helpers/errorHelpers.mjs";
import { MODULE } from "./init.mjs";
export const SETTINGS = {
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
    scope: "world",
    group: "MHL.SettingGroup.ErrorHandling",
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
    group: "MHL.SettingGroup.Access",
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
    group: "MHL.SettingGroup.Access",
  },
};

export function setting(key) {
  const SM = MODULE()?.settingsManager;
  if (SM?.initialized && game?.user) {
    return SM.get(key);
  }
  return undefined;
}
