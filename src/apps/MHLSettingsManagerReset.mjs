import { fu, MODULE_ID } from "../constants.mjs";
import { log, mhlError } from "../helpers/errorHelpers.mjs";
import { localize } from "../helpers/stringHelpers.mjs";
import { MHL } from "../init.mjs";
import { Accordion } from "../util/Accordion.mjs";
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
    classes: ["mhl-reset-app", "standard-form"],
    actions: {
      unset: MHLSettingsManagerReset.#unset,
      apply: MHLSettingsManagerReset.#apply,
    },
    window: {
      controls: [
        {
          action: "unset",
          icon: "fa-solid fa-rotate-left",
          label: "Unset",
        },
      ],
      resizable: true,
    },
  };

  static PARTS = {
    form: {
      id: "form",
      template: `modules/${MODULE_ID}/templates/SettingsManagerResetGrid.hbs`,
    },
  };

  #manager;
  #module;
  #settings;
  constructor(options) {
    const func = "#constructor";
    super(options);

    this.#module = game.modules.get(options.module?.id ?? options.module);
    if (!(this.#module instanceof foundry.packages.BaseModule)) {
      throw mhlError({ options }, { func, text: "MHL.SettingsManagerReset.Error.ModuleRequired" });
    }

    this.#manager ??= MHL().managers.get(this.#module.id);
    if (!(this.#manager instanceof MHLSettingsManager)) {
      throw mhlError("MHL.SettingsManagerReset.Error.ManagedModuleRequired", {
        func,
        context: { title: this.#module.title },
      });
    }

    this.#settings = {
      noDefaults: options.settings.noDefaults ?? [],
      hasDefaults: options.settings.hasDefaults ?? [],
    };
  }

  get title() {
    if (!this.options.window.title)
      this.options.window.title = localize(`MHL.SettingsManagerReset.Title.${this.options.resetType.capitalize()}`, {
        module: this.#module.title,
        ...(this.options.resetType === "group" && { group: this.options.resetTarget }),
        ...(this.options.resetType === "setting" && { settingName: this.options.resetTarget }),
      });
    return this.options.window.title;
  }

  static #unset(event, target) {
    console.warn({ event, target });
  }
  static #submit(event, target, formData) {
    console.warn({ event, target, formData });
  }
  static #apply(event, target, ...args) {
    console.warn({ event, target, args });
  }

  async _prepareContext() {
    const settings = this.#settings.hasDefaults.reduce(
      (acc, s) => {
        const savedValue = this.#manager.get(s.key);
        const processedSetting = {
          key: s.key,
          name: s.name ?? "[Unnamed]",
          isDefault: !!s.isDefault,
          isColor: s.type instanceof foundry.data.fields.ColorField,
          isObject: typeof savedValue === "object",
          savedValue,
          defaultValue: s?.realDefault ?? undefined,
          type: s.type ?? String,
        };
        if (s.group === null) {
          acc.ungrouped.push(processedSetting);
        } else {
          if (!acc.groups[s.group]) {
            acc.count++;
            acc.groups[s.group] = { settings: [], allDefault: true };
          }
          if (!processedSetting.isDefault) acc.groups[s.group].allDefault = false;
          acc.groups[s.group].settings.push(processedSetting);
        }
        return acc;
      },
      { count: this.#settings.hasDefaults.length, ungrouped: [], groups: {} }
    );

    let noDefaultsTooltip = `<ul>`;
    for (const setting of this.#settings.noDefaults) {
      const name = setting.name ? localize(setting.name) : "[Unnamed]";
      noDefaultsTooltip += `<li>${name} <code>(${setting.key})</code></li>\n`;
    }
    noDefaultsTooltip += "</ul>";

    const context = {
      module: this.#module,
      noDefaultsCount: this.options.settings.noDefaults.length,
      noDefaultsTooltip,
      settings,
      resetType: this.options.resetType,
      resetTarget: this.options.resetTarget,
    };
    return context;
  }

  _onFirstRender(context, options) {
    const func = "#_onFirstRender";
    this.#debug({ context, options }, { func });
  }
  async _onRender(context, options) {
    const func = "#_onRender";
    new Accordion({
      headingSelector: "div.group-header",
      contentSelector: "div.group-setting-rows",
      wrapperSelector: "div.setting-group-wrapper",
      mod: this.options.modPrefix,
      initialOpen: Infinity
    }).bind(this.element);
    this.#debug({ context, options }, { func });
  }

  #error(loggable, options = {}) {
    options.error = true;
    options.type = "error";
    options.banner &&= "error";
    return this.#log(loggable, options);
  }

  #log(loggable, options = {}) {
    const opts = fu.mergeObject(
      options,
      {
        prefix: this.options.modPrefix,
        context: {
          module: this.#module.title,
        },
      },
      { inplace: false }
    );
    if (options.func) opts.func = `${this.constructor.name}${options.func}`;
    log(loggable, opts);
  }

  #debug(loggable, options) {
    options.type = "warn";
    options.clone = true;
    return this.#log(loggable, options);
  }

  #logCastString(variable, name, func) {
    if (func) func = `${this.constructor.name}${func}`;
    return logCastString(variable, name, { func, mod: this.options.modPrefix });
  }
}
