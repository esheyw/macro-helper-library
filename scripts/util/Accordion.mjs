//This file originally copied in its entirety from the foundry dnd5e system, under MIT license as seen at https://github.com/foundryvtt/dnd5e/blob/master/LICENSE.txt
//subsequent edits by Emmanuel Wineberg

import { logCastString, logCastNumber } from "../helpers/errorHelpers.mjs";
/**
 * @typedef {object} AccordionConfiguration
 * @property {string} headingSelector    The CSS selector that identifies accordion headers in the given markup.
 * @property {string} contentSelector    The CSS selector that identifies accordion content in the given markup. This
 *                                       can match content within the heading element, or sibling to the heading
 *                                       element, with priority given to the former.
 * @property {boolean} [collapseOthers]  Automatically collapses the other headings in this group when one heading is
 *                                       clicked.
 */

/**
 * A class responsible for augmenting markup with an accordion effect.
 * @param {AccordionConfiguration} config  Configuration options.
 */
export class Accordion {
  constructor(config) {
    const func = `Accordion#constructor`;
    const mod = config.mod ?? "MHL"    
    this.#config = {
      contentSelector:
        logCastString(config.contentSelector, "config.contentSelector", {func, mod}) + ":not(.mhl-accordion-content)",
      headingSelector: logCastString(config.headingSelector, "config.headingSelector",  {func, mod}),
      initialOpen: logCastNumber(config.initialOpen ?? Infinity, "config.initialOpen",  {func, mod}),
      collapseOthers: !!(config.collapseOthers ?? false),
    };
  }

  /**
   * Configuration options.
   * @type {AccordionConfiguration}
   */
  #config;

  /**
   * A mapping of heading elements to content elements.
   * @type {Map<HTMLElement, HTMLElement>}
   */
  #sections = new Map();

  /**
   * A mapping of heading elements to any ongoing transition effect functions.
   * @type {Map<HTMLElement, Function>}
   */
  #ongoing = new Map();

  /**
   * Record the state of collapsed sections.
   * @type {boolean[]}
   */
  #collapsed;

  /* -------------------------------------------- */

  /**
   * Augment the given markup with an accordion effect.
   * @param {HTMLElement} root  The root HTML node.
   */
  bind(root) {
    const func = `Accordion#bind`;
    const firstBind = this.#sections.size < 1;
    if (firstBind) this.#collapsed = [];
    this.#sections = new Map();
    this.#ongoing = new Map();
    const { headingSelector, contentSelector } = this.#config;
    let collapsedIndex = 0;
    for (const heading of root.querySelectorAll(headingSelector)) {
      const content = heading.querySelector(contentSelector) ?? heading.parentElement.querySelector(contentSelector);

      if (!content) continue;
      const wrapper = document.createElement("div");
      wrapper.classList.add("mhl-accordion");
      heading.before(wrapper);
      wrapper.append(heading, content);
      this.#sections.set(heading, content);
      content._fullHeight = content.getBoundingClientRect().height;
      if (firstBind) {
        this.#collapsed.push(this.#collapsed.length >= this.#config.initialOpen);
      } else if (this.#collapsed[collapsedIndex]) {
        wrapper.classList.add("collapsed");
      }
      heading.classList.add("mhl-accordion-heading");
      content.classList.add("mhl-accordion-content");
      heading.addEventListener("click", this._onClickHeading.bind(this));
      collapsedIndex++;
    }
    requestAnimationFrame(() => this._restoreCollapsedState());
  }

  /* -------------------------------------------- */

  /**
   * Handle clicking an accordion heading.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onClickHeading(event) {
    if (event.target.closest("a")) return;
    const heading = event.currentTarget;
    const content = this.#sections.get(heading);
    if (!content) return;
    event.preventDefault();
    const collapsed = heading.parentElement.classList.contains("collapsed");
    if (collapsed) this._onExpandSection(heading, content);
    else this._onCollapseSection(heading, content);
  }

  /* -------------------------------------------- */

  /**
   * Handle expanding a section.
   * @param {HTMLElement} heading             The section heading.
   * @param {HTMLElement} content             The section content.
   * @param {object} [options]
   * @param {boolean} [options.animate=true]  Whether to animate the expand effect.
   * @protected
   */
  _onExpandSection(heading, content, { animate = true } = {}) {
    this.#cancelOngoing(heading);

    if (this.#config.collapseOthers) {
      for (const [otherHeading, otherContent] of this.#sections.entries()) {
        if (heading !== otherHeading && !otherHeading.parentElement.classList.contains("collapsed")) {
          this._onCollapseSection(otherHeading, otherContent, { animate });
        }
      }
    }

    heading.parentElement.classList.remove("collapsed");
    if (animate) content.style.height = "0";
    else {
      content.style.height = `${content._fullHeight}px`;
      return;
    }
    requestAnimationFrame(() => {
      const onEnd = this._onEnd.bind(this, heading, content);
      this.#ongoing.set(heading, onEnd);
      content.addEventListener("transitionend", onEnd, { once: true });
      content.style.height = `${content._fullHeight}px`;
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle collapsing a section.
   * @param {HTMLElement} heading             The section heading.
   * @param {HTMLElement} content             The section content.
   * @param {object} [options]
   * @param {boolean} [options.animate=true]  Whether to animate the collapse effect.
   * @protected
   */
  _onCollapseSection(heading, content, { animate = true } = {}) {
    this.#cancelOngoing(heading);
    const { height } = content.getBoundingClientRect();
    heading.parentElement.classList.add("collapsed");
    content._fullHeight = height || content._fullHeight;
    if (animate) content.style.height = `${height}px`;
    else {
      content.style.height = "0";
      return;
    }
    requestAnimationFrame(() => {
      const onEnd = this._onEnd.bind(this, heading, content);
      this.#ongoing.set(heading, onEnd);
      content.addEventListener("transitionend", onEnd, { once: true });
      content.style.height = "0";
    });
  }

  /* -------------------------------------------- */

  /**
   * A function to invoke when the height transition has ended.
   * @param {HTMLElement} heading  The section heading.
   * @param {HTMLElement} content  The section content.
   * @protected
   */
  _onEnd(heading, content) {
    content.style.height = "";
    this.#ongoing.delete(heading);
  }

  /* -------------------------------------------- */

  /**
   * Cancel an ongoing effect.
   * @param {HTMLElement} heading  The section heading.
   */
  #cancelOngoing(heading) {
    const ongoing = this.#ongoing.get(heading);
    const content = this.#sections.get(heading);
    if (ongoing && content) content.removeEventListener("transitionend", ongoing);
  }

  /* -------------------------------------------- */

  /**
   * Save the accordion state.
   * @protected
   */
  _saveCollapsedState() {
    this.#collapsed = [];
    for (const heading of this.#sections.keys()) {
      this.#collapsed.push(heading.parentElement.classList.contains("collapsed"));
    }
  }

  /* -------------------------------------------- */

  /**
   * Restore the accordion state.
   * @protected
   */
  _restoreCollapsedState() {
    const entries = Array.from(this.#sections.entries());
    for (let i = 0; i < entries.length; i++) {
      const collapsed = this.#collapsed[i];
      const [heading, content] = entries[i];
      if (collapsed) this._onCollapseSection(heading, content, { animate: false });
    }
  }
}
