import { MODULE_ID, fu } from "../constants.mjs";
import { createHTMLElement, elementFromString, htmlClosest, htmlQuery, htmlQueryAll } from "../helpers/DOMHelpers.mjs";
import { MHLError, logCastString, modBanner, modError, modLog } from "../helpers/errorHelpers.mjs";
import { filterObject, generateSorterFromOrder, getInvalidKeys, isEmpty } from "../helpers/otherHelpers.mjs";
import { isRealGM } from "../helpers/foundryHelpers.mjs";
import { localeSort, mhlocalize, nullSort, oxfordList, sluggify } from "../helpers/stringHelpers.mjs";
import { getIconClasses, getIconHTMLString } from "../helpers/iconHelpers.mjs";
import { MHLDialog } from "../apps/MHLDialog.mjs";
import { setting } from "../settings/settings.mjs";
import { MHLSettingMenu } from "../apps/MHLSettingMenu.mjs";
import { Accordion } from "./Accordion.mjs";
import { deeperClone, isPlainObject } from "../helpers/otherHelpers.mjs";
import { MHL } from "../init.mjs";

const funcPrefix = `MHLSettingsManager`;
export class MHLSettingsManager {
  #colorPattern = "^#[A-Fa-f0-9]{6}";
  #enrichers = new Map([
    [/`([^`]+)`/g, `<code>$1</code>`],
    [/\[([^\]]+)\]\(([^\)]+)\)/g, `<a href="$2">$1</a>`],
  ]);
  #groups = new Set();
  #initialized = false;
  #module;
  #options;
  #potentialSettings = new Collection();
  #resetListeners = new Collection([
    ["all", null],
    ["groups", new Collection()],
    ["settings", new Collection()],
  ]);
  #resetListener;
  #settings = new Collection();

  static #readyHookID;
  static #managers = new Collection();
  static get managers() {
    return MHLSettingsManager.#managers;
  }

  constructor(moduleFor, options = {}) {
    const func = `${funcPrefix}#constructor`;
    this.#module = moduleFor instanceof Module ? moduleFor : game.modules.get(moduleFor);
    if (!this.#module) throw MHLError(`MHL.SettingsManager.Error.BadModuleID`, { log: { moduleFor }, func });

    this.#options = fu.mergeObject(this.defaultOptions, options, {});

    if (MHLSettingsManager.#managers.has(this.#module.id)) {
      throw modError(`MHL.SettingsManager.Error.ManagerAlreadyExists`, { context: { module: this.#module.title } });
    } else {
      MHLSettingsManager.#managers.set(this.#module.id, this);
      MHLSettingsManager.#managers[this.#options.modPrefix.toLowerCase()] ??= this;
    }

    //validate groups
    this.#options.groups = this.#processGroupsOption();
    //validate sort
    this.#options.sort = this.#processSortOption();
    //validate & normalize resetButtons
    this.#options.resetButtons = this.#processResetButtonsOption();
    //validate & set enrichers if provided
    if (!this.#validateEnrichHintsOption()) this.#options.enrichHints = true;

    if (options.settings) this.registerSettings(options.settings);
    //defer button icon checks to ready to account for lazily loaded icon fonts
    if (!MHLSettingsManager.#readyHookID) {
      MHLSettingsManager.#readyHookID = Hooks.once("ready", MHLSettingsManager.validateIcons);
    }
    this.#resetListener = this.#onResetClick.bind(this);
    Hooks.on("renderSettingsConfig", this.#onRenderSettings.bind(this));
    Hooks.on("closeSettingsConfig", this.#onCloseSettings.bind(this));
    this.#initialized = true;
  }

  get initialized() {
    return this.#initialized;
  }

  get app() {
    return Object.values(ui.windows).find((w) => w.id === "client-settings");
  }

  get section() {
    if (!this.app) return;
    const settingsConfigRoot = this.app.element instanceof jQuery ? this.app.element[0] : this.app.element;
    return htmlQuery(settingsConfigRoot, `section[data-category="${this.#module.id}"]`);
  }

  get defaultOptions() {
    const prefix = sluggify(this.#module.title, { camel: "bactrian" });
    return {
      // localization key section placed between setting name and choice value when inferring choice localization
      choiceInfix: "Choice",
      // true/false enables/disables built-in enrichers, or pass your own as an entries array (adds to built-ins)
      enrichHints: true,
      // localization key suffix appended to the settingPrefix for group names
      groupInfix: "Group",
      // how to handle setting grouping. false disables, true and "a" are aliases for the defaults
      groups: {
        // are collapsible groups animated by default
        animated: false,
        // are groups collapsible by default
        collapsible: false,
        // function used to sort the list of groups.
        // passing an array of strings generates a function that will sort with that order at the head of the list
        sort: nullSort,
        // the icon css class(es) for the accordion indicator. true means use the manager-defaults setting value
        accordionIndicator: true,
        // any css classes that will be applied to this group
        classes: [],
        // per group name key, override any of the above options except sort (intra- and extra-group sorting is handled by the sort option below)
        overrides: {},
      },
      // prefix for logged errors/warnings
      modPrefix: prefix.replace(/[a-z]/g, ""),
      // add reset-to-default buttons
      resetButtons: {
        // for the whole module
        module: false,
        // per group
        groups: false,
        // per individual setting
        settings: false,
        // the css class applied to buttons disabled because all the setting(s) they cover are already in their default state
        disabledClass: true,
      },
      // string to start inferred localization keys with
      settingPrefix: prefix + ".Setting",
      // handle sorting of settings. true for alphabetical on name, or a custom compare function.
      sort: {
        menusFirst: true,
        fn: nullSort,
      },
      // process settings with visibility data, only showing them in the settings window conditionally on the value of another setting
      visibility: true,
    };
  }

  get moduleResetIcon() {
    const opt = this.#options.resetButtons?.module;
    return opt && typeof opt === "string" ? opt : setting("manager-defaults").moduleResetIcon;
  }

  get groupResetIcon() {
    const opt = this.#options.resetButtons?.groups;
    return opt && typeof opt === "string" ? opt : setting("manager-defaults").groupResetIcon;
  }

  get settingResetIcon() {
    const opt = this.#options.resetButtons?.settings;
    return opt && typeof opt === "string" ? opt : setting("manager-defaults").settingResetIcon;
  }

  get disabledClass() {
    const opt = this.#options.resetButtons?.disabledClass;
    return opt && typeof opt === "string" ? opt : setting("manager-defaults").disabledClass;
  }

  #accordionIndicator(group) {
    const accordionIndicator =
      this.#options.groups?.overrides?.[group]?.accordionIndicator ?? this.#options.groups?.accordionIndicator ?? true;
    return accordionIndicator === true ? setting("manager-defaults")?.accordionIndicatorIcon : accordionIndicator;
  }

  #onRenderSettings(app, html, data) {
    const func = `${funcPrefix}##onRenderSettings`;
    html = html instanceof jQuery ? html[0] : html;
    //bail if this module has no configurable settings (either available to this user, or at all)
    const configurable = this.#settings.filter((setting) => setting?.config);
    if (configurable.length === 0) return;
    const clientSettings = configurable.filter((setting) => setting?.scope !== "world");
    if (!clientSettings.length && !isRealGM(game.user)) return;

    this.section.classList.add("mhl-settings-manager");

    const divs = htmlQueryAll(this.section, "div.form-group");
    const firstInputs = [];
    for (const div of divs) {
      const key = this.#getSettingKeyFromElement(div);
      const settingData = this.#settings.get(key);
      settingData.div = div;

      // buttons dont need change listeners or have formValues
      if (settingData.button) continue;

      const firstInput = htmlQuery(div, "input, select, multi-select, color-picker");
      if (firstInput) {
        // grab initial form values so visibility doesn't choke
        settingData.formValue = this.#_value(firstInput);
        firstInputs.push(firstInput);
      }
    }
    const savedValues = this.getAll();
    for (const key in savedValues) {
      const settingData = this.#settings.get(key);
      settingData.isDefault =
        "realDefault" in settingData ? fu.objectsEqual(settingData.realDefault, savedValues[key]) : undefined;
    }

    this.#applyGroupsAndSort();

    // unconditionally add color pickers and action buttons, since they're opt-in in setting data
    this.#addColorPickers();
    this.#replaceWithButtons();

    if (this.#options.enrichHints) {
      this.#enrichHints();
    }

    if (this.#options.resetButtons) {
      this.#addResetButtons();
    }
    //initial visibility checks & reset button updates
    for (const el of firstInputs) {
      el.addEventListener("change", this.#onChangeInput.bind(this));
      el.dispatchEvent(new Event("change"));
    }
  }

  #onCloseSettings() {
    this.#settings.forEach((s) => {
      delete s.div;
      delete s.formValue;
      delete s.formEqualsSaved;
    });
  }

  #onChangeInput(event) {
    const func = `${funcPrefix}##onChangeInput`;
    const target = event.target;
    const formValue = this.#_value(target);
    const settingDiv = htmlClosest(target, "div[data-setting-id]");
    const key = this.#getSettingKeyFromElement(settingDiv);
    const savedValue = this.get(key);
    const settingData = this.#settings.get(key);
    settingData.formValue = formValue;
    settingData.formEqualsSaved = fu.objectsEqual(savedValue, formValue);
    this.#updateVisibility();
    this.#updateResetButtons(key);
  }

  #onUpdateSetting(key, value) {
    const func = `${funcPrefix}##onUpdateSetting`;
    const settingData = this.#settings.get(key);
    settingData.isDefault = "realDefault" in settingData ? fu.objectsEqual(settingData.realDefault, value) : undefined;
    this.#setInputValues(key, value);
    // if we're updating a non-config setting, the change event wont fire a visibility update, so do it manually
    if (!settingData.config) this.#updateVisibility();
    this.#updateResetButtons(key);
  }

  #sortSettings(settings) {
    const func = `${funcPrefix}##sortSettings`;
    return settings.sort((a, b) => {
      const aName = mhlocalize(a.name);
      const bName = mhlocalize(b.name);
      if (this.#options.sort.menusFirst) {
        if (a.menu) {
          return b.menu ? this.#options.sort.fn(aName, bName) : -1;
        }
        return b.menu ? 1 : this.#options.sort.fn(aName, bName);
      } else {
        return this.#options.sort.fn(aName, bName);
      }
    });
  }

  #applyGroupsAndSort() {
    const func = `${funcPrefix}##applyGroupsAndSort`;
    if (!this.section) return;
    const sortOrder = [htmlQuery(this.section, "h2")];
    const visibleSettings = this.#settings.filter(
      (s) => (s.config || s.menu) && (isRealGM(game.user) || s.scope === "client")
    );

    let accordionUsed = false;
    if (this.#options.groups) {
      const groups = [
        null,
        ...[...this.#groups].sort((a, b) => this.#options.groups.sort(mhlocalize(a), mhlocalize(b))),
      ];
      for (const group of groups) {
        const animated = this.#options.groups.overrides?.[group]?.animated ?? this.#options.groups.animated;
        accordionUsed ||= animated;
        const collapsible = this.#options.groups.overrides?.[group]?.collapsible ?? this.#options.groups.collapsible;
        const classes = this.#options.groups.overrides?.[group]?.classes ?? this.#options.groups.classes;
        classes.unshift("mhl-setting-group-container");
        const groupSettings = visibleSettings.filter((s) => s.group === group);
        // this.#log({ group, accordionUsed, groupSettings, classes, collapsible, animated, mappedVisibles }, { func });
        // if we have no settings we can touch, bail
        if (groupSettings.length === 0) continue;
        this.#sortSettings(groupSettings);

        // the null group just goes on the stack in sorted order, no wrappers
        if (group === null) {
          for (const setting of groupSettings) {
            sortOrder.push(setting.div);
          }
          continue;
        }

        const groupH3 = createHTMLElement("h3", {
          dataset: {
            settingGroup: group,
            accordionHeader: animated,
          },
          children: [mhlocalize(group)],
        });
        const groupContainerElement = createHTMLElement("div", {
          classes,
          dataset: { settingGroup: group },
        });
        sortOrder.push(groupContainerElement);
        let groupContentElement;
        if (collapsible) {
          if (animated) {
            groupContentElement = createHTMLElement("div", { dataset: { accordionContent: true } });
            groupH3.append(
              elementFromString(getIconHTMLString(this.#accordionIndicator(group), "mhl-accordion-indicator"))
            );
            groupContainerElement.append(groupH3, groupContentElement);
          } else {
            const summary = createHTMLElement("summary", { children: [groupH3] });
            groupContentElement = createHTMLElement("details", {
              children: [summary],
              dataset: { settingGroup: group },
              attributes: { open: true },
            });
            groupContainerElement.append(groupContentElement);
          }
        } else {
          groupContainerElement.append(groupH3);
        }
        for (const setting of groupSettings) {
          setting.div.dataset.settingGroup = group;
          if (groupContentElement) {
            groupContentElement.append(setting.div);
          } else {
            sortOrder.push(setting.div);
          }
        }
      }
    } else {
      // this.#options.sort.fn should always exist, so always run the sort
      this.#sortSettings(visibleSettings);
      for (const setting of visibleSettings) {
        sortOrder.push(setting.div);
      }
    }
    for (const node of sortOrder) {
      this.section.append(node);
    }

    if (accordionUsed)
      new Accordion({
        headingSelector: `h3[data-accordion-header]`,
        contentSelector: `div[data-accordion-content]`,
        mod: this.#options.modPrefix,
        initalOpen: Infinity,
      }).bind(this.section);
  }

  has(key, { potential = false } = {}) {
    const func = `${funcPrefix}#has`;
    key = this.#logCastString(key, "key", func);
    return this.#settings.has(key) || (potential && this.#potentialSettings.has(key));
  }

  get(key) {
    const func = `${funcPrefix}#get`;
    if (!this.#requireSetting(key, { func })) return undefined;
    // either we're past Setup, or it's a client setting that can be retrieved early
    if (game?.user || this.#settings.get(key).scope === "client") return game.settings.get(this.#module.id, key);
    return undefined;
  }

  getAll() {
    return this.#settings.reduce((acc, setting) => {
      if (!setting.menu && !setting.button) acc[setting.key] = this.get(setting.key);
      return acc;
    }, {});
  }

  beenSet(key) {
    const func = `${funcPrefix}#beenSet`;
    if (!this.#requireSetting(key, { func })) return false;
    const fullkey = `${this.#module.id}.${key}`;
    const scope = this.#settings.get(key).scope;
    const storage = game.settings.storage.get(scope);
    return scope === "world" ? !!storage.find((s) => s.key === fullkey) : fullkey in storage;
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
      if (!("realDefault" in data)) continue;
      sets.push(this.set(key, data.realDefault));
      this.#setInputValues(key, data.realDefault);
    }
    return await Promise.all(sets);
  }

  async hardReset(keys) {
    const func = `${funcPrefix}#reset`;
    if (!Array.isArray(keys)) keys = [keys];
    const deletes = [];
    const clientStorage = game.settings.storage.get("client");
    const worldStorage = game.settings.storage.get("world");
    for (const key of keys) {
      const fullkey = `${this.#module.id}.${key}`;
      if (!this.#requireSetting(key, { func })) continue;
      const data = this.#settings.get(key);
      if (data.scope === "world") {
        const settingDoc = worldStorage.find((s) => s.key === fullkey);
        if (settingDoc) deletes.push(settingDoc.delete());
      } else {
        clientStorage.removeItem(fullkey);
      }
    }
    return await Promise.all(deletes);
  }

  async resetAll() {
    return this.reset(Array.from(this.#settings.keys()));
  }

  async hardResetAll() {
    return this.hardReset(Array.from(this.#settings.keys()));
  }

  registerSettings(data) {
    const func = `${funcPrefix}#registerSettings`;
    const settings = this.#validateRegistrationData(data);
    if (!settings) return false; //validator already raised console error

    //have all potential keys available to predicate visibility upon
    this.#potentialSettings = deeperClone(settings);

    for (const [key, data] of settings.entries()) {
      const success = this.registerSetting(key, data, { initial: true });
      if (!success) {
        this.#log(
          { key, data },
          {
            prefix: `MHL.SettingsManager.Error.InvalidSettingData`,
            func,
            context: { key },
          }
        );
      }
    }

    if (game?.user) {
      // 'are settings available' hack
      // this.#updateHooks();
    } else {
      Hooks.once("setup", this.#updateHooks.bind(this));
    }
  }

  registerSetting(key, data, { initial = false } = {}) {
    const func = `${funcPrefix}#registerSetting`;
    if (typeof key !== "string") {
      return false;
    }
    if (!this.#potentialSettings.has(key)) this.#potentialSettings.set(key, data);
    if (this.#settings.has(key)) {
      this.#log(`MHL.SettingsManager.Error.DuplicateSetting`, {
        type: "error",
        context: { key },
        func,
      });
      return false;
    }
    data = this.#processSettingData(key, data);
    if (!data) {
      return false;
    }
    // only save groups of settings that get registered
    if (data.group !== null) this.#groups.add(data.group);
    //actually register the setting finally
    this.#register(key, data);
    // only update hooks if we're not inside a registerSettings call
    if (!initial) this.#updateHooks(key);
    this.#potentialSettings.delete(key);
    return true;
  }

  #processSettingData(key, data) {
    const func = `${funcPrefix}##processSettingData`;
    //add the key to the data because Collection's helpers only operate on values
    data.key = key;
    //handle registering settings menus
    if (data.menu || data.type?.prototype instanceof FormApplication) {
      //TODO: implement generation in v12, add app v2 to check
      // if (!data?.type || !(data.type?.prototype instanceof FormApplication)) return false;
      data.menu = true;
    }

    // v12+ assigns default: null to settings registered without a default
    if ("default" in data) data.realDefault = deeperClone(data.default);

    //ensure settings have a visible name, even if it's a broken localization key
    if (data.config && !("name" in data)) data.name = true;

    // if name, hint, or a choice or menu label is passed as null, infer the desired translation key
    data = this.#processInferrableLabels(key, data);

    //validate button settings
    if ("button" in data) {
      data.button = this.#processButtonData(key, data.button);
      // since buttons replace whole settings, if validation fails, don't create a useless text input
      if (!data.button) return false;
    }

    //only allow colour pickers for settings with a valid colour hex code as default value
    if ("colorPicker" in data) {
      const regex = new RegExp(this.#colorPattern);
      if (!regex.test(data.realDefault ?? "")) {
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
    const originalOnChange = data.onChange;
    data.onChange = function (value) {
      // this.#updateHooks(key);
      // this.#updateResetButtons(key);
      this.#onUpdateSetting(key, value);
      if (originalOnChange) originalOnChange(value);
    }.bind(this);

    //handle setting-conditional hooks, has to happen after registration or the error handling in setHooks gets gross
    if ("hooks" in data) {
      data.hooks = this.#processHooksData(key, data.hooks);
      if (!data.hooks) delete data.hooks;
    }
    //handle groups, make sure data.group always exists
    if ("group" in data) {
      data.group = this.#expandPartialGroupName(this.#logCastString(data.group, "data.group", func));
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

  #processInferrableLabels(key, data) {
    // ensure configurable settings have names
    if (data.name === true) {
      data.name = [this.#options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Name"].join(".");
    }
    if (data.hint === true) {
      data.hint = [this.#options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Hint"].join(".");
    }
    if (isPlainObject(data.choices)) {
      for (const [choiceValue, choiceLabel] of Object.entries(data.choices)) {
        if (choiceLabel === true) {
          data.choices[choiceValue] = [
            this.#options.settingPrefix,
            sluggify(key, { camel: "bactrian" }),
            this.#options.choiceInfix,
            sluggify(choiceValue, { camel: "bactrian" }),
          ].join(".");
        }
      }
    }
    if (data.label === true) {
      data.label = [this.#options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Label"].join(".");
    }
    return data;
  }

  #generateSettingMenu(data) {
    //todo: do this in v12
    // if (!fu.isNewerVersion(game.version, 12)) return;
    // const func = `${funcPrefix}##generateSettingMenu`;
    // if (!("for" in data) || !this.#requireSetting(data.for, { func, potential: true })) {
    //   return false;
    // }
    // const forData = this.#settings.get(data.for) || this.#potentialSettings.get(data.for);
    // if (!(forData.type?.prototype instanceof foundry.abstract.DataModel)) return false;
    // const moduleID = this.#module.id;
    // return class MHLGeneratedSettingMenu extends MHLSettingMenu {
    //   static get defaultOptions() {
    //     const options = super.defaultOptions;
    //     options.classes.push("mhl-setting-menu");
    //     options.width = 400;
    //     options.resizable = true;
    //     return options;
    //   }
    //   getData(options = {}) {
    //     const context = super.getData(options);
    //     context.key = data.for;
    //     context.module = moduleID;
    //     context.model = game.settings.get(MODULE_ID, data.for).clone();
    //     context.v12 = fu.isNewerVersion(game.version, 12);
    //     return context;
    //   }
    //   _updateObject(event, formData) {
    //     const expanded = fu.expandObject(formData);
    //     modLog(
    //       { event, formData, expanded },
    //       {
    //         type: "warn",
    //         mod: this.#options.modPrefix,
    //         func: `_updateObject`,
    //       }
    //     );
    //     game.settings.set(MODULE_ID, data.for, expanded);
    //   }
    // };
  }

  #processButtonData(key, buttonData) {
    const func = `${funcPrefix}##processButtonData`;
    if (!isPlainObject(buttonData) || typeof buttonData.action !== "function") {
      this.#log({ buttonData }, { prefix: `MHL.SettingsManager.Error.Button.BadFormat`, func, context: { key } });
      return false;
    }
    if (!("label" in buttonData) || buttonData.label === true) {
      buttonData.label = [this.#options.settingPrefix, sluggify(key, { camel: "bactrian" }), "Label"].join(".");
    } else {
      buttonData.label = this.#logCastString(buttonData.label, "buttonData.label", func);
    }
    // validateIcons() runs on ready, to let additional icon fonts get registered as late as setup
    return buttonData;
  }

  #processVisibilityData(key, data) {
    const func = `${funcPrefix}##processVisibilityData`;
    // assume passed functions are valid, no good way to interrogate
    if (typeof data === "function") return data;

    const tests = Array.isArray(data) ? data : [data];
    if (tests.some((e) => typeof e !== "string")) {
      this.#log({ key, data }, { prefix: "MHL.SettingsManager.Error.Visibility.BadFormat", func, type: "error" });
      return false;
    }
    for (const test of tests) {
      const dependsOn = test.match(/^(s|f)?(!)?(.+)/)[3];
      if (dependsOn === key) {
        this.#log("MHL.SettingsManager.Error.Visibility.Recursion", { func, type: "error" });
        return false;
      }
      if (
        !this.#requireSetting(dependsOn, {
          func,
          potential: true,
          context: { key, dependsOn },
          errorstr: `MHL.SettingsManager.Error.Visibility.UnknownDependency`,
        })
      )
        return false;
    }
    return (form, saved) => {
      return tests.reduce((pass, test) => {
        const [_, type, invert, dependency] = test.match(/^(s|f)?(!)?(.+)/);
        const value = (type === "s" ? saved : form)[dependency];
        pass &&= invert ? !value : value;
        return pass;
      }, true);
    };
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

  #enrichHints() {
    const func = `${funcPrefix}##enrichHints`;
    if (!this.section) return;
    const hints = htmlQueryAll(this.section, ":is(div[data-setting-id], div.submenu) p.notes");
    for (const hint of hints) {
      let text = hint.innerHTML;
      if (!text) continue;
      for (const [pattern, replacement] of this.#enrichers.entries()) {
        text = text.replace(pattern, replacement);
      }
      text.replace(/(<script.*>.*<\/script>)/g, "");
      hint.innerHTML = text;
    }
  }

  #addColorPickers() {
    const func = `${funcPrefix}##addColorPickers`;
    if (!this.section) return; //todo: logging?
    const colorSettings = this.#settings.filter((s) => s?.colorPicker);
    //stored in private prop so it can be easily changed if type="color" inputs take the stick out their ass
    const regex = new RegExp(this.#colorPattern);
    for (const setting of colorSettings) {
      const textInput = htmlQuery(setting.div, 'input[type="text"]');
      if (!textInput) continue;
      const colorPicker = createHTMLElement("input", {
        attributes: { type: "color", value: this.get(setting.key) },
        dataset: { edit: setting.div.dataset.settingId }, // required for styling?!
      });
      colorPicker.addEventListener(
        "input",
        function (event) {
          //force a reset anchor refresh; foundry's code for updating the text field runs too slowly?
          textInput.value = event.target.value;
          textInput.dispatchEvent(new Event("change"));
        }.bind(this)
      );
      textInput.parentElement.append(colorPicker);
      textInput.pattern = this.#colorPattern;
      textInput.dataset.tooltipDirection = "UP";
      textInput.addEventListener("input", (event) => {
        //would love to support more than a string 6-character hex code, but input[type=color] yells about condensed and/or rgba on chrome
        if (event.target.value.length > 7) {
          event.target.value = event.target.value.substring(0, 7);
        }
        if (!regex.test(event.target.value)) {
          textInput.dataset.tooltip = mhlocalize(`MHL.SettingsManager.ColorPicker.ValidHexCode`);
        } else {
          textInput.dataset.tooltip = "";
          colorPicker.value = event.target.value;
        }
      });
    }
  }

  #replaceWithButtons() {
    const func = `${funcPrefix}##replaceWithButtons`;
    if (!this.section) return;
    const buttonSettings = this.#settings.filter((s) => s.button);
    for (const setting of buttonSettings) {
      const fieldDiv = htmlQuery(setting.div, ".form-fields");
      setting.div.classList.add("submenu");
      const children = [createHTMLElement("label", { children: [mhlocalize(setting.button.label)] })];
      if (setting.button.icon) children.unshift(elementFromString(getIconHTMLString(setting.button.icon)));
      const button = createHTMLElement("button", {
        attributes: { type: "button" },
        classes: ["mhl-setting-button"],
        children,
      });
      button.addEventListener("click", setting.button.action);
      fieldDiv.replaceWith(button);
    }
  }

  #updateVisibility() {
    const func = `${funcPrefix}##updateVisibility`;
    if (!this.section) return;
    const savedValues = this.getAll();
    const formValues = this.#getFormValues();
    const predicated = this.#settings.filter((s) => s.visibility && s.div);
    for (const setting of predicated) {
      const visible = setting.div.style.display !== "none";
      const show = setting.visibility(formValues, savedValues, visible);
      setting.div.style.display = show ? "flex" : "none";
    }
  }

  #addResetButtons() {
    const func = `${funcPrefix}##addResetButtons`;
    if (!this.section) return;
    const opt = this.#options.resetButtons;
    const isGM = isRealGM(game.user);
    const resettables = this.#settings.filter(
      (s) => "realDefault" in s && !s.button && !s.menu && (isGM || s.scope === "client")
    );
    if (opt.module) {
      const h2 = htmlQuery(this.section, "h2");
      const resetIcon = elementFromString(getIconHTMLString(this.moduleResetIcon));
      const resetAnchor = createHTMLElement("a", {
        dataset: { resetType: "module", resetTarget: this.#module.id, tooltipDirection: "UP" },
        children: [resetIcon],
      });
      const resetSpan = createHTMLElement("span", { children: [resetAnchor], classes: ["mhl-reset-button"] });
      resetAnchor.addEventListener("click", this.#resetListener);
      resetAnchor.addEventListener("contextmenu", this.#resetListener);
      h2.append(resetSpan);
    }
    if (opt.groups) {
      const h3s = htmlQueryAll(this.section, "h3[data-setting-group]");
      for (const h3 of h3s) {
        const group = h3.dataset.settingGroup;
        const groupResettables = resettables.filter((s) => s.group === group);
        if (groupResettables.length === 0) continue;
        const resetIcon = elementFromString(getIconHTMLString(this.groupResetIcon));
        const resetAnchor = createHTMLElement("a", {
          dataset: { resetType: "group", reset: group, tooltipDirection: "UP" },
          children: [resetIcon],
        });
        const resetSpan = createHTMLElement("span", { children: [resetAnchor], classes: ["mhl-reset-button"] });
        resetAnchor.addEventListener("click", this.#resetListener);
        resetAnchor.addEventListener("contextmenu", this.#resetListener);
        h3.append(resetSpan);
      }
    }
    if (opt.settings) {
      for (const setting of resettables) {
        let div;
        if (!setting.config) {
          const menu = this.#settings.find((s) => s.for === setting.key);
          if (!menu) continue;
          div = menu.div;
        } else {
          div = setting.div;
        }
        const label = htmlQuery(div, "label");
        const resetIcon = elementFromString(getIconHTMLString(this.settingResetIcon));
        const resetAnchor = createHTMLElement("a", {
          dataset: { resetType: "setting", reset: setting.key, tooltipDirection: "UP" },
          children: [resetIcon],
        });
        resetAnchor.addEventListener("click", this.#resetListener);
        resetAnchor.addEventListener("contextmenu", this.#resetListener);
        label.prepend(resetAnchor);
        // run initial update here to cover non-config object settings with anchors on their menu buttons
        this.#updateResetButtons(setting.key);
      }
    }
  }

  async #onResetClick(event) {
    const func = `${funcPrefix}##onResetClick`;
    event.preventDefault();
    event.stopPropagation();
    const rightClick = event.type === "contextmenu";
    const anchor = event.currentTarget;
    const resetType = anchor.dataset.resetType;
    const resetTarget = anchor.dataset.reset;
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
    relevantSettings = relevantSettings.filter((s) => !s.button && !s.menu);
    this.#log({ relevantSettings, target, rightClick }, { func });
    // if everything's default, or we right clicked, no dialog needed, just reset form values and bail
    const [defaultless, hasDefaults] = relevantSettings.partition((s) => "realDefault" in s);
    if (hasDefaults.every((s) => s.isDefault) || event.type === "contextmenu") {
      const formDifferentFromSaved = relevantSettings.filter((s) => s.formEqualsSaved === false);
      if (formDifferentFromSaved.length > 0) {
        modBanner(`MHL.SettingsManager.Reset.FormResetBanner`, {
          type: "info",
          mod: this.#options.modPrefix,
          log: { formDifferentFromSaved },
          context: { count: formDifferentFromSaved.length },
        });
        for (const setting of formDifferentFromSaved) {
          this.#setInputValues(setting.div, this.get(setting.key));
        }
      }
      return;
    }
    const iconMap = new Map([
      [String, "code-string"],
      ["StringField", "code-string"],
      [Number, "numeric"],
      ["NumberField", "numeric"],
      [Boolean, "code-equal"],
      ["color", "palette"],
      ["ColorField", "palette"],
      ["model", "database"],
      ["function", "function"],
      ["unknown", "question flip-vertical"],
    ]);
    const processedSettings = hasDefaults.reduce((acc, s) => {
      const savedValue = this.get(s.key);
      const defaultValue = s?.realDefault ?? undefined;
      const typeGlyph =
        iconMap.get(s.type) ??
        (s.type?.prototype instanceof foundry.abstract.DataModel
          ? iconMap.get("model")
          : s.colorPicker
          ? iconMap.get("color")
          : iconMap.get(s.type?.name)) ??
        iconMap.get("unknown");
      const typeTooltip = s.type?.name ?? "Unknown";
      const typeIcon = elementFromString(getIconHTMLString(typeGlyph));
      typeIcon.dataset.tooltipDirection = "UP";
      typeIcon.dataset.tooltip = typeTooltip;
      acc.push({
        key: s.key,
        name: s.name ?? s.key,
        config: !!s.config,
        isDefault: s.isDefault ?? false,
        isObject: typeof savedValue === "object",
        isColor: !!s.colorPicker,
        typeIcon: typeIcon.outerHTML,
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
          icon: getIconHTMLString("fa-check"),
          label: mhlocalize("SETTINGS.Reset"),
        },
        cancel: {
          callback: () => false,
          icon: getIconHTMLString("fa-xmark"),
          label: mhlocalize("Cancel"),
        },
      },
      content: `modules/${MODULE_ID}/templates/SettingsManagerReset.hbs`,
      contentData: {
        defaultlessCount: defaultless.length,
        defaultlessTooltip: oxfordList(defaultless.map((s) => mhlocalize(s.name ?? s.key))),
        resetType,
        settings: processedSettings,
        target,
      },
      close: () => false,
      default: "cancel",
      render: (html) => {
        const objects = htmlQueryAll(html, ".value-display.object-setting");
        for (const object of objects) MHL().hljs.highlightElement(object);
      },
    };
    const dialogOptions = {
      classes: ["mhl-reset", "mhl-hljs-light"],
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

  #updateResetButtons(key) {
    const func = `${funcPrefix}##updateResetButtons`;
    if (!this.section || !this.#requireSetting(key, { func })) return;
    const opt = this.#options.resetButtons;
    const allowedSettings = this.#settings.filter((s) => isRealGM(game.user) || s.scope === "client");
    const formResettables = allowedSettings.filter((s) => s.formEqualsSaved === false);
    const savedResettables = allowedSettings.filter((s) => s.isDefault === false);
    const disabledClass = this.disabledClass;
    const settingData = this.#settings.get(key);
    const group = settingData.group;
    if (opt.module) {
      const anchor = htmlQuery(this.section, `a[data-reset-type="module"]`);
      let tooltip = "";
      if (savedResettables.length > 0) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.SavedTooltip`, { count: savedResettables.length });
        anchor.addEventListener("click", this.#resetListener);
        if (formResettables.length > 0) {
          tooltip += mhlocalize(`MHL.SettingsManager.Reset.Module.FormTooltipAppend`, {
            count: formResettables.length,
          });
        }
      } else if (formResettables.length > 0) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.FormTooltipSolo`, { count: formResettables.length });
        anchor.addEventListener("click", this.#resetListener);
      } else {
        anchor.classList.add(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Module.AllDefaultTooltip`);
        anchor.removeEventListener("click", this.#resetListener);
      }
      anchor.dataset.tooltip = tooltip;
    }
    if (opt.groups && group) {
      const anchor = htmlQuery(this.section, `a[data-reset-type="group"][data-reset="${group}"]`);
      //groups might not have anchors if none of their settings are resettable
      if (anchor) {
        const groupSavedResettables = savedResettables.filter((s) => s.group === group);
        const groupFormResettables = formResettables.filter((s) => s.group === group);
        let tooltip = "";
        if (groupSavedResettables.length > 0) {
          anchor.classList.remove(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.SavedTooltip`, { count: groupSavedResettables.length });
          anchor.addEventListener("click", this.#resetListener);
          if (groupFormResettables.length > 0) {
            tooltip += mhlocalize(`MHL.SettingsManager.Reset.Group.FormTooltipAppend`, {
              count: groupFormResettables.length,
            });
          }
        } else if (groupFormResettables.length > 0) {
          anchor.classList.remove(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.FormTooltipSolo`, {
            count: groupFormResettables.length,
          });
          anchor.addEventListener("click", this.#resetListener);
        } else {
          anchor.classList.add(disabledClass);
          tooltip = mhlocalize(`MHL.SettingsManager.Reset.Group.AllDefaultTooltip`);
          anchor.removeEventListener("click", this.#resetListener);
        }
        anchor.dataset.tooltip = tooltip;
      }
    }
    if (opt.settings) {
      const anchor = htmlQuery(this.section, `a[data-reset-type="setting"][data-reset="${key}"]`);
      if (!anchor) return; // defaultless inputs still have change listeners
      const savedResettable = savedResettables.find((s) => s.key === key);
      const formResettable = formResettables.find((s) => s.key === key);
      let tooltip = "";
      if (savedResettable) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.SavedTooltip`);
        anchor.addEventListener("click", this.#resetListener);
        if (formResettable) {
          tooltip += mhlocalize(`MHL.SettingsManager.Reset.Setting.FormTooltipAppend`);
        }
      } else if (formResettable) {
        anchor.classList.remove(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.FormTooltipSolo`);
        anchor.addEventListener("click", this.#resetListener);
      } else {
        anchor.classList.add(disabledClass);
        tooltip = mhlocalize(`MHL.SettingsManager.Reset.Setting.IsDefaultTooltip`);
        anchor.removeEventListener("click", this.#resetListener);
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
    if (!this.section) return;
    if (typeof div === "string" && this.#requireSetting(div, { func })) {
      div = this.#settings.get(div).div;
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

  #getFormValues() {
    const func = `${funcPrefix}##getFormValues`;
    if (!this.section) return;
    return this.#settings.reduce((acc, setting) => {
      if (setting.formValue) {
        acc[setting.key] = setting.formValue;
      }
      return acc;
    }, {});
  }

  #prettifyValue(value) {
    return typeof value === "object" ? JSON.stringify(value, null, 2) : value;
  }

  #getSettingKeyFromString(string) {
    //todo: remember why bailing on null is important
    if (isEmpty(string)) return null;
    string = this.#logCastString(string, "string", `${funcPrefix}##getSettingKeyFromString`);
    // return everything after the first .
    return string.split(/\.(.*)/)[1];
  }

  #getSettingKeyFromElement(el, dataKey = "settingId") {
    const func = `${funcPrefix}##getSettingKeyFromElement`;
    //todo: localize
    if (!(el instanceof HTMLElement)) throw this.#error("expected an element", { log: { div: el }, func });
    return this.#getSettingKeyFromString(el.dataset?.[dataKey] ?? htmlQuery(el, "button[data-key]")?.dataset?.key);
  }

  #expandPartialGroupName(group) {
    // we know the null group will always exist
    if (group === null) return null;
    group = this.#logCastString(group, "group", `${funcPrefix}##expandPartialGroupName`);
    if (!group.startsWith(".")) return group;
    return `${this.#options.settingPrefix}${this.#options.groupInfix}${group}`;
  }

  static validateIcons() {
    for (const manager of MHLSettingsManager.managers) {
      manager.#validateIcons();
    }
  }

  #validateIcons() {
    //logging for failure happens in the getIcon* functions
    for (const setting of this.#settings) {
      if (setting.menu && "icon" in setting) {
        setting.icon = getIconClasses(setting.icon) ?? CONFIG.MHL.fallbackIcon;
      }
      if ("button" in setting && "icon" in setting.button) {
        setting.button.icon = getIconHTMLString(setting.button.icon);
      }
    }
    if (typeof this.#options.groups.accordionIndicator === "string") {
      this.#options.groups.accordionIndicator = getIconClasses(this.#options.groups.accordionIndicator);
    }
    if (!isEmpty(this.#options.groups?.overrides)) {
      const or = this.#options.groups.overrides;
      for (const group in or) {
        if (typeof or[group]?.accordionIndicator === "string") {
          or[group].accordionIndicator = getIconClasses(or[group].accordionIndicator);
        }
      }
    }
  }

  #validateEnrichHintsOption() {
    const func = `${funcPrefix}##validateEnrichHintsOption`;
    let enrichers = deeperClone(this.#options.enrichHints);
    const badEnrichers = () => {
      this.#log(
        { enrichHints: this.#options.enrichHints },
        { func, prefix: `MHL.SettingsManager.Error.InvalidEnrichHintsOption` }
      );
      return false;
    };
    if (typeof enrichers === "boolean") return true;
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

  #processGroupsOption() {
    const func = `${funcPrefix}##processGroupsOption`;
    const groups = deeperClone(this.#options.groups);
    const defaults = deeperClone(this.defaultOptions.groups);
    //todo: see if you can actually handle this as a data model in a way you like
    const overrideValidation = {
      accordionIndicator: (v) => ["boolean", "string"].includes(typeof v),
      animated: (v) => typeof v === "boolean",
      collapsible: (v) => typeof v === "boolean",
      classes: (v) => Array.isArray(v) && v.every((e) => typeof e === "string"),
    };
    const validation = {
      accordionIndicator: (v) => ["boolean", "string"].includes(typeof v),
      animated: (v) => typeof v === "boolean",
      collapsible: (v) => typeof v === "boolean",
      sort: (v) => typeof v === "function" || (Array.isArray(v) && v.every((e) => typeof e === "string")),
      classes: (v) => Array.isArray(v) && v.every((e) => typeof e === "string"),
      overrides: (v) => isPlainObject(v),
    };
    if (!groups) return groups;
    if (groups === true) return defaults;
    if (groups === "a") {
      defaults.sort = localeSort;
      return defaults;
    }
    if (isPlainObject(groups)) {
      //if all the provided keys are default, just use defaults
      if (Object.entries(groups).every(([key, value]) => value === defaults[key])) return defaults;
      const invalidKeys = getInvalidKeys(groups, defaults);
      if (invalidKeys.length) this.#logInvalidOptionKeys(invalidKeys, "groups", func);
      const out = filterObject(groups, defaults, { recursive: false });
      for (const key in out) {
        if (!validation[key](out[key])) {
          this.#logInvalidOptionValue(key, out[key], defaults[key], "groups", func);
          out[key] = defaults[key];
        }
        //special handling
        if (Array.isArray(out.sort)) {
          out.sort = generateSorterFromOrder(out.sort);
        }
      }
      if (!isEmpty(out.overrides)) {
        const validOverrides = {};
        for (const group in out.overrides) {
          const expanded = this.#expandPartialGroupName(group);
          const invalidKeys = getInvalidKeys(out.overrides[group], overrideValidation);
          if (invalidKeys.length) this.#logInvalidOptionKeys(invalidKeys, `group.overrides["${group}"]`, func);
          const groupOut = filterObject(out.overrides[group], overrideValidation);
          for (const overrideKey in groupOut) {
            if (!overrideValidation[overrideKey](groupOut[overrideKey])) {
              this.#log(
                { key: overrideKey, value: groupOut[overrideKey] },
                {
                  softType: "warn",
                  func,
                  prefix: "MHL.SettingsManager.Error.InvalidGroupOverrideOptionValue",
                  context: { group, key: overrideKey },
                }
              );
              delete groupOut[overrideKey];
            }
          }
          if (Object.keys(groupOut).length > 0) validOverrides[expanded] = groupOut;
        }
        out.overrides = validOverrides;
      }
      // at least one valid key was passed, use defaults for rest
      if (Object.keys(out).length > 0) return fu.mergeObject(defaults, out, { inplace: false });
    }
    this.#logInvalidOptionData(groups, "groups", func);
    return defaults;
  }

  #validateRegistrationData(data) {
    const func = `${funcPrefix}##validateRegistrationData`;
    if (typeof data === "function") data = data();
    //todo: figure out why isEmpty chokes when this is a Collection
    const registerable = new Map();
    if (Array.isArray(data)) {
      for (const setting of data) {
        if (!isPlainObject(setting) || typeof setting.key !== "string") {
          this.#log({ setting }, { type: "error", func, prefix: `MHL.SettingsManager.Error.InvalidSettingArrayEntry` });
          continue;
        }
        registerable.set(setting.key, setting);
      }
    }
    const entries = isPlainObject(data) ? Object.entries(data) : data instanceof Map ? [...data.entries()] : [];
    for (const [key, value] of entries) {
      if (!this.#validateSettingKey(key)) continue;
      if (registerable.has(key)) {
        this.#log("MHL.SettingsManager.Error.DuplicateSettingKey", {
          type: "error",
          func,
          context: { key },
        });
        continue;
      }
      registerable.set(key, value);
    }
    if (isEmpty(registerable)) {
      this.#log(
        { data },
        {
          type: "error",
          prefix: `MHL.SettingsManager.Error.NoValidSettings`,
          func,
        }
      );
      return false;
    }
    return registerable;
  }

  #processResetButtonsOption() {
    const func = `${funcPrefix}##processResetButtonsOption`;
    const defaults = deeperClone(this.defaultOptions.resetButtons);
    let rb = deeperClone(this.#options.resetButtons);
    //no reset buttons
    if (rb === false) return defaults;
    // all reset buttons, use icons from manager-defaults setting
    if (rb === true) return Object.fromEntries(Object.entries(defaults).map((e) => [e[0], true]));
    // arrays get transformed but then validated as objects
    if (Array.isArray(rb) && rb.every((s) => typeof s === "string"))
      rb = rb.reduce((acc, curr) => {
        acc[curr] = true;
        return acc;
      }, {});
    if (isPlainObject(rb)) {
      //if all the provided keys are default, just use defaults
      if (Object.entries(rb).every(([key, value]) => value === defaults[key])) return defaults;
      const invalidKeys = getInvalidKeys(rb, defaults);
      if (invalidKeys.length) this.#logInvalidOptionKeys(invalidKeys, "resetButtons", func);
      const out = filterObject(rb, defaults);
      for (const key in out) {
        // each key for this option shares the same validation criteria
        if (!["boolean", "string"].includes(typeof out[key])) {
          this.#logInvalidOptionValue(key, out[key], defaults[key], "sort", func);
          out[key] = defaults[key];
        }
      }
      if (Object.keys(out).length > 0) {
        out.disabledClass ??= true;
        return out;
      }
    }
    this.#logInvalidOptionData(rb, "resetButtons", func);
    return defaults;
  }

  #validateSettingKey(key) {
    if (typeof key !== "string") {
      this.#log("MHL.SettingsManager.Error.InvalidSettingKey", {
        type: "error",
        func,
        context: { key },
      });
      return false;
    }
    return true;
  }

  #processSortOption() {
    const func = `${funcPrefix}##processSortOption`;
    const sort = deeperClone(this.#options.sort);
    const defaults = deeperClone(this.defaultOptions.sort);
    const validation = {
      fn: (v) => typeof v === "function",
      menusFirst: (v) => typeof v === "boolean",
    };
    // no sorting beyond core's
    if (sort === false) return defaults;
    // no sorting at all, not even rendering menus first like core
    if (sort === null) return { menusFirst: false, fn: nullSort };
    // alphasort, menus first like core
    if (sort === true || sort === "a") return { menusFirst: true, fn: localeSort };
    // custom sort, but menus first like core
    if (typeof sort === "function") return { menusFirst: true, fn: sort };
    if (isPlainObject(sort)) {
      //if all the provided keys are default, just use defaults
      if (Object.entries(sort).every(([key, value]) => value === defaults[key])) return defaults;
      const invalidKeys = getInvalidKeys(sort, defaults);
      if (invalidKeys.length) this.#logInvalidOptionKeys(invalidKeys, "sort", func);
      const out = filterObject(sort, defaults);
      for (const key in out) {
        // test each key against its validator
        if (!validation[key](out[key])) {
          this.#logInvalidOptionValue(key, out[key], defaults[key], "sort", func);
          out[key] = defaults[key];
        }
      }
      // at least one valid key was passed, use defaults for rest
      if (Object.keys(out).length > 0) return fu.mergeObject(defaults, out, { inplace: false });
    }
    this.#logInvalidOptionData(sort, "sort", func);
    return defaults;
  }

  #error(errorstr, options = {}) {
    const opts = fu.mergeObject(
      options,
      {
        mod: this.#options.modPrefix,
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
        mod: this.#options.modPrefix,
        context: {
          module: this.#module.title,
        },
      },
      { inplace: false }
    );
    modLog(loggable, opts);
  }

  #requireSetting(key, { func = null, potential = false, errorstr = null, context = {} } = {}) {
    errorstr ??= `MHL.SettingsManager.Error.NotRegistered`;
    if (!this.has(key, { potential })) {
      this.#log(
        { key },
        {
          type: "error",
          context: { key, ...context },
          prefix: errorstr,
          func,
        }
      );
      return false;
    }
    return true;
  }

  #logCastString(variable, name, func) {
    return logCastString(variable, name, { func, mod: this.#options.modPrefix });
  }

  #logInvalidOptionData(data, option, func) {
    this.#log(
      { [option]: data },
      { softType: "error", func, prefix: `MHL.SettingsManager.Error.InvalidOptionData`, context: { option } }
    );
  }

  #logInvalidOptionValue(key, value, def, option, func) {
    this.#log(
      { key, value, default: def },
      {
        softType: "warn",
        prefix: "MHL.SettingsManager.Error.InvalidOptionValue",
        context: { key, option, default: def },
        func,
      }
    );
  }

  #logInvalidOptionKeys(keys, option, func) {
    this.#log(
      { keys },
      {
        softType: "warn",
        prefix: `MHL.SettingsManager.Error.InvalidOptionKeys`,
        context: { keys: keys.join(", "), option },
        func,
      }
    );
  }
}
