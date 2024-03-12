/*
htmlQuery, htmlQueryAll, and htmlClosest are taken from the PF2e codebase, under the Apache 2.0 License
*/

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