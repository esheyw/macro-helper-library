import { MHLManagerSettingsMenu } from "./apps/MHLManagerSettingsMenu.mjs";
import { MODULE } from "./init.mjs";

class SettingManagerDefaultsModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      disabledClass: new fields.StringField({
        required: true,
        nullable: false,
        initial: "disabled-transparent",
        label: `MHL.Setting.ManagerSettings.DisabledClass.Label`,
        hint: `MHL.Setting.ManagerSettings.DisabledClass.Hint`,
        choices: () => CONFIG.MHL.diabledClasses,
        group: ".CSS",
      }),
      accordionIndicatorIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "fa-chevron-down",
        label: "MHL.Setting.ManagerSettings.AccordionIndicatorIcon.Label",
        hint: "MHL.Setting.ManagerSettings.AccordionIndicatorIcon.Hint",
      }),
      moduleResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-reply-all",
        label: "MHL.Setting.ManagerSettings.ModuleResetIcon.Label",
        hint: "MHL.Setting.ManagerSettings.ModuleResetIcon.Hint",
      }),
      groupResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-reply",
        label: "MHL.Setting.ManagerSettings.GroupResetIcon.Label",
        hint: "MHL.Setting.ManagerSettings.GroupResetIcon.Hint",
      }),
      settingResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-restore",
        label: "MHL.Setting.ManagerSettings.SettingResetIcon.Label",
        hint: "MHL.Setting.ManagerSettings.SettingResetIcon.Hint",
      }),
    };
  }
}
export const SETTINGS = {
  "manager-settings-menu": {
    type: MHLManagerSettingsMenu,
    name: null,
    hint: null,
    label: null,
    icon: "fa-icons",
    group: ".SettingsManager",
    for: "sm-settings",
  },
  "manager-settings": {
    type: SettingManagerDefaultsModel,
    config: false,
    group: ".SettingsManager",
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
