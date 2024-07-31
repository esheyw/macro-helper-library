import { createHTMLElement } from "../helpers/DOMHelpers.mjs";

export class SlideToggleElement extends foundry.applications.elements.AbstractFormInputElement {
  #track;
  #thumb;
  static tagName = "mhl-slide-toggle";

  constructor() {
    super();
    this._internals.role = "switch";
    this._internals.ariaChecked = String(!!this.hasAttribute("checked"));
  }

  /**
   * Whether the slide toggle is toggled on.
   * @type {boolean}
   */
  get checked() {
    return this.hasAttribute("checked");
  }

  set checked(value) {
    //todo localize error
    if (typeof value !== "boolean") throw new Error("Slide toggle checked state must be a boolean.");
    this.toggleAttribute("checked", value);
    this._internals.ariaChecked = String(value);
  }

  /**
   * Masquerade as a checkbox input.
   * @type {string}
   */
  get type() {
    return "checkbox";
  }

  /**
   * Create the constituent components of this element.
   * @returns {HTMLElement[]}
   * @protected
   */
  _buildElements() {
    this.#thumb = createHTMLElement("div", { classes: ["mhl-slide-toggle-thumb"] });
    this.#track = createHTMLElement("div", {
      classes: ["mhl-slide-toggle-track"],
      children: [this.#thumb],
    });
    this.#track.setAttribute("tabindex", 0);
    return [this.#track];
  }

  _activateListeners() {
    this.#track.addEventListener("keydown", this.#onKeyDown.bind(this));
  }
  _onClick(event) {
    this.checked = !this.checked;
    this.dispatchEvent(new Event("change"));
    if (event.currentTarget === this) this.#track.focus();
  }

  #onKeyDown(event) {
    if (event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    this._onClick(event);
  }
}
