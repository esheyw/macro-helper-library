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
  "test-setting": {
    config: true,
    default: true,
    name: "test setting 1",
    hint: "just need something valid",
    type: Boolean,
    scope: "world",
    hooks: {
      hook: "preCreateMacro",
      action: () => console.warn("PRECREATE!"),
    },
    group: "MHL.SettingGroup.Testing",
    visibility: {
      dependsOn: ["!test-client", "test-range"],
      test: (formValues, savedValues, visibile) => {
        return formValues['test-range'] > 5 && !formValues['test-client'];
      },
    },
  },
  "test-replacer": {
    config: true,
    scope: "world",
    name: null,
    hint: null,
    button: {
      label: null,
      icon: "fa-house",
      action: () => ui.notifications.info(`You're Home!`),
    },
    group: "MHL.SettingGroup.Testing",
  },
  "test-range": {
    config: true,
    default: 5,
    type: Number,
    scope: "world",
    name: null,
    hint: null,
    range: {
      min: 1,
      max: 10,
      step: 0.5,
    },
    group: "MHL.SettingGroup.Testing",
  },
  "test-choices": {
    config: true,
    default: "abbot",
    type: String,
    scope: "world",
    name: null,
    hint: null,
    choices: {
      abbot: null,
      bernie: null,
      costello: null,
    },
    hooks: [
      {
        hook: "hoverToken",
        action: (token) => console.warn(`hovered ${token.name}`),
        test: (value) => value === "costello",
      },
    ],
    // visibility: {
    //   dependsOn: "test-range",
    //   test: (n) => n > 5,
    // },
    group: "MHL.SettingGroup.Testing",
  },
  "test-color": {
    config: true,
    default: "#9f3f6f",
    type: String,
    name: null,
    hint: null,
    scope: "world",
    group: "MHL.SettingGroup.Testing",
  },
  "global-access": {
    config: true,
    default: true,
    type: Boolean,
    hint: null,
    name: null,
    scope: "world",
    onChange: (value) => {
      if (value) globalThis.mhl = MODULE().api;
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
  "no-default": {
    config: true,
    type: String,
    name: null,
    group: "MHL.SettingGroup.Testing",
  },
  "test-client": {
    config: true,
    type: Boolean,
    name: null,
    default: true,
  },
  "test-object": {
    type: Object,
    config: false,
    scope: "world",
    default: {
      a: 6,
      b: "hi",
      f: (v) => console.warn(v),
    },
  },
  "test-picker": {
    config: true,
    scope: "world",
    filePicker: "folder",
    name: null,
    hint: null,
  },
};

export function setting(key) {
  const SM = MODULE()?.settingsManager;
  if (SM?.initialized && game?.user) {
    return SM.get(key);
  }
  return undefined;
}
