import { BANNER_TYPES, CONSOLE_TYPES, fu } from "../constants.mjs";
import { MODULE } from "../init.mjs";
import { setting } from "../settings/settings.mjs";
import { isEmpty } from "./otherHelpers.mjs";
import { deeperClone } from "./otherHelpers.mjs";
import { mhlocalize } from "./stringHelpers.mjs";

export function log(loggable, { type, prefix } = {}) {
  const func = "log";
  const defaultType = "log";
  type = String(type ?? defaultType);
  prefix = String(prefix ?? "");
  if (!CONSOLE_TYPES.includes(type)) {
    mhlog(`MHL.Warning.Fallback.LogType`, {
      func,
      context: { type, defaultType },
    });
    type = defaultType;
  }
  console[type](prefix.trim(), loggable);
}
export function warn(loggable, prefix = "") {
  log(loggable, { type: "warn", prefix });
}
export function debug(loggable, prefix = "") {
  log(loggable, { type: "debug", prefix });
}
export function error(loggable, prefix = "") {
  log(loggable, { type: "error", prefix });
}
export function modLog(loggable, { type, prefix, context, func, mod, localize = true, dupe = false, softType } = {}) {
  if (isEmpty(type) || typeof type !== "string") {
    // if type is not provided or bad, and we're not in debug mode, bail.
    if (!setting("debug-mode") && !softType) return;
    type = setting("log-level") ?? softType;
  }
  if (typeof loggable === "string") {
    loggable = localize ? mhlocalize(loggable, context) : loggable;
    prefix = getLogPrefix(loggable, { mod, func, prefix });
  } else if (localize && prefix) {
    let localized = mhlocalize(prefix, context);
    prefix = getLogPrefix(localized, { mod, func }) + localized;
  } else {
    prefix = getLogPrefix("", { mod, func, prefix });
  }
  log(dupe ? deeperClone(loggable) : loggable, { type, prefix });
}

export function mhlog(loggable, options = {}) {
  options.mod = "MHL";
  modLog(loggable, options);
}

export function localizedBanner(text, options = {}) {
  const func = "localizedBanner";
  const defaultType = "info";
  let { context, prefix, type, console: doConsole, permanent, log: loggable } = options;
  prefix = String(prefix ?? "");
  type = String(type ?? "");
  console ??= false;
  permanent ??= false;
  if (!BANNER_TYPES.includes(type)) {
    mhlog(`MHL.Warning.Fallback.BannerType`, { type: "warn", func, context: { type, defaultType } });
    type = defaultType;
  }
  if (typeof text !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func,
      context: { arg: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  let bannerstr = prefix + mhlocalize(text, context);
  if (!game.ready) {
    console.error(mhlocalize(`MHL.Error.TooEarlyForBanner`, { type, bannerstr }));
  } else {
    ui.notifications[type](bannerstr, { console: doConsole, permanent });
  }
  if (typeof log === "object" && Object.keys(log).length) log(loggable, { type, prefix });
}

export function modBanner(text, options = {}) {
  let { context, prefix, type, console, permanent, log, func, mod, softType } = options;
  if (isEmpty(type) || typeof type !== "string") {
    // if type is not provided, and we're passed setup and not in debug mode, bail.
    if (!setting("debug-mode") && !softType) return;
    // if we're logging before setup, assume error if no softType
    type = setting("log-level") ?? softType ?? "error";
  }
  prefix = getLogPrefix(text, { mod, func, prefix });
  options.prefix = prefix;
  if (typeof log === "object" && Object.keys(log).length) modLog(log, options);
  localizedBanner(text, { context, prefix, type, console, permanent });
}

export function MHLBanner(text, options = {}) {
  options.mod = "MHL";
  modBanner(text, options);
}

export function localizedError(text, options = {}) {
  const func = "localizedError";
  let { context, banner, prefix, permanent, log } = options;
  banner ??= false;
  prefix = String(prefix ?? "");
  permanent ??= false;
  if (typeof text !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func,
      context: { arg: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  const errorstr = prefix + mhlocalize(text, context);
  if (banner) localizedBanner(errorstr, { type: "error", console: false, permanent });
  if (typeof log === "object" && Object.keys(log).length) log(log, { type: "error", prefix });
  return Error(errorstr);
}

export function modError(text, options = {}) {
  let { context, banner, prefix, log, func, permanent, mod } = options;
  banner ??= true;
  prefix = getLogPrefix(text, { prefix, mod, func });
  if (typeof log === "object" && Object.keys(log).length) modLog(log, { type: "error", prefix });
  if (banner && game.ready) modBanner(text, { context, prefix, type: "error", permanent, console: false });
  return localizedError(text, { context, prefix, type: "error", banner: false });
}

export function MHLError(text, options = {}) {
  options.mod = "MHL";
  return modError(text, options);
}

export function isPF2e() {
  return game.system.id === "pf2e";
}

export function requireSystem(system, prefix = null) {
  //todo: add min/max version options
  if (game.system.id !== system)
    throw localizedError(`MHL.Error.RequiresSystem`, { context: { system }, prefix, banner: true });
}

function getLogPrefix(text, { prefix, mod, func } = {}) {
  let out = "";
  text = logCastString(text, "text", { func: "getLogPrefix", mod });
  mod = String(mod ?? "");
  func = String(func ?? "");
  prefix = String(prefix ?? "");
  if (mod && !text.startsWith(`${mod} |`)) out += `${mod} | `;
  if (func && !text.includes(`${func} |`)) out += `${func} | `;
  if (prefix) out += prefix;
  return out;
}
export function logCastString(variable, name, { func = null, mod = "MHL" } = {}) {
  return logCast(variable, name, { type: String, func, mod });
}
export function logCastNumber(variable, name, { func = null, mod = "MHL" } = {}) {
  return logCast(variable, name, { type: Number, func, mod });
}
export function logCastBool(variable, name, { func = null, mod = "MHL" } = {}) {
  return logCast(variable, name, { type: Boolean, func, mod });
}
export function logCast(variable, name, { type = String, func = null, mod = "MHL" } = {}) {
  type = typeof type === "function" ? type : globalThis[String(type)] ?? null;
  if (!type) return variable; //todo: logging lol
  const targetType = type.name.toLowerCase();
  if (typeof variable !== targetType) {
    debugger;
    modLog(
      { [name]: variable },
      {
        mod,
        prefix: `MHL.Warning.Fallback.Type`,
        func,
        context: { arg: name, type: typeof variable, expected: targetType },
      }
    );
    return type(variable);
  }
  return variable;
}

export function chatLog(loggable, options) {
  //todo: improve
  getDocumentClass("ChatMessage").create({
    content: `<pre>${JSON.stringify(loggable, null, 2)}</pre>`,
  });
}
