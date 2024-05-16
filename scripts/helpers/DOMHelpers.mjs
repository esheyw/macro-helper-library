/*
htmlQuery, htmlQueryAll, and htmlClosest are taken from the PF2e codebase (https://github.com/foundryvtt/pf2e), used under the Apache 2.0 License
*/

import { mhlog } from "./errorHelpers.mjs";

export function htmlQuery(parent, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(parent instanceof Element || parent instanceof Document)) return null;
  return parent.querySelector(selectors);
}

export function htmlQueryAll(parent, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(parent instanceof Element || parent instanceof Document)) return [];
  return Array.from(parent.querySelectorAll(selectors));
}

export function htmlClosest(child, selectors) {
  parent = parent instanceof jQuery ? parent[0] : parent;
  if (!(child instanceof Element)) return null;
  return child.closest(selectors);
}

export function elementFromString(string) {
  if (string instanceof HTMLElement) return string;
  if (typeof string !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      localize: true,
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
  return template.content?.firstElementChild;
}
