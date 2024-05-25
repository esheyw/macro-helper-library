import { BANNER_TYPES, CONSOLE_TYPES, fu } from "../constants.mjs";
import { MODULE } from "../init.mjs";
import { setting } from "../settings.mjs";
import { mhlocalize } from "./stringHelpers.mjs";

export function log(loggable, { type, prefix } = {}) {
  const func = "log";
  const defaultType = "log";
  type = String(type ?? defaultType);
  prefix = String(prefix ?? "");
  if (!CONSOLE_TYPES.includes(type)) {
    mhlog(`MHL.Warning.Fallback.LogType`, {
      func,
      localize: true,
      context: { type, defaultType },
    });
    type = defaultType;
  }
  console[type](prefix.trim(), loggable);
  return loggable;
}
export function warn(loggable, prefix = "") {
  return log(loggable, { type: "warn", prefix });
}
export function debug(loggable, prefix = "") {
  return log(loggable, { type: "debug", prefix });
}
export function error(loggable, prefix = "") {
  return log(loggable, { type: "error", prefix });
}
export function modLog(loggable, { type, prefix, context, func, mod, localize = false, dupe = false } = {}) {
  if (isEmpty(type) || typeof type !== "string") {
    // if type is not provided or bad, and we're not in debug mode, bail.
    if (!setting("debug-mode")) return;
    type = setting("log-level");
  }
  if (typeof loggable === "string") {
    loggable = localize ? mhlocalize(loggable, context) : loggable;
    prefix = getLogPrefix(loggable, { mod, func, prefix });
  } else if (localize) {
    let localized = mhlocalize(prefix, context);
    prefix = getLogPrefix(localized, { mod, func }) + localized;
  } else {
    prefix = getLogPrefix("", { mod, func, prefix });
  }
  return log(dupe ? fu.duplicate(loggable) : loggable, { type, prefix });
}

export function mhlog(loggable, options = {}) {
  options.mod = "MHL";
  return modLog(loggable, options);
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
    mhlog(`MHL.Warning.Fallback.BannerType`, { type: "warn", func, localize: true, context: { type, defaultType } });
    type = defaultType;
  }
  if (typeof text !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func,
      localize: true,
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
  return bannerstr;
}

export function modBanner(text, options = {}) {
  let { context, prefix, type, console, permanent, log, func, mod } = options;
  const setup = MODULE().setup;
  if (isEmpty(type) || typeof type !== "string") {
    // if type is not provided, and we're passed setup and not in debug mode, bail.
    if (setup && !setting("debug-mode")) return;
    // if we're logging before setup, assume error
    type = setup ? setting("log-level") : "error";
  }
  prefix = getLogPrefix(text, { mod, func, prefix });
  options.prefix = prefix;
  const out = localizedBanner(text, { context, prefix, type, console, permanent });
  if (typeof log === "object" && Object.keys(log).length) modLog(log, options);
  return out;
}

export function MHLBanner(text, options = {}) {
  options.mod = "MHL";
  return modBanner(text, options);
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
      localize: true,
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
  if (game.system.id !== system)
    throw localizedError(`MHL.Error.RequiresSystem`, { context: { system }, prefix, banner: true });
}

// taken from https://stackoverflow.com/a/32728075, slightly modernized
/**
 * Checks if value is empty. Deep-checks arrays and objects
 * Note: isEmpty([]) == true, isEmpty({}) == true, isEmpty([{0:false},"",0]) == true, isEmpty({0:1}) == false
 * @param value
 * @returns {boolean}
 */
export function isEmpty(value) {
  const isEmptyObject = (a) => {
    if (!Array.isArray(a)) {
      // it's an Object, not an Array
      const hasNonempty = Object.keys(a).some((e) => !isEmpty(a[e]));
      return hasNonempty ? false : isEmptyObject(Object.keys(a));
    }
    return !a.some((e) => !isEmpty(e));
  };
  return (
    value == false ||
    typeof value === "undefined" ||
    value == null ||
    (typeof value === "object" && isEmptyObject(value))
  );
}

export function getLogPrefix(text, { prefix, mod, func } = {}) {
  let out = "";
  if (typeof text !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func: "getLogPrefix",
      localize: true,
      context: { arg: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  mod = String(mod ?? "");
  func = String(func ?? "");
  prefix = String(prefix ?? "");
  if (mod && !text.startsWith(`${mod} |`)) out += `${mod} | `;
  if (func && !text.includes(`${func} |`)) out += `${func} | `;
  if (prefix) out += prefix;
  return out;
}

export function logCast(variable, type, name, func) {
  type = typeof type === "function" ? type : globalThis[String(type)] ?? null;
  if (!type) return variable; //todo: logging lol
  const targetType = type.name.toLowerCase();
  if (typeof variable !== targetType) {
    mhlog(
      { [name]: variable },
      {
        localize: true,
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


