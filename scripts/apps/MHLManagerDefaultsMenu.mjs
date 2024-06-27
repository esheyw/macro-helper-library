import { MODULE_ID, fu } from "../constants.mjs";
import { htmlClosest, htmlQuery, htmlQueryAll } from "../helpers/DOMHelpers.mjs";
import { mhlog } from "../helpers/errorHelpers.mjs";
import { getIconClasses, getIconHTMLString } from "../helpers/iconHelpers.mjs";
import { MODULE } from "../init.mjs";
export class MHLManagerDefaultsMenu extends FormApplication {
  settingName = "manager-defaults";
  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      title: "MHL Icon Glyph Settings",
      template: `modules/${MODULE_ID}/templates/ManagerDefaultsMenu.hbs`,
      classes: ["mhl-manager-defaults-menu"],
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
      input.addEventListener("input", fu.debounce(MHLManagerDefaultsMenu.iconChangeListener, 300));
    }
    const cancelButton = htmlQuery(el, 'button[name=cancel]')
    cancelButton.addEventListener('click', this.close.bind(this));
  }
  getData(options = {}) {
    const context = super.getData(options);
    context.key = "manager-defaults";
    context.module = MODULE_ID;
    context.model = game.settings.get(MODULE_ID, this.settingName).clone();
    context.v12 = fu.isNewerVersion(game.version, 12);
    return context;
  }
  async _updateObject(event, formData) {
    const expanded = fu.expandObject(formData);   
    //only save valid icons
    for (const [k, v] of Object.entries(expanded)) {
      if (k.includes("Icon") && !getIconClasses(v, { fallback: false })) delete expanded[k];
    }    
    await SM().set(this.settingName, expanded);
    SM().app?.render();
  }
}
