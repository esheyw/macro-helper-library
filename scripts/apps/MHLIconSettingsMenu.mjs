import { MODULE_ID, fu } from "../constants.mjs";
import { htmlClosest, htmlQuery, htmlQueryAll } from "../helpers/HTMLHelpers.mjs";
import { mhlog } from "../helpers/errorHelpers.mjs";
import { getIconClasses, getIconHTMLString } from "../helpers/iconHelpers.mjs";
export class MHLIconSettingsMenu extends FormApplication {
  settingName = "icon-settings";
  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      title: "MHL Icon Glyph Settings",
      template: `modules/${MODULE_ID}/templates/IconSettingsMenu.hbs`,
      classes: ["mhl-icon-settings-menu"],
      width: 450,
      resizable: true,
    });
  }

  static iconChangeListener(ev) {
    const node = ev.currentTarget || ev.target;
    const form = htmlClosest(node, "form");
    const displayDiv = htmlQuery(form, `[data-icon-for="${node.id}"]`);
    const newIcon = getIconHTMLString(node.value);
    displayDiv.innerHTML = newIcon;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0];
    const inputs = htmlQueryAll(el, "input").filter((n) => "icon" in n.dataset);

    for (const input of inputs) {
      input.addEventListener("input", fu.debounce(MHLIconSettingsMenu.iconChangeListener, 300));
    }
  }
  getData(options = {}) {
    const context = super.getData(options);
    context.key = "icon-settings";
    context.module = MODULE_ID;
    context.model = game.settings.get(MODULE_ID, this.settingName).clone();
    context.v12 = fu.isNewerVersion(game.version, 12);
    return context;
  }
  _updateObject(event, formData) {
    const expanded = fu.expandObject(formData);
    // .reduce((acc, [k, v]) => {
    //   if (String(k).includes("Icon") && !getIconHTMLString(v)) return acc;
    //   acc[k] = v;
    //   return acc;
    // }, {});
    //todo: remove logging
    mhlog(
      { event, formData, expanded },
      {
        prefix: "before",
        func: `_updateObject`,
        dupe: true,
      }
    );

    for (const [k, v] of Object.entries(expanded)) {
      if (k.includes("Icon") && !getIconClasses(v, { fallback: false })) delete expanded[k];
    }

    game.settings.set(MODULE_ID, this.settingName, expanded);
  }
}
