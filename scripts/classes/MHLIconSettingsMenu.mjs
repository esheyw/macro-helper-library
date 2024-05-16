import { fu } from "../constants.mjs";

export class MHLIconSettingsMenu extends FormApplication {
  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      title: "MHL Icon Glyph Settings",
      template: `modules/${MODULE_ID}/templates/IconSettingsMenu.hbs`,
      classes: ["mhl-setting-menu"],
      width: 400,
      resizable: true,
    });
  }

  getData(options = {}) {
    const context = super.getData(options);
    context.key = "icon-settings";
    context.module = moduleID;
    context.model = game.settings.get(MODULE_ID, data.for).clone();
    context.v12 = fu.isNewerVersion(game.version, 12);
    return context;
  }
  _updateObject(event, formData) {
    const expanded = fu.expandObject(formData);
    modLog(
      { event, formData, expanded },
      {
        type: "warn",
        mod: this.options.modPrefix,
        func: `_updateObject`,
      }
    );

    game.settings.set(MODULE_ID, data.for, expanded);
  }
}
