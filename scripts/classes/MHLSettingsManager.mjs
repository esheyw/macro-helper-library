import { MODULE_ID, fu } from "../constants.mjs";
import { htmlClosest, htmlQuery, htmlQueryAll } from "../helpers/DOMHelpers.mjs";
import { MHLError, isEmpty, mhlog, modBanner, modLog } from "../helpers/errorHelpers.mjs";
import { isRealGM } from "../helpers/otherHelpers.mjs";
import { localize, getIconString, sluggify } from "../helpers/stringHelpers.mjs";
import { MHLDialog } from "./MHLDialog.mjs";
import { getSetting } from "../settings.mjs";
import { MODULE } from "../init.mjs";
import { DetailsAccordion } from "./DetailsAccordion.mjs";
const PREFIX = `MHL.SettingsManager`;
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
  #potentialSettings = new Set();
  #resetListeners = new Collection([
    ["all", null],
    ["groups", new Collection()],
    ["settings", new Collection()],
  ]);
  #settings = new Collection();
  #visibilityListeners = new Map();

  constructor(module, options = {}) {
    const func = `${funcPrefix}#constructor`;
    this.#module = module instanceof Module ? module : game.modules.get(module);
    if (!this.#module) throw MHLError(`${PREFIX}.Error.BadModuleID`, { log: { mod }, func: funcPrefix });

    const MHL = MODULE().api;
    if ("settingsManagers" in MHL) MHL.settingsManagers.set(this.#module.id, this);

    this.options = fu.mergeObject(this.defaultOptions, options);
    const mod = this.options.modPrefix;
    if (this.options.groups && Array.isArray(this.options.groups)) {
      for (const group of this.options.groups) {
        if (typeof group !== "string") {
          modLog(
            { group },
            { mod: this.options.modPrefix, type: "error", func, localize: true, prefix: `${PREFIX}.Error.InvalidGroup` }
          );
          continue;
        }
        this.#groupOrder.add(group);
      }
    }
    //validate sort
    if (this.options.sort && !(this.options.sort === "a" || typeof this.options.sort === "function")) {
      modLog(
        { sort: options.sort },
        { mod, type: "error", func, localize: true, prefix: `${PREFIX}.Error.InvalidSort` }
      );
      this.options.sort = null;
    }
    //validate resetButtons
    let resetButtons = this.options.resetButtons;
    if (resetButtons && resetButtons !== true) {
      if (!Array.isArray(resetButtons)) resetButtons = [resetButtons];
      if (!resetButtons.every((e) => ["all", "settings", "groups", "module"].includes(e))) {
        modLog(
          { resetButtons: options.resetButtons },
          { mod, type: "error", func, localize: true, prefix: `${PREFIX}.Error.InvalidResetButttons` }
        );
        this.options.resetButtons = false;
      }
    }
    //simplify resetButtons option retrieval
    if (this.options.resetButtons === true || this.options.resetButtons?.includes("all")) {
      this.options.resetButtons = ["settings", "groups", "module"];
    }

    if (this.options.enrichHints && this.options.enrichHints !== true) {
      this.#processEnricherData(this.options.enrichHints);
    }

    if (options?.settings) this.registerSettings(settings);
    Hooks.on("renderSettingsConfig", this.#onRenderSettings.bind(this));
    this.#initialized = true;
  }

  get initialized() {
    return this.#initialized;
  }

  get element() {
    const settingsWindow = Object.values(ui.windows).find((w) => w.id === "client-settings");
    if (!settingsWindow) return;
    return settingsWindow.element instanceof jQuery ? settingsWindow.element[0] : settingsWindow.element;
  }

  get defaultOptions() {
    const prefix = sluggify(this.#module.title, { camel: "bactrian" });
    return {
      actionButtons: true, // process settings with button data into clickable buttons instead of their regular type
      choiceInfix: "Choice", // localization key section placed between setting name and choice value when inferring choice localization
      collapsableGroups: true, // whether groups should be inline (false) or shoved into <details> (true, default)
      colorPickers: true, // add color picker elements to settings whose default value is a hex color code
      disabledClass: null, // css class toggled on reset buttons when the setting in question is already its default value, if null uses module setting
      enrichHints: true, // pass hints through enrichers or not
      groupInfix: "Group", // localization key suffix appended to the settingPrefix for group names
      groups: true, // handle setting grouping. if true, uses insertion order, use an array to specify an order.
      modPrefix: prefix.replace(/[a-z]/g, ""), // prefix for logged errors/warnings
      resetButtons: true, // add  reset-to-default buttons on each setting and for the whole module in its header
      settingPrefix: prefix + ".Setting", //String to start inferred localization keys with
      sort: null, // handle sorting of settings. "a" for alphabetical on name, or a custom compare function.
      visibility: true, // process settings with visibility data, only showing them in the settings window conditionally on the value of another setting
    };
  }

  #onRenderSettings(app, html, data) {
    const func = `${funcPrefix}#onRenderSettings`;
    html = html instanceof jQuery ? html[0] : html;
    //bail if this module has no configurable settings (either available to this user, or at all)
    const configurable = this.#settings.filter((s) => s?.config);
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
    //todo: migrate to per-section functions?
    for (const div of settingDivs) {
      const settingData = game.settings.settings.get(div.dataset.settingId);

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

  #applyGroupsAndSort(section) {
    const func = `${funcPrefix}#applyGroupsAndSort`;
    const isGM = isRealGM(game.user);
    const existingNodes = Array.from(section.children);
    const sortOrder = [existingNodes.shift()]; // add the h2 in first
    if (this.options.groups) {
      if (this.options.groups === "a") {
        this.#groupOrder = new Set([
          ...[...this.#groupOrder].toSorted((a, b) => localize(a).localeCompare(localize(b))),
        ]);
      }
      const groupOrder = [null, ...this.#groupOrder];
      for (const group of groupOrder) {
        let groupContentDiv;
        const settings = this.#settings
          .filter((s) => s.group === group && s?.config && (s?.scope === "world" ? isGM : true))
          .map((s) => ({
            node: existingNodes.find((n) => n.dataset?.settingId?.includes(s.key)),
            name: localize(s.name),
            id: s.key,
          }));
        if (group !== null) {
          if (settings.length === 0) continue; // no headers for empty groups
          if (this.options.collapsableGroups) {
            const details = document.createElement("details");
            details.dataset.settingGroup = group;
            details.open = true;
            details.innerHTML = `<summary><h3 data-setting-group="${group}">${localize(
              group
            )} </h3></summary><div class="accordion-content"></div>`;
            groupContentDiv = htmlQuery(details, `div.accordion-content`);
            new DetailsAccordion(details);
            sortOrder.push(details);
          } else {
            const groupHeader = document.createElement("h3");
            groupHeader.innerText = localize(group);
            groupHeader.dataset.settingGroup = group;
            sortOrder.push(groupHeader);
          }
        }

        if (this.options.sort) {
          if (this.options.sort === "a") {
            settings.sort((a, b) => a.name.localeCompare(b.name));
          } else {
            settings.sort(this.options.sort);
          }
        }
        for (const setting of settings) {
          if (group !== null) setting.node.dataset.settingGroup = group;
          if (groupContentDiv) {
            groupContentDiv.appendChild(setting.node);
          } else {
            sortOrder.push(setting.node);
          }
        }
      }
      if (this.options.collapsableGroups) {
        const [h2, ...targets] = sortOrder;
        h2.addEventListener("click", () => {
          const details = targets.filter((n) => n.nodeName === "DETAILS");
          const [closed, open] = details.partition((d) => d.open);
          for (const target of details) {
            const h3 = htmlQuery(target, "h3");
            if (open.length === 0 || closed.length === 0 || target.open) h3.dispatchEvent(new Event("click"));
          }
        });
      }
    } else if (this.options.sort) {
      const settings = this.#settings
        .filter((s) => s?.config && (s?.scope === "world" ? isGM : true))
        .map((s) => ({
          node: existingNodes.find((n) => n.dataset?.settingId?.includes(s.key)),
          name: localize(s.name),
          id: s.key,
        }));

      if (this.options.sort === "a") {
        settings.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        settings.sort(this.options.sort);
      }
      for (const setting of settings) {
        sortOrder.push(setting.node);
      }
    } else {
      //no sorting to be done
      return;
    }
    //do the reorg
    for (const node of sortOrder) {
      section.appendChild(node);
    }
  }

  get(key) {
    const func = `${funcPrefix}#get`;
    if (game?.user) {
      if (game.settings.settings.get(`${this.#module.id}.${key}`) === undefined) {
        modLog(`${PREFIX}.Error.NotRegistered`, {
          type: "error",
          mod: this.options.modPrefix,
          context: { setting: key, module: this.#module.title },
          localize: true,
          func,
        });
        return undefined;
      } else {
        const value = game.settings.get(this.#module.id, key);
        return value;
      }
    }
    return undefined;
  }

  async set(setting, value) {
    const func = `${funcPrefix}#set`;
    if (!this.#requireSetting(setting, func)) return undefined;
    return game.settings.set(this.#module.id, setting, value);
  }

  async reset(settings) {
    const func = `${funcPrefix}#reset`;
    if (!Array.isArray(settings)) settings = [settings];
    const sets = [];
    for (const setting of settings) {
      if (!this.#requireSetting(setting, func)) continue;
      const data = this.#settings.get(setting);
      if (!("default" in data)) continue;
      sets.push(this.set(setting, data.default));
      if (this.element && data?.config) {
        const div = htmlQuery(this.element, `div[data-setting-id="${this.#module.id}.${setting}"]`);
        if (!div) return;
        this.#setInputValues(div, data.default);
      }
    }
    return Promise.all(sets);
  }

  async resetAll() {
    return this.reset(Array.from(this.#settings.keys()));
  }

  registerSettings(data) {
    const func = `${funcPrefix}#registerSettings`;
    const settings =
      data instanceof Map
        ? [...data.entries()]
        : Array.isArray(data)
        ? data.reduce((acc, setting) => {
            if ("id" in setting && typeof setting.id === "string") {
              const { id, ...rest } = setting;
              acc.push([id, rest]);
            }
            return acc;
          }, [])
        : typeof data === "object"
        ? Object.entries(data)
        : null;

    if (!settings) {
      modLog(`${PREFIX}.Error.NoValidSettings`, {
        type: "error",
        mod: this.options.modPrefix,
        context: { module: this.#module.title },
        localize: true,
        func,
      });
      return false;
    }
    //have all potential keys available to predicate visibility upon
    this.#potentialSettings = new Set([...settings.map(([key, _]) => key)]);

    for (const [setting, data] of settings) {
      const success = this.registerSetting(setting, data, { initial: true });
      if (!success) {
        modLog(
          { setting, data, module: this.#module.id },
          {
            localize: true,
            mod: this.options.modPrefix,
            prefix: `${PREFIX}.Error.InvalidSettingData`,
            func,
            context: { setting, module: this.#module.id },
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

  registerSetting(setting, data, { initial = false } = {}) {
    const func = `${funcPrefix}#registerSetting`;
    if (!this.#potentialSettings.has(setting)) this.#potentialSettings.add(setting);
    if (game.settings.settings.get(`${this.#module.id}.${setting}`)) {
      modLog(`${PREFIX}.Error.DuplicateSetting`, {
        type: "error",
        localize: true,
        mod: this.options.modPrefix,
        context: { setting, module: this.#module.title },
        func,
      });
      return false;
    }

    data = this.#processSettingData(setting, data);
    if (!data) return false;

    //actually register the setting finally
    this.#register(setting, data);
    // only update hooks if we're not inside a registerSettings call
    if (!initial) this.#updateHooks(setting);
    this.#potentialSettings.delete(setting);
    return true;
  }

  #processSettingData(setting, data) {
    const func = `${funcPrefix}#processSettingData`;
    //add the key to the data because Collection's helpers only operate on vaalues
    data.key = setting;
    //handle registering settings menus
    if ("type" in data && "label" in data && data.type.prototype instanceof FormApplication) {
      if ("icon" in data) {
        data.icon = getIconString(data.icon, { classesOnly: true });
      }
      data.menu = true;
    }

    // if name, hint, or a choice or menu label is passed as null, infer the desired translation key
    data = this.#processNullLabels(setting, data);

    //validate button settings
    if ("button" in data) {
      data.button = this.#processButtonData(setting, data.button);
      // since buttons replace whole settings, if validation fails, don't create a useless text input
      if (!data.button) return false;
    }

    //only allow colour pickers for settings with a valid colour hex code as default value
    if ("colorPicker" in data) {
      const regex = new RegExp(this.#colorPattern);
      if (!regex.test(data?.default ?? "")) {
        modLog(
          { setting, data },
          { prefix: `${PREFIX}.Error.InvalidColorPicker`, func, localize: true, mod: this.options.modPrefix }
        );
        data.colorPicker = false;
      }
    }
    //handle setting visibility dependencies
    if ("visibility" in data) {
      data.visibility = this.#processVisibilityData(setting, data.visibility);
      // if validation failed, don't make broken listeners
      if (!data.visibility) delete data.visibility;
    }

    //update hooks every time a setting is changed
    const originalOnChange = "onChange" in data ? data.onChange : null;
    data.onChange = function (value) {
      this.#updateHooks(setting);
      this.#setInputValues(setting, value);
      this.#updateResetButtons(setting);
      if (originalOnChange) originalOnChange(value);
    }.bind(this);

    //handle setting-conditional hooks, has to happen after registration or the error handling in setHooks gets gross
    if ("hooks" in data) {
      data.hooks = this.#processHooksData(setting, data.hooks);
      if (!data.hooks) delete data.hooks;
    }
    //handle groups, make sure data.group always exists
    if ("group" in data) {
      if (typeof data.group === "string") {
        if (data.group.startsWith("."))
          data.group = `${this.options.settingPrefix}${this.options.groupInfix}${data.group}`;
        this.#groupOrder.add(data.group);
      } else {
        modLog(
          { group: data.group, setting },
          { type: "error", mod: this.options.modPrefix, func, localize: true, prefix: `${PREFIX}.Error.InvalidGroup` }
        );
        data.group = null;
      }
    }
    data.group ??= null;

    return data;
  }

  #register(setting, data) {
    if (data.menu) {
      game.settings.registerMenu(this.#module.id, setting, data);
    } else {
      game.settings.register(this.#module.id, setting, data);
      this.#settings.set(setting, data);
    }
  }

  #processEnricherData(enrichers) {
    const func = `${funcPrefix}#processEnricherData`;
    const badEnrichers = () =>
      modLog(
        { enrichers },
        { func, localize: true, mod: this.options.modPrefix, prefix: `${PREFIX}.Error.InvalidEnrichers` }
      );
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
  }

  #processNullLabels(setting, data) {
    if ("name" in data && data.name === null) {
      data.name = [this.options.settingPrefix, sluggify(setting, { camel: "bactrian" }), "Name"].join(".");
    }
    if ("hint" in data && data.hint === null) {
      data.hint = [this.options.settingPrefix, sluggify(setting, { camel: "bactrian" }), "Hint"].join(".");
    }
    if ("choices" in data) {
      for (const [choiceValue, choiceLabel] of Object.entries(data.choices)) {
        if (choiceLabel === null) {
          data.choices[choiceValue] = [
            this.options.settingPrefix,
            sluggify(setting, { camel: "bactrian" }),
            this.options.choiceInfix,
            sluggify(choiceValue, { camel: "bactrian" }),
          ].join(".");
        }
      }
    }
    if ("label" in data && data.label === null) {
      data.label = [this.options.settingPrefix, sluggify(setting, { camel: "bactrian" }), "Label"].join(".");
    }
    return data;
  }

  //mostly type and format checking, also icon processing
  #processButtonData(setting, buttonData) {
    const func = `${funcPrefix}#processButtonData`;
    if (typeof buttonData !== "object" || !("action" in buttonData) || typeof buttonData.action !== "function") {
      modLog(
        { setting, buttonData, module: this.#module.id },
        { mod: this.options.modPrefix, localize: true, prefix: `${PREFIX}.Error.Button.BadFormat`, func }
      );
      return false;
    }

    if (!("label" in buttonData) || buttonData.label === null) {
      buttonData.label = [this.options.settingPrefix, sluggify(setting, { camel: "bactrian" }), "Label"].join(".");
    }
    buttonData.label = String(buttonData.label);

    if ("icon" in buttonData) {
      buttonData.icon = getIconString(buttonData.icon);
    }
    return buttonData;
  }

  #processVisibilityString(setting, dependsOn) {
    const func = `${funcPrefix}#processVisibilityString`;
    const data = { setting, dependsOn, module: this.#module.title };
    const invert = dependsOn.at(0) === "!";
    dependsOn = invert ? dependsOn.slice(1) : dependsOn;
    if (!this.#settings.has(dependsOn) && !this.#potentialSettings.has(dependsOn)) {
      modLog(data, {
        type: "error",
        func,
        localize: true,
        mod: this.options.modPrefix,
        prefix: `${PREFIX}.Error.Visibility.UnknownDependency`,
        context: data,
      });
      return false;
    }
    return { [dependsOn]: !invert };
  }

  #processVisibilityData(setting, visibilityData) {
    const func = `${funcPrefix}#processVisibilityData`;
    const data = { setting, visibilityData, module: this.#module.title };
    let test;
    const dependsOn = {};
    if (typeof visibilityData === "string") {
      const processed = this.#processVisibilityString(setting, visibilityData);
      if (!processed) return false;
      fu.mergeObject(dependsOn, processed);
    } else if (Array.isArray(visibilityData)) {
      for (const dependency of visibilityData) {
        const processed = this.#processVisibilityString(setting, dependency);
        if (!processed) continue;
        fu.mergeObject(dependsOn, processed);
      }
      if (isEmpty(dependsOn)) return false;
    } else if (typeof visibilityData === "object") {
      const dependsOnError = () =>
        modLog(data, {
          type: "error",
          mod: this.options.modPrefix,
          func,
          context: data,
          localize: true,
          prefix: `${PREFIX}.Error.Visibility.RequireDependsOn`,
        });

      if (!("test" in visibilityData) || typeof visibilityData.test !== "function") {
        modLog(data, {
          type: "error",
          mod: this.options.modPrefix,
          func,
          context: data,
          localize: true,
          prefix: `${PREFIX}.Error.Visibility.RequireTest`,
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
        const processed = this.#processVisibilityString(setting, dependency);
        if (!processed) continue;
        fu.mergeObject(dependsOn, processed);
      }
      if (isEmpty(dependsOn)) return false;
    }
    return { dependsOn, test };
  }

  #processHooksData(setting, hooksData) {
    const func = `${funcPrefix}#processHooksData`;
    const goodHooks = [];
    if (!Array.isArray(hooksData)) hooksData = [hooksData];
    for (const hookData of hooksData) {
      let invalid = false;
      let errorstr = "";
      if (typeof hookData !== "object" || ("hook" in hookData && typeof hookData.hook !== "string")) {
        errorstr = `${PREFIX}.Error.Hooks.BadHook`;
        invalid = true;
      }
      if (!invalid && "action" in hookData && typeof hookData.action !== "function") {
        errorstr = `${PREFIX}.Error.Hooks.RequiresAction`;
        invalid = true;
      }
      if (!invalid && "test" in hookData && typeof hookData.test !== "function") {
        errorstr = `${PREFIX}.Error.Hooks.TestFunction`;
        invalid = true;
      }
      if (invalid) {
        modLog(
          { setting, hookData, module: this.#module },
          {
            type: "error",
            mod: this.options.modPrefix,
            localize: true,
            prefix: errorstr,
            context: { setting, hook: hookData?.hook, module: this.#module.title },
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

  setHooks(setting, hooks) {
    const func = `${funcPrefix}#setHooks`;
    if (!this.#requireSetting(setting, func)) return undefined;
    const hooksData = this.#processHooksData(hooks);
    if (!hooksData) return false;
    const data = this.#settings.get(setting);
    data.hooks ??= [];
    data.hooks.push(...hooksData);
    this.#settings.set(setting, data);
    this.#updateHooks();
    return hooksData.length;
  }

  setButton(setting, buttonData) {
    const func = `${funcPrefix}#setButton`;
    if (!this.#requireSetting(setting, func)) return undefined;
    const fullKey = `${this.#module.id}.${setting}`;
    const savedData = game.settings.settings.get(fullKey);
    const processed = this.#processButtonData(setting, buttonData);
    if (processed) {
      savedData.button = processed;
      this.#settings.set(setting, savedData);
      game.settings.settings.set(fullKey, savedData);
      return true;
    }
    return false;
  }

  setVisibility(setting, visibilityData) {
    const func = `${funcPrefix}#setButton`;
    if (!this.#requireSetting(setting, func)) return undefined;
    const fullKey = `${this.#module.id}.${setting}`;
    const savedData = game.settings.settings.get(fullKey);
    const processed = this.#processVisibilityData(setting, visibilityData);
    if (processed) {
      savedData.visibility = processed;
      this.#settings.set(setting, savedData);
      game.settings.settings.set(fullKey, savedData);
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
    const func = `${funcPrefix}#enrichHints`;
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
    const func = `${funcPrefix}#addColorPickers`;
    const colorSettings = this.#settings.filter((s) => s?.colorPicker).map((s) => s.key);
    const divs = htmlQueryAll(section, "div[data-setting-id]").filter((div) =>
      colorSettings.includes(div.dataset.settingId.split(".")[1])
    );
    if (!divs.length) return;
    const regex = new RegExp(this.#colorPattern);
    for (const div of divs) {
      const settingName = div.dataset.settingId.split(".")[1];
      const textInput = htmlQuery(div, 'input[type="text"]');
      if (!textInput) continue;
      const colorPicker = document.createElement("input");
      colorPicker.type = "color";
      colorPicker.dataset.edit = div.dataset.settingId;
      colorPicker.value = this.get(settingName);
      colorPicker.addEventListener(
        "input",
        function (event) {
          //force a reset anchor refresh; foundry's code for updating the text field runs too slowly?
          textInput.value = event.target.value;
          if (this.options.resetButtons) this.#updateResetButtons(event);
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
          textInput.dataset.tooltip = localize(`${PREFIX}.ColorPicker.ValidHexCode`);
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
    button.innerHTML = `${data.icon} <label>${localize(data.label)}</label>`;
    button.type = "button";
    button.classList.add("mhl-setting-button");
    button.addEventListener("click", data.action);
    fieldDiv.replaceWith(button);
  }

  #updateVisibility(setting, event) {
    const func = `${funcPrefix}#updateVisibility`;
    const section = htmlClosest(event.target, "section.mhl-settings-manager");
    const div = htmlQuery(section, `div[data-setting-id$="${setting}"]`);
    const visible = div.style.display !== "none";
    const formValues = this.#getFormValues(section);
    const savedValue = this.get(setting);
    const visibilityData = this.#settings.get(setting).visibility;
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
    const func = `${funcPrefix}#addVisibilityListeners`;
    const section = htmlClosest(div, "section.mhl-settings-manager");
    const setting = div.dataset.settingId.split(".")[1];
    const dependencies = Object.keys(data.dependsOn);
    const existingListeners = this.#visibilityListeners.get(setting) ?? {};
    for (const dependency of dependencies) {
      const controlElement = htmlQuery(section, `div[data-setting-id$="${dependency}"] :is(input,select)`);
      const listener =
        existingListeners[dependency] ??
        function (event) {
          this.#updateVisibility(setting, event);
        }.bind(this);
      controlElement.addEventListener("change", listener);
      existingListeners[dependency] = listener;
    }
    this.#visibilityListeners.set(setting, existingListeners);
  }

  #addResetButtons(section) {
    const func = `${funcPrefix}#addResetButtons`;
    const opt = this.options.resetButtons;
    const isGM = isRealGM(game.user);
    if (opt.includes("module")) {
      const h2 = htmlQuery(section, "h2");
      const span = document.createElement("span");
      span.classList.add("mhl-reset-button");
      span.innerHTML = `<a data-reset-type="module" data-reset="${
        this.#module.id
      }"><i class="fa-regular fa-reply-all"></i></a>`;
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
        span.innerHTML = `<a data-reset-type="group" data-reset="${group}"><i class="fa-regular fa-reply"></i></a>`;
        const anchor = htmlQuery(span, "a");
        anchor.dataset.tooltipDirection = "UP";
        const listener = this.#onResetClick.bind(this);
        this.#resetListeners.get("groups").set(group, listener);
        anchor.addEventListener("click", listener);
        anchor.addEventListener("contextmenu", listener);
        h3.appendChild(span);
      }
    }

    const divs = htmlQueryAll(section, "div[data-setting-id]");
    for (const div of divs) {
      const setting = div.dataset.settingId.split(".")[1];
      const firstInput = htmlQuery(div, "input, select");
      const settingData = this.#settings.get(setting);
      if (!firstInput) {
        // mhlog({ div, setting }, { type: "error", prefix: "missing input?!", func });
        continue;
      }
      firstInput.addEventListener("change", this.#updateResetButtons.bind(this));
      if ("button" in settingData || !("default" in settingData)) continue;
      if (opt.includes("settings")) {
        const label = htmlQuery(div, "label");
        const textNode = Array.from(label.childNodes).find((n) => n.nodeName === "#text");
        const anchor = document.createElement("a");
        anchor.dataset.reset = setting;
        anchor.dataset.resetType = "setting";
        anchor.innerHTML = '<i class="fa-regular fa-arrow-rotate-left"></i>';
        anchor.dataset.tooltipDirection = "UP";
        const listener = this.#onResetClick.bind(this);
        this.#resetListeners.get("settings").set(setting, listener);
        anchor.addEventListener("click", listener);
        anchor.addEventListener("contextmenu", listener);
        label.insertBefore(anchor, textNode);
      }
    }
  }

  async #onResetClick(event) {
    const func = `${funcPrefix}#onResetClick`;
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
        modBanner(`${PREFIX}.Reset.FormResetBanner`, {
          type: "info",
          mod: this.options.modPrefix,
          localize: true,
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
        displaySavedValue: this.#prettifyValue("choices" in s ? localize(s.choices[savedValue]) : savedValue),
        displayDefaultValue: this.#prettifyValue("choices" in s ? localize(s.choices[defaultValue]) : defaultValue),
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
      title: localize(`${PREFIX}.Reset.DialogTitle`),
      buttons: {
        reset: {
          callback: MHLDialog.getFormData,
          icon: '<i class="fa-solid fa-check"></i>',
          label: localize("SETTINGS.Reset"),
        },
        cancel: {
          callback: () => false,
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: localize("Cancel"),
        },
      },
      content: `modules/${MODULE_ID}/templates/MHLSettingsManager-Reset.hbs`,
      contentData: {
        defaultlessCount: defaultless.length,
        defaultlessTooltip: defaultless.map((s) => localize(s.name)).join(", "),
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
    for (const [setting, checked] of Object.entries(doReset)) {
      if (!checked) continue;
      this.reset(setting);
      const resettable = dialogData.contentData.settings.find((s) => s.key === setting);
      if (!resettable || !resettable?.config) continue;
      const icon = htmlQuery(section, `a[data-reset-type="setting"][data-reset="${setting}"] i`);
      this.#updateResetButtons({ target: icon });
    }
  }

  #updateResetButtons(event = null) {
    const func = `${funcPrefix}#updateResetButtons`;
    const opt = this.options.resetButtons;
    const isGM = isRealGM(game.user);
    let section, div, setting, group;
    if (event instanceof Event) {
      section = htmlClosest(event.target, "section.mhl-settings-manager");
      div = htmlClosest(event.target, "div[data-setting-id]");
      setting = div.dataset.settingId.split(".")[1];
      group = div?.dataset?.settingGroup ?? null;
    } else if (typeof event === "string" && this.#requireSetting(event, func)) {
      if (!this.element) return;
      setting = event;
      section = htmlQuery(this.element, `section[data-category="${this.#module.id}"]`);
      div = htmlQuery(section, `div[data-setting-id$=${setting}]`);
      group = this.#settings.get(setting).group;
    }
    const allowedSettings = this.#settings.filter((s) => (s?.scope === "world" ? isGM : true));
    this.#updateSettingStats();
    const formResettables = allowedSettings.filter((s) => s.formEqualsSaved === false);
    const savedResettables = allowedSettings.filter((s) => s.isDefault === false);
    const disabledClass = this.options.disabledClass ?? getSetting("disabled-class");
    if (opt.includes("module")) {
      const anchor = htmlQuery(section, `a[data-reset-type="module"][data-reset="${this.#module.id}"]`);
      const listener = this.#resetListeners.get("all");
      let tooltip = "";
      if (savedResettables.length > 0) {
        anchor.classList.remove(disabledClass);
        tooltip = localize(`${PREFIX}.Reset.Module.SavedTooltip`, { count: savedResettables.length });
        anchor.addEventListener("click", listener);
        if (formResettables.length > 0) {
          tooltip += localize(`${PREFIX}.Reset.Module.FormTooltipAppend`, { count: formResettables.length });
        }
      } else {
        if (formResettables.length > 0) {
          anchor.classList.remove(disabledClass);
          tooltip = localize(`${PREFIX}.Reset.Module.FormTooltipSolo`, { count: formResettables.length });
          anchor.addEventListener("click", listener);
        } else {
          anchor.classList.add(disabledClass);
          tooltip = localize(`${PREFIX}.Reset.Module.AllDefaultTooltip`);
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
          tooltip = localize(`${PREFIX}.Reset.Group.SavedTooltip`, { count: groupSavedResettables.length });
          anchor.addEventListener("click", listener);
          if (groupFormResettables.length > 0) {
            tooltip += localize(`${PREFIX}.Reset.Group.FormTooltipAppend`, { count: groupFormResettables.length });
          }
        } else {
          if (groupFormResettables.length > 0) {
            anchor.classList.remove(disabledClass);
            tooltip = localize(`${PREFIX}.Reset.Group.FormTooltipSolo`, { count: groupFormResettables.length });
            anchor.addEventListener("click", listener);
          } else {
            anchor.classList.add(disabledClass);
            tooltip = localize(`${PREFIX}.Reset.Group.AllDefaultTooltip`);
            anchor.removeEventListener("click", listener);
          }
        }
        anchor.dataset.tooltip = tooltip;
      }
    }

    if (opt.includes("settings")) {
      const anchor = htmlQuery(div, `a[data-reset-type="setting"]`);
      if (!anchor) return; // defaultless inputs still have change listeners
      const listener = this.#resetListeners.get("settings").get(setting);
      const savedResettable = savedResettables.find((s) => s.key === setting);
      const formResettable = formResettables.find((s) => s.key === setting);
      let tooltip = "";
      if (savedResettable) {
        anchor.classList.remove(disabledClass);
        tooltip = localize(`${PREFIX}.Reset.Setting.SavedTooltip`);
        anchor.addEventListener("click", listener);
        if (formResettable) {
          tooltip += localize(`${PREFIX}.Reset.Setting.FormTooltipAppend`);
        }
      } else {
        if (formResettable) {
          anchor.classList.remove(disabledClass);
          tooltip = localize(`${PREFIX}.Reset.Setting.FormTooltipSolo`);
          anchor.addEventListener("click", listener);
        } else {
          anchor.classList.add(disabledClass);
          tooltip = localize(`${PREFIX}.Reset.Setting.IsDefaultTooltip`);
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
    const func = `${funcPrefix}#setInputValues`;
    if (typeof div === "string" && this.#requireSetting(div, func)) {
      const setting = this.#settings.get(div);
      if (!setting?.config || !this.element) return;
      div = htmlQuery(this.element, `div[data-setting-id="${this.#module.id}.${setting.key}"]`);
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
    const func = `${funcPrefix}#checkDefaults`;
    if (limitToSettings && !Array.isArray(limitToSettings)) limitToSettings = [limitToSettings];
    if (limitToSettings) limitToSettings = limitToSettings.filter((s) => this.#requireSetting(s));
    let formValues;
    if (this.element) {
      formValues = this.#getFormValues(htmlQuery(this.element, `section[data-category="${this.#module.id}"]`));
    }
    for (const setting of this.#settings) {
      if (limitToSettings && !limitToSettings.includes(setting)) continue;
      const savedValue = this.get(setting.key);
      setting.formEqualsSaved =
        formValues && setting.key in formValues ? this.#_equal(savedValue, formValues[setting.key]) : undefined;
      setting.isDefault = "default" in setting ? this.#_equal(setting.default, savedValue) : undefined;
    }
  }

  #isDefault(setting, value = undefined) {
    const func = `${funcPrefix}#isDefault`;
    this.#requireSetting(setting, func);
    const data = this.#settings.get(setting);
    const defaultValue = "default" in data ? data.default : undefined;
    if (defaultValue === undefined) return undefined;
    // this is to support checking if the form value = default; use the cached value if available
    value = value !== undefined ? value : data?.value !== undefined ? data.value : this.get(setting);
    const currentValue = "type" in data ? data.type(value) : value;
    return typeof currentValue === "object"
      ? isEmpty(fu.diffObject(defaultValue, currentValue))
      : defaultValue === currentValue;
  }

  #_equal(v1, v2) {
    return typeof v1 === "object" ? isEmpty(fu.diffObject(v1, v2)) : v1 === v2;
  }

  #getFormValues(section) {
    const func = `${funcPrefix}#getFormValues`;
    if (!(section instanceof HTMLElement)) {
      modLog(
        { section },
        {
          mod: this.options.modPrefix,
          func,
          localize: true,
          prefix: `${PREFIX}.Error.NotAnElement`,
          context: { variable: "section" },
        }
      );
      return false;
    }
    const divs = htmlQueryAll(section, "div[data-setting-id]");
    return divs.reduce((acc, curr) => {
      const firstInput = htmlQuery(curr, "input, select");
      if (!firstInput) return acc;
      const setting = curr.dataset.settingId.split(".")[1];
      const data = this.#settings.get(setting);
      const inputValue = this.#_value(firstInput);
      acc[setting] = "type" in data ? data.type(inputValue) : inputValue;
      return acc;
    }, {});
  }

  #prettifyValue(value) {
    return typeof value === "object" ? JSON.stringify(value, null, 2) : value;
  }

  #requireSetting(setting, func = null) {
    if (!this.#settings.has(setting)) {
      modLog(`${PREFIX}.Error.NotRegistered`, {
        type: "error",
        localize: true,
        mod: this.options.modPrefix,
        context: { setting, module: this.#module.id },
        func,
      });
      return false;
    }
    return true;
  }
}
