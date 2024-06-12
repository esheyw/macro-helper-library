import { MODULE } from "../../init.mjs";
const PREFIX = `MHL.Setting.ManagerDefaults`;
const AIF = () => game.modules.get("additional-icon-fonts")?.active;
export class SettingManagerDefaults extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      disabledClass: new fields.StringField({
        required: true,
        nullable: false,
        initial: "disabled-transparent",
        label: `${PREFIX}.DisabledClass.Label`,
        hint: `${PREFIX}.DisabledClass.Hint`,
        choices: () => CONFIG.MHL.disabledClasses,
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
        initial: () => (AIF() ? "mdi-reply-all" : "fa-reply-all"),

        label: `${PREFIX}.ModuleResetIcon.Label`,
        hint: `${PREFIX}.ModuleResetIcon.Hint`,
      }),
      groupResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: () => (AIF() ? "mdi-reply" : "fa-reply"),
        label: `${PREFIX}.GroupResetIcon.Label`,
        hint: `${PREFIX}.GroupResetIcon.Hint`,
      }),
      settingResetIcon: new fields.StringField({
        required: true,
        nullable: false,
        initial: () => (AIF() ? "mdi-restore" : "fa-arrow-rotate-left"),
        label: `${PREFIX}.SettingResetIcon.Label`,
        hint: `${PREFIX}.SettingResetIcon.Hint`,
      }),
    };
  }
}
