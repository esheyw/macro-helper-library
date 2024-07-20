import { MODULE_ID } from "../constants.mjs";
import { mhlError } from "../helpers/errorHelpers.mjs";
import { localize } from "../helpers/stringHelpers.mjs";
import { MHL } from "../init.mjs";
import { MHLSettingsManager } from "../util/MHLSettingsManager.mjs";

const funcPrefix = "MHLSettingsManagerReset";
export class MHLSettingsManagerReset extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: MHLSettingsManagerReset.#submit,
      closeOnSubmit: false,
      submitOnChange: false,
    },
    classes: ["mhl-reset-app"],
    actions: {
      unset: MHLSettingsManagerReset.#unset,
    },
    window: {
      controls: [
        {
          action: "unset",
          icon: "fa-solid fa-rotate-left",
          label: "Unset",
        },
      ],
    },
  };

  static PARTS = {
    form: {
      id: "form",
      template: `modules/${MODULE_ID}/templates/SettingsManagerReset2.hbs`,
    },
  };

  #settings;
  #manager;
  #module;
  constructor(settings, mod, options) {
    const func = `${funcPrefix}#constructor`;
    super(options);
    this.#module = mod instanceof foundry.packages.BaseModule ? mod : game.modules.get(mod);
    if (!this.#module) throw mhlError({ mod }, { func, text: "MHL.SettingsManagerReset.Error.ModuleRequired" });
    this.#manager = MHL().managers.get(this.#module.id);
    if (!this.#manager)
      throw mhlError("MHL.SettingsManagerReset.Error.ManagedModuleRequired", {
        func,
        context: { title: this.#module.title },
      });
    this.#settings = {
      noDefaults: settings.defaultless ?? [],
      hasDefaults: settings.hasDefaults ?? [],
    };
  }

  get title() {
    if (!this.options.window.title)
      this.options.window.title = localize(
        `MHL.SettingsManagerReset.Title.${this.options.resetType.capitalize()}`,
        {
          module: this.options.module.title,
          group: this.options.group ?? "",
          settingName: this.options.setting.name ?? this.options.setting.key ?? "",
        },
        { mod: this.options.modPrefix }
      );

    return this.options.window.title;
  }

  static #unset(event, target) {}
  static #submit(event, target) {}

  async _prepareContext() {
    const settings = this.#settings.hasDefaults.reduce((acc, s) => {
      const savedValue = this.#manager.get(s.key);
      const defaultValue = s?.realDefault ?? undefined;
      acc.push({
        savedValue,
        defaultValue,
        type: s.type,
      });
      return acc;
    }, []);

    const context = {
      module: this.#module,
      settings,
    };
    return context;
  }
}
