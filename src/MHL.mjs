import { MODULE_ID } from "./constants.mjs";
import { SETTINGS } from "./settings/settings.mjs";
import { MHLSettingsManager2 } from "./util/MHLSettingsManager2.mjs";

export class MHL {
  static #instance;

  /**
   * The singleton MHL instance
   *
   * @static
   * @readonly
   * @type {MHL|undefined}
   */
  static get instance() {
    return this.#instance;
  }

  /**
   * The singleton MHL instance
   *
   * @readonly
   * @type {MHL|undefined}
   */
  get instance() {
    return MHL.#instance;
  }

  #sm;
  #settingManagers = new Collection();

  /**
   * The Collection of all settings managers
   *
   * @type {Collection<string, MHLSettingsManager2}
   */
  get settingsManagers() {
    return this.#settingManagers;
  }

  constructor() {
    if (this.instance instanceof MHL) return this.instance;
    MHL.#instance = this;
    const managerOptions = {
      settingPrefix: "MHL.Setting",
      resetButtons: true,
      groups: {
        collapsible: false,
      },
      settings: SETTINGS,
      clean: true,
    };
    this.#sm = new MHLSettingsManager2(MODULE_ID, managerOptions);
    this.#settingManagers.set(MODULE_ID, this.#sm);
  }

  #onSetup() {}
  #onReady() {}

  toggleLegacyAccess(value) {
    const existing = "pf2emhl" in game;
  }

  
}
