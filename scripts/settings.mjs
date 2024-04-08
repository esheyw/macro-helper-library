import { MHLSettingMenu } from "./classes/MHLSettingMenu.mjs";
import { isValidFA } from "./helpers/stringHelpers.mjs";
import { MODULE } from "./init.mjs";

class IconSettingsModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const PREFIX = "MHL.Setting.IconSettings";
    const fields = foundry.data.fields;
    return {
      // disabledClass: new fields.StringField({
      //   required: true,
      //   nullable: false,
      //   initial: "disabled-transparent",
      //   label: `${PREFIX}.DisabledClass.Label`,
      //   hint: `${PREFIX}.DisabledClass.Hint`,
      //   choices: ["disabled-transparent", "disabled-hidden", "disabled-blurry"],
      //   group: ".CSS",
      // }),
      moduleGlyph: new fields.StringField({
        required: true,
        nullable: false,
        initial: "fa-reply-all",
        label: "Module Glyph",
        hint: "Module Glyph Hint",
        validate: (v) => isValidFA(v),
        validationError: "is not a valid FontAwesome glyph.",
      }),
      groupGlyph: new fields.StringField({
        required: true,
        nullable: false,
        initial: "fa-reply",
        label: "Group Glyph",
        hint: "Group Glyph Hint",
      }),
      settingGlyph: new fields.StringField({
        required: true,
        nullable: false,
        initial: "fa-arrow-rotate-left",
        label: "Setting Glyph",
        hint: "Setting Glyph Hint",
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
    type: MHLSettingMenu,
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
      moduleGlyph: "fa-reply-all",
      groupGlyph: "fa-reply",
      settingGlyph: "fa-arrow-rotate-left",
    },
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
    scope: "world",
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
  if (SM?.initialized && game?.user) {
    return SM.get(key);
  }
  return undefined;
}
