import { MODULE_ID } from "../../constants.mjs";
const PREFIX = `MHL.Setting.ManagerDefaults`;

export class SettingManagerDefaults extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      disabledClass: new fields.StringField({
        required: true,
        nullable: false,
        initial: "disabled-transparent",
        label: `${PREFIX}.DisabledClass.Label`,
        hint: `${PREFIX}.DisabledClass.Hint`,
        choices: () => CONFIG[MODULE_ID].disabledClasses,
        group: ".CSS",
      }),
      accordionIndicatorIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "fa-chevron-down",
        label: `${PREFIX}.AccordionIndicatorIcon.Label`,
        hint: `${PREFIX}.AccordionIndicatorIcon.Hint`,
      }),
      moduleResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-reply-all",

        label: `${PREFIX}.ModuleResetIcon.Label`,
        hint: `${PREFIX}.ModuleResetIcon.Hint`,
      }),
      groupResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-reply",
        label: `${PREFIX}.GroupResetIcon.Label`,
        hint: `${PREFIX}.GroupResetIcon.Hint`,
      }),
      settingResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: "mdi-restore",
        label: `${PREFIX}.SettingResetIcon.Label`,
        hint: `${PREFIX}.SettingResetIcon.Hint`,
      }),
    };
  }
}
