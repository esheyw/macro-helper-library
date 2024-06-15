import { MODULE_ID, fu } from "../constants.mjs";
import { elementFromString, htmlClosest, htmlQuery, htmlQueryAll } from "../helpers/HTMLHelpers.mjs";
import { MHLError, isEmpty, logCastString, modBanner, modError, modLog } from "../helpers/errorHelpers.mjs";
import { isRealGM } from "../helpers/foundryHelpers.mjs";
import { mhlocalize, sluggify } from "../helpers/stringHelpers.mjs";
import { getIconClasses, getIconHTMLString } from "../helpers/iconHelpers.mjs";
import { MHLDialog } from "../apps/MHLDialog.mjs";
import { setting } from "../settings/settings.mjs";
import { MHLSettingMenu } from "../apps/MHLSettingMenu.mjs";
import { Accordion } from "./Accordion.mjs";
import { isPlainObject } from "../helpers/otherHelpers.mjs";
const funcPrefix = `MHLSettingsManager`;
export class MHLSettingsManager {
  #colorPattern = "^#[A-Fa-f0-9]{6}";
  #enrichers = new Map([
    [/`([^`]+)`/g, `<code>$1</code>`],
    [/\[([^\]]+)\]\(([^\)]+)\)/g, `<a href="$2">$1</a>`],
  ]);
  #groupOrder = new Set();
  #initialized = false;
  #module;
  #potentialSettings = new Collection();
  #resetListeners = new Collection([
    ["all", null],
    ["groups", new Collection()],
    ["settings", new Collection()],
  ]);
  #settings = new Collection();
  #visibilityListeners = new Map();

  static #readyHookID;
  static #managers = new Collection();
  static get managers() {
    return MHLSettingsManager.#managers;
  }

  constructor(moduleFor, options = {}) {
    const func = `${funcPrefix}#constructor`;
    this.#module = moduleFor instanceof Module ? moduleFor : game.modules.get(moduleFor);
    if (!this.#module) throw MHLError(`MHL.SettingsManager.Error.BadModuleID`, { log: { moduleFor }, func });

    this.options = fu.mergeObject(this.defaultOptions, options);

    if (MHLSettingsManager.#managers.has(this.#module.id)) {
      throw modError(`MHL.SettingsManager.Error.ManagerAlreadyExists`, { context: { module: this.#module.title } });
    } else {
      MHLSettingsManager.#managers.set(this.#module.id, this);
      MHLSettingsManager.#managers[this.options.modPrefix.toLowerCase()] ??= this;
    }

    //validate groups
    if (!this.#validateGroupsOption()) this.options.groups = false;
    //validate sort
    if (!this.#validateSortOption()) this.options.sort = false;
    //validate & normalize resetButtons
    if (!this.#validateResetButtonsOption()) this.options.resetButtons = false;
    //validate & set enrichers if provided
    if (!this.#validateEnrichHintsOption()) this.options.enrichHints = true;

    if (!this.#validateCollapsibleGroupsOption()) this.options.collapsibleGroups = true;
    if (options.settings) this.registerSettings(options.settings);
    //defer button icon checks to ready to account for lazily loaded icon fonts
    if (!MHLSettingsManager.#readyHookID) {
      MHLSettingsManager.#readyHookID = Hooks.once("ready", MHLSettingsManager.validateButtonIcons);
    }
    Hooks.on("renderSettingsConfig", this.#onRenderSettings2.bind(this));
    this.#initialized = true;
  }

  get initialized() {
    return this.#initialized;
  }

  get app() {
    return Object.values(ui.windows).find((w) => w.id === "client-settings");
  }

  get element() {
    if (!this.app) return;
    return this.app.element instanceof jQuery ? this.app.element[0] : this.app.element;
  }

  get defaultOptions() {
    const prefix = sluggify(this.#module.title, { camel: "bactrian" });
    return {
      // process settings with button data into clickable buttons instead of their regular type
      actionButtons: true,
      // localization key section placed between setting name and choice value when inferring choice localization
      choiceInfix: "Choice",
      // whether groups should be just a header between sections (false) or allow collapsing groups on header click by modifying the html more deeply (true)
      // optionally specifies accordion indicator icon override
      collapsibleGroups: true,
      // add color picker elements to settings whose default value is a hex color code
      colorPickers: true,
      // css class toggled on reset buttons when the setting in question is already its default value, if null uses module setting
      disabledClass: null,
      // true/false enables/disables built-in enrichers, or pass your own as an entries array (adds to built-ins)
      enrichHints: true,
      // localization key suffix appended to the settingPrefix for group names
      groupInfix: "Group",
      // handle setting grouping. if true, uses insertion order, use an array to specify an order, or "a" for alphabetical
      groups: true,
      // prefix for logged errors/warnings
      modPrefix: prefix.replace(/[a-z]/g, ""),
      // add reset-to-default buttons on each setting and for the whole module in its header
      resetButtons: true,
      //String to start inferred localization keys with
      settingPrefix: prefix + ".Setting",
      // handle sorting of settings. true for alphabetical on name, or a custom compare function.
      sort: false,
      // process settings with visibility data, only showing them in the settings window conditionally on the value of another setting
      visibility: true,
    };
  }

  get moduleResetIcon() {
    const opt = this.options.resetButtons?.module;
    return typeof opt === "string" ? opt : setting("manager-defaults").moduleResetIcon;
  }
  get groupResetIcon() {
    const opt = this.options.resetButtons?.groups;
    return typeof opt === "string" ? opt : setting("manager-defaults").groupResetIcon;
  }
  get settingResetIcon() {
    const opt = this.options.resetButtons?.settings;
    return typeof opt === "string" ? opt : setting("manager-defaults").settingResetIcon;
  }
  get disabledClass() {
    return this.options.disabledClass ?? setting("manager-defaults")?.disabledClass;
  }
  get accordionIndicator() {
    return typeof this.options.collapsibleGroups === "string"
      ? this.options.collapsibleGroups
      : setting("manager-defaults")?.accordionIndicatorIcon;
  }

  #onRenderSettings2(app, html, data) {
    const func = `${funcPrefix}##onRenderSettings2`;
    html = html instanceof jQuery ? html[0] : html;
    //bail if this module has no configurable settings (either available to this user, or at all)
    const configurable = this.#settings.filter((setting) => setting?.config);
    if (configurable.length === 0) return;
    const clientSettings = configurable.filter((setting) => setting?.scope !== "world");
    if (!clientSettings.length && !isRealGM(game.user)) return;

    const section = htmlQuery(html, `section[data-category="${this.#module.id}"]`);
    section.classList.add("mhl-settings-manager");

    this.#applyGroupsAndSort(section);

    if (this.options.colorPickers) {
      this.#addColorPickers(section);
    }
    if (this.options.enrichHints) {
      this.#enrichHints(section);
    }
    const divs = htmlQueryAll(section, "div.form-group");

    //initial visibility checks & reset button updates
    const firstInputs = divs.reduce((acc, div) => {
      const input = htmlQuery(div, "input, select, multi-select, color-picker");
      if (input) acc.push(input);
      return acc;
    }, []);
    for (const el of firstInputs) {
      const parent = el.parentElement.parentElement;
      // this.#log({ data: parent.dataset, el }, { func });
      el.addEventListener("change", this.#onChangeInput.bind(this));
      // el.dispatchEvent(new Event("change"));
    }
  }

  #onChangeInput(event) {
    const { srcElement, target, currentTarget } = event;
    this.#log({ srcElement, target, currentTarget });
  }

  #onRenderSettings(app, html, data) {
    const func = `${funcPrefix}##onRenderSettings`;
    html = html instanceof jQuery ? html[0] : html;
    //bail if this module has no configurable settings (either available to this user, or at all)
    const configurable = this.#settings.filter((setting) => setting?.config);
    if (configurable.length === 0) return;
    const clientSettings = configurable.filter((setting) => setting?.scope !== "world");
    if (!clientSettings.length && !isRealGM(game.user)) return;

    const section = htmlQuery(html, `section[data-category="${this.#module.id}"]`);
    section.classList.add("mhl-settings-manager");

    this.#applyGroupsAndSort(section);

    if (this.options.colorPickers) {
      this.#addColorPickers(section);
    }
    if (this.options.enrichHints) {
      this.#enrichHints(section);
    }
    if (this.options.resetButtons) {
      this.#addResetButtons(section);
    }
    const settingDivs = htmlQueryAll(section, `[data-setting-id]`);

    for (const div of settingDivs) {
      const key = this.#getKeyFromDiv(div);
      const settingData = this.#settings.get(key);
      if (this.options.actionButtons && "button" in settingData) {
        this.#replaceWithButton(div, settingData.button);
      }

      if (this.options.visibility && "visibility" in settingData) {
        this.#addVisibilityListeners(div, settingData.visibility);
      }
    }

    //initial visibility checks & reset button updates
    const firstInputs = settingDivs.reduce((acc, div) => {
      const input = htmlQuery(div, "input, select");
      if (input) acc.push(input);
      return acc;
    }, []);
    for (const el of firstInputs) {
      el.dispatchEvent(new Event("change"));
    }
  }

  #sortSettings(settings) {
    const func = `${funcPrefix}##sortSettings`;
    if (isEmpty(this.options.sort)) return settings;
    return settings.sort((a, b) => {
      if (this.options.sort.menusFirst) {
        if (a.menu) {
          return b.menu ? this.options.sort.fn(a.name, b.name) : -1;
        }
        return b.menu ? 1 : this.options.sort.fn(a.name, b.name);
      } else {
        return this.options.sort.fn(a.name, b.name);
      }
    });
  }

  #applyGroupsAndSort(section) {
    const func = `${funcPrefix}##applyGroupsAndSort`;
    const isGM = isRealGM(game.user);
    const existingNodes = Array.from(section.children);
    this.#log({ existingNodes }, { func, dupe: true });
    const sortOrder = [existingNodes.shift()]; // add the module title h2 in first
    if (this.options.groups) {
      if (this.options.groups === "a") {
        this.#groupOrder = new Set([
          ...[...this.#groupOrder].toSorted((a, b) => mhlocalize(a).localeCompare(mhlocalize(b))),
        ]);
      }
      const groupOrder = [null, ...this.#groupOrder];
      for (const group of groupOrder) {
        let groupContentDiv;
        // limit to only configurable settings & menus in this group
        const settings = this.#settings
          .filter((s) => s.group === group && (s?.config || s?.menu) && (s?.scope === "world" ? isGM : true))
          .map((s) => ({
            node: existingNodes.find(
              (n) => n.dataset?.settingId?.includes(s.key) || htmlQuery(n, `button[data-key$="${s.key}"]`)
            ),
            ...s,
            name: mhlocalize(s.name),
          }));
        if (group !== null) {
          if (settings.length === 0) continue; // no headers for empty groups
          const groupHeader = document.createElement("h3");
          groupHeader.innerText = mhlocalize(group);
          groupHeader.dataset.settingGroup = group;
          sortOrder.push(groupHeader);
          if (this.options.collapsibleGroups) {
            groupHeader.appendChild(
              elementFromString(getIconHTMLString(this.accordionIndicator, "accordion-indicator"))
            );
            groupContentDiv = elementFromString(`<div class="mhl-setting-group"></div>`);
            sortOrder.push(groupContentDiv);
          } else {
          }
        }

        this.#sortSettings(settings);

        for (const setting of settings) {
          if (group !== null) setting.node.dataset.settingGroup = group;
          if (groupContentDiv) {
            groupContentDiv.appendChild(setting.node);
          } else {
            sortOrder.push(setting.node);
          }
        }
      }
    } else if (this.options.sort !== false) {
      const settings = this.#settings
        .filter((s) => (s?.config || s?.menu) && (s?.scope === "world" ? isGM : true))
        .map((s) => ({
          node: existingNodes.find(
            (n) => n.dataset?.settingId?.includes(s.key) || htmlQuery(n, `button[data-key$="${s.key}"]`)
          ),
          ...s,
          name: mhlocalize(s.name),
        }));
      this.#sortSettings(settings);
      for (const setting of settings) {
        sortOrder.push(setting.node);
      }
    } else {
      //no sorting to be done
      return;
    }
    //do the reorg
    this.#log({ sortOrder }, { func, dupe: true });
    for (const node of sortOrder) {
      section.appendChild(node);
    }
    if (this.options.collapsibleGroups)
      new Accordion({
        headingSelector: `h3[data-setting-group]`,
        contentSelector: `.mhl-setting-group`,
      }).bind(section);
  }

  get(key) {
    const func = `${funcPrefix}#get`;
    if (!this.#requireSetting(key, { func })) return undefined;
    // either we're past Setup, or it's a client setting that can be retrieved early
    if (game?.user || this.#settings.get(key)?.scope !== "world") return game.settings.get(this.#module.id, key);
    return undefined;
  }

  async set(key, value) {
    const func = `${funcPrefix}#set`;
    if (!this.#requireSetting(key, { func })) return undefined;
    return game.settings.set(this.#module.id, key, value);
  }

  async reset(keys) {
    const func = `${funcPrefix}#reset`;
    if (!Array.isArray(keys)) keys = [keys];
    const sets = [];
    for (const key of keys) {
      if (!this.#requireSetting(key, { func })) continue;
      const data = this.#settings.get(key);
      if (!("default" in data)) continue;
      sets.push(this.set(key, data.default));
      if (this.element) {
        if (data.config) {
          const div = htmlQuery(this.element, `div[data-setting-id="${this.#module.id}.${key}"]`);
          if (!div) return;
          this.#setInputValues(div, data.default);
        }
        this.#updateResetButtons(key);
      }
    }
    try {
      return await Promise.all(sets);
    } finally {
      this.app.render();
    }
  }

  async resetAll() {
    return this.reset(Array.from(this.#settings.keys()));
  }

  registerSettings(data) {
    const func = `${funcPrefix}#registerSettings`;
    const settings = this.#validateRegistrationData(data);
    if (!settings) return false; //validator already raised console error

    //have all potential keys available to predicate visibility upon
    this.#potentialSettings = settings;

    for (const [setting, data] of settings.entries()) {
      const success = this.registerSetting(setting, data, { initial: true });
      if (!success) {
        this.#log(
          { setting, data, module: this.#module.id },
          {
            prefix: `MHL.SettingsManager.Error.InvalidSettingData`,
            func,
            context: { setting },
          }
        );
      }
    }

    if (game?.user) {
      // 'are settings available' hack
      this.#updateHooks();
    } else {
      Hooks.once("setup", this.#updateHooks.bind(this));
    }
  }

  registerSetting(key, data, { initial = false } = {}) {
    const func = `${funcPrefix}#registerSetting`;
    if (!this.#potentialSettings.has(key)) this.#potentialSettings.set(key, data);
    if (game.settings.settings.get(`${this.#module.id}.${key}`)) {
      this.#log(`MHL.SettingsManager.Error.DuplicateSetting`, {
        type: "error",
        context: { key },
        func,
      });
      return false;
    }

    data = this.#processSettingData(key, data);
    if (!data) return false;

    //actually register the setting finally
    this.#register(key, data);
    // only update hooks if we're not inside a registerSettings call
    if (!initial) this.#updateHooks(key);
    this.#potentialSettings.delete(key);
    return true;
  }

  #processSettingData(key, data) {
    const func = `${funcPrefix}##processSettingData`;
    //add the key to the data because Collection's helpers only operate on vaalues
    data.key = key;
    //handle registering settings menus
    if (data.menu || data.type?.prototype instanceof FormApplication) {
      //TODO: implement generation in v12, add app v2 to check
      // if (!data?.type || !(data.type?.prototype instanceof FormApplication)) return false;
      data.menu = true;
    }

    //ensure configurable settings have a visible name, even if it's a broken localization key
    if (data.config && !("name" in data)) data.name = null;

    // if name, hint, or a choice or menu label is passed as null, infer the desired translation key
    data = this.#processNullLabels(key, data);

    //validate button settings
    if ("button" in data) {
      data.button = this.#processButtonData(key, data.button);
      // since buttons replace whole settings, if validation fails, don't create a useless text input
      if (!data.button) return false;
    }

    //only allow colour pickers for settings with a valid colour hex code as default value
    if ("colorPicker" in data) {
      const regex = new RegExp(this.#colorPattern);
      if (!regex.test(data?.default ?? "")) {
        this.#log({ key, data }, { prefix: `MHL.SettingsManager.Error.InvalidColorPicker`, func });
        data.colorPicker = false;
      }
    }
    //handle setting visibility dependencies
    if ("visibility" in data) {
      data.visibility = this.#processVisibilityData(key, data.visibility);
      // if validation failed, don't make broken listeners
      if (!data.visibility) delete data.visibility;
    }

    //update hooks every time a setting is changed
    const originalOnChange = "onChange" in data ? data.onChange : null;
    data.onChange = function (value) {
      this.#updateHooks(key);
      this.#setInputValues(key, value);
      this.#updateResetButtons(key);
      if (originalOnChange) originalOnChange(value);
    }.bind(this);

    //handle setting-conditional hooks, has to happen after registration or the error handling in setHooks gets gross
    if ("hooks" in data) {
      data.hooks = this.#processHooksData(key, data.hooks);
      if (!data.hooks) delete data.hooks;
    }
    //handle groups, make sure data.group always exists
    if ("group" in data) {
      if (typeof data.group === "string") {
        if (data.group.startsWith("."))
          data.group = `${this.options.settingPrefix}${this.options.groupInfix}${data.group}`;
        this.#groupOrder.add(data.group);
      } else {
        this.#log(
          { group: data.group, key },
          {
            type: "error",
            func,
            prefix: `MHL.SettingsManager.Error.InvalidGroup`,
          }
        );
        data.group = null;
      }
    }
    data.group ??= null;

    return data;
  }

  #register(key, data) {
    if (data.menu) {
      game.settings.registerMenu(this.#module.id, key, data);
    } else {
      game.settings.register(this.#module.id, key, data);
    }
    this.#settings.set(key, data);
  }

  #processNullLabels(key, data) {
    if ("name" in data && data.name === null) {
      data.name = [this.options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Name"].join(".");
    }
    if ("hint" in data && data.hint === null) {
      data.hint = [this.options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Hint"].join(".");
    }
    if ("choices" in data && isPlainObject(data.choices)) {
      for (const [choiceValue, choiceLabel] of Object.entries(data.choices)) {
        if (choiceLabel === null) {
          data.choices[choiceValue] = [
            this.options.settingPrefix,
            sluggify(key, { camel: "bactrian" }),
            this.options.choiceInfix,
            sluggify(choiceValue, { camel: "bactrian" }),
          ].join(".");
        }
      }
    }
    if ("label" in data && data.label === null) {
      data.label = [this.options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Label"].join(".");
    }
    return data;
  }

  #generateSettingMenu(data) {
    //todo: do this in v12
    if (!fu.isNewerVersion(game.version, 12)) return;
    const func = `${funcPrefix}##generateSettingMenu`;

    if (!("for" in data) || !this.#requireSetting(data.for, { func, potential: true })) {
      return false;
    }

    const forData = this.#settings.get(data.for) || this.#potentialSettings.get(data.for);
    if (!(forData.type?.prototype instanceof foundry.abstract.DataModel)) return false;

    const moduleID = this.#module.id;
    return class MHLGeneratedSettingMenu extends MHLSettingMenu {
      static get defaultOptions() {
        const options = super.defaultOptions;
        options.classes.push("mhl-setting-menu");
        options.width = 400;
        options.resizable = true;
        return options;
      }

      getData(options = {}) {
        const context = super.getData(options);
        context.key = data.for;
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
    };
  }

  //mostly type and format checking, also icon processing
  #processButtonData(key, buttonData) {
    const func = `${funcPrefix}##processButtonData`;
    if (typeof buttonData !== "object" || !("action" in buttonData) || typeof buttonData.action !== "function") {
      this.#log({ buttonData }, { prefix: `MHL.SettingsManager.Error.Button.BadFormat`, func, context: { key } });
      return false;
    }

    if (!("label" in buttonData) || buttonData.label === null) {
      buttonData.label = [this.options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Label"].join(".");
    }
    buttonData.label = String(buttonData.label);
    // defer icon validation to runtime, glyph fallback is responsibiliity of the renderer
    return buttonData;
  }

  #processVisibilityString(key, dependsOn) {
    const func = `${funcPrefix}##processVisibilityString`;
    const invert = dependsOn.at(0) === "!";
    dependsOn = invert ? dependsOn.slice(1) : dependsOn;
    if (!this.#settings.has(dependsOn) && !this.#potentialSettings.has(dependsOn)) {
      this.#log(`MHL.SettingsManager.Error.Visibility.UnknownDependency`, {
        type: "error",
        func,
        context: { key, dependsOn },
      });
      return false;
    }
    return { [dependsOn]: !invert };
  }

  #processVisibilityData(key, visibilityData) {
    const func = `${funcPrefix}##processVisibilityData`;
    const data = { key, visibilityData };
    let test;
    const dependsOn = {};
    if (typeof visibilityData === "string") {
      const processed = this.#processVisibilityString(key, visibilityData);
      if (!processed) return false;
      fu.mergeObject(dependsOn, processed);
    } else if (Array.isArray(visibilityData)) {
      for (const dependency of visibilityData) {
        const processed = this.#processVisibilityString(key, dependency);
        if (!processed) continue;
        fu.mergeObject(dependsOn, processed);
      }
      if (isEmpty(dependsOn)) return false;
    } else if (typeof visibilityData === "object") {
      const dependsOnError = () =>
        this.#log(data, {
          type: "error",
          func,
          context: data,
          prefix: `MHL.SettingsManager.Error.Visibility.RequireDependsOn`,
        });

      if (!("test" in visibilityData) || typeof visibilityData.test !== "function") {
        this.#log(data, {
          type: "error",
          func,
          context: data,
          prefix: `MHL.SettingsManager.Error.Visibility.RequireTest`,
        });
        return false;
      }
      test = visibilityData.test;
      if (!("dependsOn" in visibilityData)) {
        dependsOnError();
        return false;
      }
      if (!Array.isArray(visibilityData.dependsOn)) visibilityData.dependsOn = [visibilityData.dependsOn];
      if (!visibilityData.dependsOn.every((e) => typeof e === "string")) {
        dependsOnError();
        return false;
      }
      for (const dependency of visibilityData.dependsOn) {
        const processed = this.#processVisibilityString(key, dependency);
        if (!processed) continue;
        fu.mergeObject(dependsOn, processed);
      }
      if (isEmpty(dependsOn)) return false;
    }
    return { dependsOn, test };
  }

  #processHooksData(key, hooksData) {
    const func = `${funcPrefix}##processHooksData`;
    const goodHooks = [];
    if (!Array.isArray(hooksData)) hooksData = [hooksData];
    for (const hookData of hooksData) {
      let invalid = false;
      let errorstr = "";
      if (typeof hookData !== "object" || ("hook" in hookData && typeof hookData.hook !== "string")) {
        errorstr = `MHL.SettingsManager.Error.Hooks.BadHook`;
        invalid = true;
      }
      if (!invalid && "action" in hookData && typeof hookData.action !== "function") {
        errorstr = `MHL.SettingsManager.Error.Hooks.RequiresAction`;
        invalid = true;
      }
      if (!invalid && "test" in hookData && typeof hookData.test !== "function") {
        errorstr = `MHL.SettingsManager.Error.Hooks.TestFunction`;
        invalid = true;
      }
      if (invalid) {
        this.#log(
          { key, hookData },
          {
            type: "error",
            prefix: errorstr,
            context: { key, hook: hookData?.hook },
            func,
          }
        );
        continue;
      }
      //default test if none provided
      hookData.test ??= (value) => !!value;
      goodHooks.push(hookData);
    }
    return goodHooks.length ? goodHooks : false;
  }

  setHooks(key, hooks) {
    const func = `${funcPrefix}#setHooks`;
    if (!this.#requireSetting(key, { func })) return undefined;
    const hooksData = this.#processHooksData(hooks);
    if (!hooksData) return false;
    const data = this.#settings.get(key);
    data.hooks ??= [];
    data.hooks.push(...hooksData);
    this.#settings.set(key, data);
    this.#updateHooks();
    return hooksData.length;
  }

  setButton(key, buttonData) {
    const func = `${funcPrefix}#setButton`;
    if (!this.#requireSetting(key, { func })) return undefined;
    const fullKey = `${this.#module.id}.${key}`;
    const savedData = game.settings.settings.get(fullKey);
    const processed = this.#processButtonData(key, buttonData);
    if (processed) {
      savedData.button = processed;
      this.#settings.set(key, savedData);
      game.settings.settings.set(fullKey, savedData);
      return true;
    }
    return false;
  }

  setVisibility(key, visibilityData) {
    const func = `${funcPrefix}#setButton`;
    if (!this.#requireSetting(key, { func })) return undefined;
    const fullKey = `${this.#module.id}.${key}`;
    const savedData = game.settings.settings.get(fullKey);
    const processed = this.#processVisibilityData(key, visibilityData);
    if (processed) {
      savedData.visibility = processed;
      this.#settings.set(key, savedData);
      return true;
    }
    return false;
  }

  #updateHooks(key = null) {
    for (const [setting, data] of this.#settings.entries()) {
      if ((key && key !== setting) || !("hooks" in data)) continue;
      const value = this.get(setting);
      for (let i = 0; i < data.hooks.length; i++) {
        const active = data.hooks[i].test(value);
        const existingHookID = data.hooks[i].id ?? null;
        if (active) {
          if (existingHookID) continue;
          data.hooks[i].id = Hooks.on(data.hooks[i].hook, data.hooks[i].action);
        } else if (existingHookID) {
          Hooks.off(data.hooks[i].hook, existingHookID);
          delete data.hooks[i].id;
        }
      }
      this.#settings.set(setting, data);
    }
  }

  #enrichHints(section) {
    const func = `${funcPrefix}##enrichHints`;
    const hints = htmlQueryAll(section, "div[data-setting-id] p.notes");
    for (const hint of hints) {
      let text = hint.innerHTML;
      if (!text) continue;
      for (const [pattern, replacement] of this.#enrichers.entries()) {
        text = text.replace(pattern, replacement);
      }
      hint.innerHTML = text;
    }
  }

  #addColorPickers(section) {
    const func = `${funcPrefix}##addColorPickers`;
    const colorSettings = this.#settings.filter((s) => s?.colorPicker).map((s) => s.key);
    const divs = htmlQueryAll(section, "div[data-setting-id]").filter((div) =>
      colorSettings.includes(this.#getKeyFromDiv(div))
    );
    if (!divs.length) return;
    //stored in private prop so it can be easily changed if type="color" inputs take the stick out their ass
    const regex = new RegExp(this.#colorPattern);
    for (const div of divs) {
      const key = this.#getKeyFromDiv(div);
      const textInput = htmlQuery(div, 'input[type="text"]');
      if (!textInput) continue;
      const colorPicker = document.createElement("input");
      colorPicker.type = "color";
      colorPicker.dataset.edit = div.dataset.settingId;
      colorPicker.value = this.get(key);
      colorPicker.addEventListener(
        "input",
        function (event) {
          //force a reset anchor refresh; foundry's code for updating the text field runs too slowly?
          textInput.value = event.target.value;
          textInput.dispatchEvent(new Event("change"));
          //todo: delete following if new pattern works (change handler should cover it)
          // if (this.options.resetButtons) this.#updateResetButtons(event);
        }.bind(this)
      );
      textInput.parentElement.append(colorPicker);
      textInput.pattern = this.#colorPattern;
      textInput.addEventListener("input", (event) => {
        //would love to support more than a string 6-character hex code, but input[type=color] yells about condensed and/or rgba on chrome
        if (event.target.value.length > 7) {
          event.target.value = event.target.value.substring(0, 7);
        }
        if (!regex.test(event.target.value)) {
          textInput.dataset.tooltipDirection = "UP";
          textInput.dataset.tooltip = mhlocalize(`MHL.SettingsManager.ColorPicker.ValidHexCode`);
        } else {
          textInput.dataset.tooltip = "";
          colorPicker.value = event.target.value;
        }
      });
    }
  }

  #replaceWithButton(div, data) {
    const fieldDiv = htmlQuery(div, ".form-fields");
    div.classList.add("submenu");
    const button = document.createElement("button");
    button.innerHTML = `${getIconHTMLString(data.icon)} <label>${mhlocalize(data.label)}</label>`;
    button.type = "button";
    button.classList.add("mhl-setting-button");
    button.addEventListener("click", data.action);
    fieldDiv.replaceWith(button);
  }

  #updateVisibility(key, event) {
    const func = `${funcPrefix}##updateVisibility`;
    const section = htmlClosest(event.target, "section.mhl-settings-manager");
    const div = htmlQuery(section, `div[data-setting-id$="${key}"]`);
    const visible = div.style.display !== "none";
    const formValues = this.#getFormValues(section);
    const savedValue = this.get(key);
    const visibilityData = this.#settings.get(key).visibility;
    let show = true;
    if (!visibilityData.test) {
      for (const [dependency, test] of Object.entries(visibilityData.dependsOn)) {
        const match = !!formValues[dependency] == test;
        if (match) continue;
        show = false;
      }
    } else {
      const dependencies = Object.keys(visibilityData.dependsOn);
      let relevantFormValues, relevantSavedValues;
      if (dependencies.length === 1) {
        relevantFormValues = formValues[dependencies[0]];
        relevantSavedValues = this.get(dependencies[0]);
      } else {
        relevantFormValues = Object.entries(formValues).reduce((acc, [setting, value]) => {
          if (!dependencies.includes(setting)) return acc;
          acc[setting] = value;
          return acc;
        }, {});
        relevantSavedValues = dependencies.reduce((acc, setting) => {
          acc[setting] = this.get(setting);
          return acc;
        }, {});
      }
      show = visibilityData.test(relevantFormValues, relevantSavedValues, visible) ?? true;
    }

    if (show) {
      // div.classList.remove("visibility-off");
    } else {
      this.#setInputValues(div, savedValue);
      // div.classList.add("visibility-off");
    }
    div.style.display = show ? "flex" : "none";
  }

  #addVisibilityListeners(div, data) {
    const func = `${funcPrefix}##addVisibilityListeners`;
    const section = htmlClosest(div, "section.mhl-settings-manager");
    const key = this.#getKeyFromDiv(div);
    const dependencies = Object.keys(data.dependsOn);
    const existingListeners = this.#visibilityListeners.get(key) ?? {};
    for (const dependency of dependencies) {
      const controlElement = htmlQuery(section, `div[data-setting-id$="${dependency}"] :is(input,select)`);
      const listener =
        existingListeners[dependency] ??
        function (event) {
          this.#updateVisibility(key, event);
        }.bind(this);
      controlElement.addEventListener("change", listener);
      existingListeners[dependency] = listener;
    }
    this.#visibilityListeners.set(key, existingListeners);
  }

  #addResetButtons(section) {
    const func = `${funcPrefix}##addResetButtons`;
    const opt = this.options.resetButtons;
    const isGM = isRealGM(game.user);
    const managerDefaults = setting("manager-defaults");
    if (opt.includes("module")) {
      const h2 = htmlQuery(section, "h2");
      const span = document.createElement("span");
      span.classList.add("mhl-reset-button");
      span.innerHTML = `<a data-reset-type="module" data-reset="${this.#module.id}">${getIconHTMLString(
        managerDefaults.moduleResetIcon
      )}</a>`;
      const anchor = htmlQuery(span, "a");
      anchor.dataset.tooltipDirection = "UP";
      const listener = this.#onResetClick.bind(this);
      this.#resetListeners.set("all", listener);
      anchor.addEventListener("click", listener);
      anchor.addEventListener("contextmenu", listener);
      h2.appendChild(span);
    }

    if (opt.includes("groups")) {
      const h3s = htmlQueryAll(section, "h3[data-setting-group]");
      for (const h3 of h3s) {
        const group = h3.dataset.settingGroup;
        const resettables = this.#settings.filter(
          (s) => s.group === group && "default" in s && !("button" in s) && (s?.scope === "world" ? isGM : true)
        );
        if (resettables.length === 0) continue;
        const span = document.createElement("span");
        span.classList.add("mhl-reset-button");
        span.innerHTML = `<a data-reset-type="group" data-reset="${group}">${getIconHTMLString(
          managerDefaults.groupResetIcon
        )}</a>`;
        const anchor = htmlQuery(span, "a");
        anchor.dataset.tooltipDirection = "UP";
        const listener = this.#onResetClick.bind(this);
        this.#resetListeners.get("groups").set(group, listener);
        anchor.addEventListener("click", listener);
        anchor.addEventListener("contextmenu", listener);
        h3.appendChild(span);
      }
    }

    const divs = htmlQueryAll(section, "div[data-setting-id], div.submenu");
    for (const div of divs) {
      if (div.classList.contains("submenu")) {
        const button = htmlQuery(div, `button[data-key]`);
        const key = this.#getKeyFromString(button.dataset.key);
        const settingData = this.#settings.get(key);
        const forSettingData = this.#settings.has(settingData?.for) ? this.#settings.get(settingData.for) : null;
        this.#log({ key, settingData, forSettingData }, { func });
        continue;
      }
      const key = this.#getKeyFromDiv(div);
      const settingData = this.#settings.get(key);

      const firstInput = htmlQuery(div, "input, select");
      if (!firstInput) continue;
      firstInput.addEventListener("change", this.#updateResetButtons.bind(this));
      if ("button" in settingData || !("default" in settingData)) continue;

      if (opt.includes("settings")) {
        const label = htmlQuery(div, "label");
        const textNode = Array.from(label.childNodes).find((n) => n.nodeName === "#text");
        const anchor = document.createElement("a");
        anchor.dataset.reset = key;
        anchor.dataset.resetType = "setting";
        anchor.innerHTML = getIconHTMLString(managerDefaults.settingResetIcon);
        anchor.dataset.tooltipDirection = "UP";
        const listener = this.#onResetClick.bind(this);
        this.#resetListeners.get("settings").set(key, listener);
        anchor.addEventListener("click", listener);
        anchor.addEventListener("contextmenu", listener);
        label.insertBefore(anchor, textNode);
      }
    }
  }

  async #onResetClick(event) {
    const func = `${funcPrefix}##onResetClick`;
    event.preventDefault();
    event.stopPropagation();
    const anchor = htmlClosest(event.target, "a[data-reset-type]");
    const section = htmlClosest(anchor, "section.mhl-settings-manager");
    const resetType = anchor.dataset.resetType;
    const resetTarget = anchor.dataset.reset;
    this.#updateSettingStats();
    let target, relevantSettings;
    switch (resetType) {
      case "setting":
        relevantSettings = [this.#settings.get(resetTarget)];
        target = relevantSettings[0].name;
        break;
      case "group":
        relevantSettings = this.#settings.filter((s) => s.group === resetTarget);
        target = resetTarget;
        break;
      case "module":
        relevantSettings = this.#settings.contents;
        target = this.#module.title;
        break;
    }
    relevantSettings = relevantSettings.filter((s) => !("button" in s));

    // if everything's default, or we right clicked, no dialog needed, just reset form values and bail
    const [defaultless, hasDefaults] = relevantSettings.partition((s) => "default" in s);
    if (hasDefaults.every((s) => s.isDefault) || event.type === "contextmenu") {
      const formDifferentFromSaved = relevantSettings.filter((s) => s.formEqualsSaved === false);
      if (formDifferentFromSaved.length > 0) {
        modBanner(`MHL.SettingsManager.Reset.FormResetBanner`, {
          type: "info",
          mod: this.options.modPrefix,
          log: { formDifferentFromSaved },
          context: { count: formDifferentFromSaved.length },
        });
        for (const setting of formDifferentFromSaved) {
          const div = htmlQuery(section, `div[data-setting-id$="${setting.key}"]`);
          this.#setInputValues(div, this.get(setting.key));
        }
      }
      return;
    }

    const processedSettings = hasDefaults.reduce((acc, s) => {
      const savedValue = this.get(s.key);
      const defaultValue = s?.default ?? undefined;
      acc.push({
        key: s.key,
        name: s.name ?? s.key,
        config: !!s?.config,
        isDefault: s?.isDefault ?? false,
        isObject: typeof savedValue === "object",
        isColor: !!s?.colorPicker,
        type: s?.type?.name ?? "Unknown",
        savedValue,
        defaultValue,
        displaySavedValue: this.#prettifyValue("choices" in s ? mhlocalize(s.choices[savedValue]) : savedValue),
        displayDefaultValue: this.#prettifyValue("choices" in s ? mhlocalize(s.choices[defaultValue]) : defaultValue),
      });
      return acc;
    }, []);

    const dialogID = `mhl-reset-${this.#module.id}-${resetType}-${resetTarget}`;
    const existingDialog = Object.values(ui.windows).find((w) => w.id === dialogID);
    if (existingDialog) {
      existingDialog.bringToTop();
      return;
    }

    const dialogData = {
      title: mhlocalize(`MHL.SettingsManager.Reset.DialogTitle`),
      buttons: {
        reset: {
          callback: MHLDialog.getFormData,
          icon: '<i class="fa-solid fa-check"></i>',
          label: mhlocalize("SETTINGS.Reset"),
        },
        cancel: {
          callback: () => false,
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: mhlocalize("Cancel"),
        },
      },
      content: `modules/${MODULE_ID}/templates/SettingsManagerReset.hbs`,
      contentData: {
        defaultlessCount: defaultless.length,
        defaultlessTooltip: defaultless.map((s) => mhlocalize(s.name)).join(", "),
        resetType,
        settings: processedSettings,
        target,
      },
      close: () => false,
      default: "cancel",
    };
    const dialogOptions = {
      classes: ["mhl-reset"],
      id: dialogID,
      resizable: true,
      width: "auto",
    };

    const doReset = await MHLDialog.wait(dialogData, dialogOptions);
    this.reset(
      Object.entries(doReset).reduce((acc, [setting, checked]) => {
        if (checked) acc.push(setting);
        return acc;
      }, [])
    );
  }

  #updateResetButtons(event = null) {
    const func = `${funcPrefix}##updateResetButtons`;
    const opt = this.options.resetButtons;
    const isGM = isRealGM(game.user);
    let section, div, key, group;
    if (event instanceof Event) {
      section = htmlClosest(event.target, "section.mhl-settings-manager");
      div = htmlClosest(event.target, "div[data-setting-id]");
      key = this.#getKeyFromDiv(div);
      group = div?.dataset?.settingGroup ?? null;
    } else if (typeof event === "string" && this.#requireSetting(event, { func })) {
      if (!this.element) return;
      key = event;
      section = htmlQuery(this.element, `section[data-category="${this.#module.id}"]`);
      div = htmlQuery(section, `div[data-setting-id$="${key}"]`);
      group = this.#settings.get(key).group;
    }
    const allowedSettings = this.#settings.filter((s) => (s?.scope === "world" ? isGM : true));
    this.#updateSettingStats();
    const formResettables = allowedSettings.filter((s) => s.formEqualsSaved === false);
    const savedResettables = allowedSettings.filter((s) => s.isDefault === false);
    const disabledClass = this.options.disabledClass ?? setting("manager-defaults")?.disabledClass ?? "";
    if (opt.includes("module")) {
      const anchor = htmlQuery(section, `a[data-reset-type="module"][data-reset="${this.#module.id}"]`);
      const listener = this.#resetListeners.get("all");
      let tooltip = "";
      if (savedResettables.length > 0) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.SavedTooltip`, { count: savedResettables.length });
        anchor.addEventListener("click", listener);
        if (formResettables.length > 0) {
          tooltip += mhlocalize(`MHL.SettingsManager.Reset.Module.FormTooltipAppend`, {
            count: formResettables.length,
          });
        }
      } else {
        if (formResettables.length > 0) {
          anchor.classList.remove(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.FormTooltipSolo`, { count: formResettables.length });
          anchor.addEventListener("click", listener);
        } else {
          anchor.classList.add(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.AllDefaultTooltip`);
          anchor.removeEventListener("click", listener);
        }
      }
      anchor.dataset.tooltip = tooltip;
    }

    if (opt.includes("groups") && group) {
      const anchor = htmlQuery(section, `a[data-reset-type="group"][data-reset="${group}"]`);
      //groups might not have anchors if none of their settings are resettable
      if (anchor) {
        const listener = this.#resetListeners.get("groups").get(group);
        const groupSavedResettables = savedResettables.filter((s) => s.group === group);
        const groupFormResettables = formResettables.filter((s) => s.group === group);
        let tooltip = "";
        if (groupSavedResettables.length > 0) {
          anchor.classList.remove(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.SavedTooltip`, { count: groupSavedResettables.length });
          anchor.addEventListener("click", listener);
          if (groupFormResettables.length > 0) {
            tooltip += mhlocalize(`MHL.SettingsManager.Reset.Group.FormTooltipAppend`, {
              count: groupFormResettables.length,
            });
          }
        } else {
          if (groupFormResettables.length > 0) {
            anchor.classList.remove(disabledClass);
            tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.FormTooltipSolo`, {
              count: groupFormResettables.length,
            });
            anchor.addEventListener("click", listener);
          } else {
            anchor.classList.add(disabledClass);
            tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.AllDefaultTooltip`);
            anchor.removeEventListener("click", listener);
          }
        }
        anchor.dataset.tooltip = tooltip;
      }
    }

    if (opt.includes("settings")) {
      const anchor = htmlQuery(div, `a[data-reset-type="setting"]`);
      if (!anchor) return; // defaultless inputs still have change listeners
      const listener = this.#resetListeners.get("settings").get(key);
      const savedResettable = savedResettables.find((s) => s.key === key);
      const formResettable = formResettables.find((s) => s.key === key);
      let tooltip = "";
      if (savedResettable) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.SavedTooltip`);
        anchor.addEventListener("click", listener);
        if (formResettable) {
          tooltip += mhlocalize(`MHL.SettingsManager.Reset.Setting.FormTooltipAppend`);
        }
      } else {
        if (formResettable) {
          anchor.classList.remove(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.FormTooltipSolo`);
          anchor.addEventListener("click", listener);
        } else {
          anchor.classList.add(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.IsDefaultTooltip`);
          anchor.removeEventListener("click", listener);
        }
      }
      anchor.dataset.tooltip = tooltip;
    }
  }

  #_value(input) {
    //grr checkboxen
    if (input?.type === "checkbox") return input.checked;
    const value = input.value;
    if (input?.dataset?.dtype === "Number") {
      if (value === "" || value === null) return null;
      return Number(value);
    }
    return value;
  }

  #setInputValues(div, value) {
    const func = `${funcPrefix}##setInputValues`;
    if (typeof div === "string" && this.#requireSetting(div, { func })) {
      const settingData = this.#settings.get(div);
      if (!settingData?.config || !this.element) return;
      div = htmlQuery(this.element, `div[data-setting-id="${this.#module.id}.${settingData.key}"]`);
    }
    const inputs = htmlQueryAll(div, "input, select");
    for (const input of inputs) {
      //grr checkboxen
      if (input.nodeName === "INPUT" && input.type === "checkbox") {
        input.checked = value;
      }
      if (input.type === "range") {
        const span = htmlQuery(div, "span.range-value");
        if (span) span.innerText = value;
      }
      input.value = value;
      input.dispatchEvent(new Event("change")); //to force visibility updates
    }
  }

  #updateSettingStats(limitToSettings = null) {
    const func = `${funcPrefix}##checkDefaults`;
    if (limitToSettings && !Array.isArray(limitToSettings)) limitToSettings = [limitToSettings];
    if (limitToSettings) limitToSettings = limitToSettings.filter((s) => this.#requireSetting(s, { func }));
    let formValues;
    if (this.element) {
      formValues = this.#getFormValues(htmlQuery(this.element, `section[data-category="${this.#module.id}"]`));
    }
    const settings = limitToSettings ? this.#settings.filter((s) => limitToSettings.includes(s.key)) : this.#settings;
    for (const settingData of settings) {
      if (settingData?.menu || settingData?.button) continue;
      const savedValue = this.get(settingData.key);
      settingData.formEqualsSaved =
        formValues && settingData.key in formValues
          ? fu.objectsEqual(savedValue, formValues[settingData.key])
          : undefined;
      settingData.isDefault = "default" in settingData ? fu.objectsEqual(settingData.default, savedValue) : undefined;
    }
  }

  #getFormValues(section) {
    const func = `${funcPrefix}##getFormValues`;
    if (!(section instanceof HTMLElement)) {
      modLog(
        { section },
        {
          mod: this.options.modPrefix,
          func,
          prefix: `MHL.SettingsManager.Error.NotAnElement`,
          context: { variable: "section" },
        }
      );
      return false;
    }
    const divs = htmlQueryAll(section, "div[data-setting-id]");
    return divs.reduce((acc, curr) => {
      const firstInput = htmlQuery(curr, "input, select");
      if (!firstInput) return acc;
      const key = this.#getKeyFromDiv(curr);
      const data = this.#settings.get(key);
      const inputValue = this.#_value(firstInput);
      acc[key] = "type" in data ? data.type(inputValue) : inputValue;
      return acc;
    }, {});
  }

  #prettifyValue(value) {
    return typeof value === "object" ? JSON.stringify(value, null, 2) : value;
  }

  #getKeyFromString(string) {
    if (isEmpty(string)) return null;
    string = logCastString(string, "string", `${funcPrefix}##getKeyFromString`);
    return string.split(/\.(.*)/)[1];
  }

  #getKeyFromDiv(div) {
    const func = `${funcPrefix}##getKeyFromDiv`;
    //todo: localize
    if (!(div instanceof HTMLElement))
      throw this.#error("expected an element", { log: { div }, func, mod: this.options.modPrefix });
    return this.#getKeyFromString(div.dataset?.settingId);
  }

  #error(errorstr, options = {}) {
    const opts = fu.mergeObject(
      options,
      {
        mod: this.options.modPrefix,
        context: {
          module: this.#module.title,
        },
      },
      { inplace: false }
    );
    return modError(errorstr, opts);
  }

  #log(loggable, options = {}) {
    const opts = fu.mergeObject(
      options,
      {
        mod: this.options.modPrefix,
        context: {
          module: this.#module.title,
        },
      },
      { inplace: false }
    );
    return modLog(loggable, opts);
  }

  #requireSetting(
    key,
    { func = null, potential = false, error = `MHL.SettingsManager.Error.NotRegistered`, context = {} } = {}
  ) {
    if (!this.#settings.has(key) && potential && !this.#potentialSettings.has(key)) {
      modLog(error, {
        type: "error",
        mod: this.options.modPrefix,
        context: { key, module: this.#module.id, ...context },
        func,
      });
      return false;
    }
    return true;
  }

  static validateButtonIcons() {
    for (const manager of MHLSettingsManager.managers) {
      manager.#validateButtonIcons();
    }
  }

  #validateButtonIcons() {
    for (const setting of this.#settings) {
      if (setting.menu && "icon" in setting) {
        setting.icon = getIconClasses(setting.icon) ?? CONFIG.MHL.fallbackIcon;
      }
      if ("button" in setting && "icon" in setting.button) {
        setting.button.icon = getIconHTMLString(setting.button.icon);
      }
    }
  }

  #validateEnrichHintsOption() {
    const func = `${funcPrefix}##validateEnrichHintsOption`;
    let enrichers = this.options.enrichHints;
    if (typeof enrichers === "boolean") return true;
    const badEnrichers = () => {
      modLog(
        { enrichHints: this.options.enrichHints },
        { func, mod: this.options.modPrefix, prefix: `MHL.SettingsManager.Error.InvalidEnrichHintsOption` }
      );
      return false;
    };
    if (!Array.isArray(enrichers)) {
      if (enrichers instanceof Map) {
        enrichers = Array.from(enrichers);
      } else if (typeof enrichers === "object") {
        enrichers = Object.entries(enrichers);
      } else {
        return badEnrichers();
      }
    }
    if (
      !enrichers.every(
        (e) =>
          e.length === 2 &&
          (e[0] instanceof RegExp || typeof e[0] === "string") &&
          ["function", "string"].includes(typeof e[1])
      )
    ) {
      return badEnrichers();
    }
    for (const [pattern, replacement] of enrichers) {
      this.#enrichers.set(pattern, replacement);
    }
    return true;
  }

  #validateCollapsibleGroupsOption() {
    const func = `${funcPrefix}##validateCollapsibleGroupsOption`;
    if (["boolean", "string"].includes(typeof this.options.collapsibleGroups)) return true;
    this.#log(
      { collapsibleGroups: this.options.collapsibleGroups },
      { func, prefix: `MHL.SettingsManager.Error.InvalidCollapsibleGroups` }
    );
    return false;
  }

  #validateGroupsOption() {
    const func = `${funcPrefix}##validateGroupsOption`;
    const groups = this.options.groups;
    if (typeof groups === "boolean") return true;
    if (groups === "a") return true;
    if (Array.isArray(groups)) {
      for (const group of groups) {
        if (typeof group !== "string") {
          this.#log({ group }, { func, prefix: `MHL.SettingsManager.Error.InvalidGroup` });
          continue;
        }
        if (this.#groupOrder.has(group)) {
          this.#log(`MHL.SettingsManager.Error.DuplicateGroup`, { func, context: { group } });
          continue;
        }
      }
      if (this.#groupOrder.size > 0) return true;
    }
    this.#log(
      { groups },
      {
        prefix: "MHL.SettingsManager.Error.InvalidGroupsOption",
        func,
      }
    );
    return false;
  }

  #validateResetButtonsOption() {
    const func = `${funcPrefix}##validateResetButtonsOption`;
    const defaultOptions = {
      module: true,
      groups: true,
      settings: true,
    };
    const valid = Object.keys(defaultOptions);
    const logInvalidType = (type) =>
      this.#log({ type }, { prefix: `MHL.SettingsManager.Warning.InvalidResetButtonType`, context: { type }, func });
    let rb = this.options.resetButtons;
    if (rb === false) return true;
    if (rb === true || rb === "all") {
      this.options.resetButtons = defaultOptions;
      return true;
    }
    if (typeof rb === "string" && valid.includes(rb)) {
      this.options.resetButtons = { [rb]: true };
    }
    if (Array.isArray(rb)) {
      if (rb.includes("all")) {
        this.options.resetButtons = defaultOptions;
        return true;
      }
      this.options.resetButtons = {};
      for (const type of rb) {
        if (valid.includes(type)) this.options.resetButtons[type] = true;
        else logInvalidType(type);
      }
      if (Object.keys(this.options.resetButtons).length > 0) return true;
    }
    if (isPlainObject(rb)) {
      this.options.resetButtons = {};
      for (const type in rb) {
        if (valid.includes(type)) this.options.resetButtons[type] = rb[type];
        else logInvalidType(type);
      }
      if (Object.keys(this.options.resetButtons).length > 0) return true;
    }
    this.#log(
      { resetButtons: this.options.resetButtons },
      { type: "error", func, prefix: `MHL.SettingsManager.Error.InvalidResetButttonsOption` }
    );
    return false;
  }

  #validateRegistrationData(data) {
    const func = `${funcPrefix}##validateRegistrationData`;
    let out = false;
    if (typeof data === "function") data = data();
    if (data instanceof Map) {
      out = new Collection(data);
    } else if (isPlainObject(data)) {
      const keysSeen = new Collection();
      for (const [key, value] of Object.entries(data)) {
        if (!this.#validateSettingKey(key)) {
          modLog("MHL.SettingsManager.Error.InvalidSettingKey", {
            type: "error",
            func,
            context: { key, module: this.#module.title },
          });
          continue;
        }
        if (keysSeen.has(key)) {
          modLog("MHL.SettingsManager.Error.DuplicateSettingKey", {
            type: "error",
            func,
            context: { key, module: this.#module.title },
          });
          continue;
        }
        keysSeen.set(key, value);
      }
      out = keysSeen;
    }
    // console.error({ out, empty: isEmpty(out) });
    if (isEmpty(out)) {
      modLog(`MHL.SettingsManager.Error.NoValidSettings`, {
        type: "error",
        mod: this.options.modPrefix,
        context: { module: this.#module.title },
        func,
      });
      return false;
    }
    return out;
  }

  #validateSettingKey(key) {
    return typeof key === "string" && !!key.match(/^[\p{L}\p{N}\.-]+$/u);
  }

  #validateSortOption() {
    const func = `${funcPrefix}##validateSortOption`;
    const defaultCompare = (a, b) => a.localeCompare(b);
    const sort = fu.deepClone(this.options.sort);
    // no modification of core ordering
    if (sort === false) return true;
    // no sorting at all, not even rendering menus first like core
    if (sort === null) {
      this.options.sort = {
        menusFirst: false,
        fn: () => 0,
      };
      return true;
    }
    // alphasort, menus first like core
    if (sort === true) {
      this.options.sort = {
        menusFirst: true,
        fn: defaultCompare,
      };
      return true;
    }
    // custom sort, but menus first like core
    if (typeof sort === "function") {
      this.options.sort = {
        menusFirst: true,
        fn: sort,
      };
      return true;
    }
    if (isPlainObject(sort)) {
      this.options.sort = {
        menusFirst: !!(sort.menusFirst ?? true),
        //if === false, no sorting, otherwise assume alphabetical
        fn: sort.fn === false ? () => 0 : sort.fn ?? defaultCompare,
      };
      return true;
    }
    this.#log({ sort: this.options.sort }, { func, prefix: `MHL.SettingsManager.Error.InvalidSortOption` });
    return false;
  }
}
