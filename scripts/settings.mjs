import { MHLIconSettingsMenu } from "./classes/MHLIconSettingsMenu.mjs";
import { MHLSettingMenu } from "./classes/MHLSettingMenu.mjs";
import { MODULE } from "./init.mjs";

class IconSettingsModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      disabledClass: new fields.StringField({
        required: true,
        nullable: false,
        initial: "disabled-transparent",
        label: `MHL.Setting.IconSettings.DisabledClass.Label`,
        hint: `MHL.Setting.IconSettings.DisabledClass.Hint`,
        choices: ["disabled-transparent", "disabled-hidden", "disabled-blurry"],
        group: ".CSS",
      }),
      moduleResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-reply-all",
        label: "MHL.Setting.IconSettings.ModuleResetIcon.Label",
        hint: "MHL.Setting.IconSettings.ModuleResetIcon.Hint",
        // validate: (v) => isValidFA(v),
        // validationError: "is not a valid FontAwesome glyph.",
      }),
      groupResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-reply",
        label: "MHL.Setting.IconSettings.GroupResetIcon.Label",
        hint: "MHL.Setting.IconSettings.GroupResetIcon.Hint",
      }),
      settingResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-restore",
        label: "MHL.Setting.IconSettings.SettingResetIcon.Label",
        hint: "MHL.Setting.IconSettings.SettingResetIcon.Hint",
      }),
    };
  }
}
export const SETTINGS = {
  "disabled-class": {
    config: true,
    type: String,
    name: null,
    hint: null,
    group: ".Defaults",
    scope: "world",
    default: "disabled-transparent",
  },
  "icon-settings-menu": {
    type: MHLIconSettingsMenu,
    name: null,
    hint: null,
    label: null,
    icon: "fa-icons",
    group: ".Defaults",
    for: "icon-settings",
  },
  "icon-settings": {
    type: IconSettingsModel,
    config: false,
    group: ".Defaults",
    scope: "world",
    default: {
      disabledClass: "disabled-transparent",
      moduleGlyph: "mdi-reply-all-outline",
      groupGlyph: "mdi-reply-outline",
      settingGlyph: "mdi-restore",
    },
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
};

export function setting(key) {
  const SM = MODULE()?.settingsManager;
  if (SM.initialized) {
    return SM.get(key);
  }
  return undefined;
}
