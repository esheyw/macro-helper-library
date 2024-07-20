/*
createHTMLElement, htmlQuery, htmlQueryAll, and htmlClosest are taken from the PF2e codebase (https://github.com/foundryvtt/pf2e), used under the Apache 2.0 License
*/

import { mhlog } from "./errorHelpers.mjs";
import { getIconClasses, getIconHTMLString } from "./iconHelpers.mjs";
import { isEmpty, isPlainObject } from "./otherHelpers.mjs";
import { hasTags } from "./stringHelpers.mjs";

/**
 * @typedef {import("../_types.mjs").CreateHTMLElementOptions} CreateHTMLElementOptions
 */

/**
 * Create an HTML element with various options
 * @param {string|HTMLElement} tag The element name to use in creation. If a string containing HTML is passed, attempts to create an element from that string. 
 * If an HTMLElement is passed, modifies it according to `options`.
 * @param {CreateHTMLElementOptions} [options] Options to apply to the created element
 * @returns {HTMLElement} The created element
 */
export function createHTMLElement(tag, { classes = [], dataset = {}, children = [], innerHTML, attributes = {} } = {}) {
  const element =
    tag instanceof HTMLElement ? tag : hasTags(tag) ? elementFromString(tag) : document.createElement(tag);
  if (classes.length > 0) element.classList.add(...classes);

  for (const [key, value] of Object.entries(dataset).filter(([, v]) => !isEmpty(v))) {
    element.dataset[key] = value === true ? "" : String(value);
  }
  for (const [key, value] of Object.entries(attributes).filter(([, v]) => !isEmpty(v))) {
    element[key] = value === true || String(value);
  }
  if (innerHTML) {
    element.innerHTML = innerHTML;
  } else {
    for (const child of children) {
      const childElement = child instanceof HTMLElement ? child : new Text(child);
      element.appendChild(childElement);
    }
  }
  return element;
}

/**
 * A little type checking on `Element#querySelector`
 * @param {jQuery|Element|Document} parent The HTML to be queried
 * @param {string} selectors The query string
 * @returns {Element|null} The returned element, or null if not found or bad `parent`
 */
export function htmlQuery(parent, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(parent instanceof Element || parent instanceof Document)) return null;
  return parent.querySelector(selectors);
}
/**
 * A little type checking on `Element#querySelectorAll`, and returns an Array made from the returned NodeList
 * @param {jQuery|Element|Document} parent The HTML to be queried
 * @param {string} selectors The query string
 * @returns {Array<Node>} The returned element, or null if not found or bad `parent`
 */
export function htmlQueryAll(parent, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(parent instanceof Element || parent instanceof Document)) return [];
  return Array.from(parent.querySelectorAll(selectors));
}

/**
 * A little type checking on `Element#closest`
 * @param {jQuery|Element} child The HTML to be queried
 * @param {string} selectors The query string
 * @returns {Element|null} The returned element, or null if not found or bad `parent`
 */
export function htmlClosest(child, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(child instanceof Element)) return null;
  return child.closest(selectors);
}

/**
 * Takes a string of HTML data and returns the first top level element it produces
 * @param {string} string The HTML string to turn into a DOM object
 * @param {CreateHTMLElementOptions} [options={}]
 * @returns {HTMLElement|null} The produced HTMLElement, or null if creation failed
 */
export function elementFromString(string, { classes = [], attributes = {}, dataset = {} } = {}) {
  if (string instanceof HTMLElement) return string;
  if (typeof string !== "string") {
    //todo: generalize type warnings
    mhlog(`MHL.Fallback.Type`, {
      context: {
        arg: "string",
        expected: "string or HTMLElement",
        type: typeof string,
      },
      func: "elementFromString",
    });
    return null;
  }
  if (!string) return null;
  const template = document.createElement("template");
  template.innerHTML = string;
  const el = template.content?.firstElementChild;

  if (!el) {
    //todo: log error
    return null;
  }

  if (!isEmpty(classes) && Array.isArray(classes)) el.classList.add(...classes);
  if (!isEmpty(attributes) && isPlainObject(attributes)) {
    for (const [key, value] of Object.entries(attributes).filter(([, v]) => !isEmpty(v))) {
      el[key] = value === true || String(value);
    }
  }
  if (!isEmpty(dataset) && isPlainObject(dataset)) {
    for (const [key, value] of Object.entries(dataset).filter(([, v]) => !isEmpty(v))) {
      el.dataset[key] = value === true ? "" : String(value);
    }
  }
  return el;
}

// export function createIconToggle({
//   name,
//   element = "i",
//   infer,
//   strict,
//   fallback,
//   font,
//   icon = {},
//   tooltip = {},
//   classes = {},
//   attributes = {},
//   dataset = {},
//   disabled,
//   checked,
// } = {}) {
//   const checkboxElement = createHTMLElement("input", {
//     classes: ["mhl-display-none", ...(classes.input ?? [])],
//     attributes: {
//       name,
//       type: "checkbox",
//       ...(isPlainObject(attributes.input) && attributes.input),
//       ...(disabled && { disabled }),
//       ...(checked && { checked }),
//       tabindex: -1
//     },
//     dataset: {
//       ...(dataset.input ?? {}),
//     },
//   });
//   const initialIconClasses = checked ? icon.checked : icon.unchecked;
//   const iconElement = createIconHTMLElement(initialIconClasses, {
//     element,
//     infer,
//     strict,
//     fallback,
//     font,
//     attributes: attributes.icon ?? {},
//     dataset: dataset.icon ?? {},
//     classes: [...(classes.icon ?? [])],
//   });
//   const initialTooltip = checked ? tooltip.checked : tooltip.unchecked;
//   const labelElement = createHTMLElement("label", {
//     classes: [...(classes.input ?? [])],
//     attributes: { ...(isPlainObject(attributes.label) && attributes.label) },
//     dataset: {...(isPlainObject(dataset.label) && dataset.label), tooltip: initialTooltip},
//     children: [checkboxElement, iconElement]
//   });
//   checkboxElement.addEventListener("change", (ev) => {
//     const label = htmlClosest(ev.currentTarget, "label");
//     const icon = htmlQuery(label, element);
//     const value = ev.currentTarget.checked
//     if (value) {

//     }
//   })
// }
