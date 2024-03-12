import { BANNER_TYPES, CONSOLE_TYPES } from "../constants.mjs";
import { setting } from "../settings.mjs";
import { getLogPrefix, localize } from "./stringHelpers.mjs";

export function log(loggable, options = {}) {
  const func = "log";
  const defaultType = "debug";
  let { type, prefix } = options;
  type = String(type ?? defaultType);
  prefix = String(prefix ?? "");
  if (!CONSOLE_TYPES.includes(type)) {
    mhlog(`MHL.Warning.Fallback.LogType`, {
      type: "warn",
      func,
      localize: true,
      context: { type, defaultType },
    });
    type = defaultType;
  }
  if (typeof loggable === "string") {
    loggable = prefix + loggable;
    console[type](loggable);
    return loggable;
  } else {
    console[type](prefix, loggable);
    return loggable;
  }
}

export function modLog(loggable, options = {}) {
  let { type, prefix, context, func, mod } = options;
  options.localize ??= false; // don't destructure so as to not conflict with the function; probably a tidier way to do this
  type ??= setting("log-level") ?? "debug";
  prefix = String(prefix ?? "");
  if (typeof loggable === "string") {
    loggable = options?.localize ? localize(loggable, context) : loggable;
    prefix = getLogPrefix(loggable, { mod, func, prefix });
  } else if (options?.localize) {
    let localized = localize(prefix, context);
    prefix = getLogPrefix(localized, { mod, func }) + localized;
  } else {
    prefix = getLogPrefix("", { mod, func, prefix });
  }
  return log(loggable, { type, prefix });
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
      context: { var: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  let bannerstr = prefix + localize(text, context);
  if (!game.ready) {
    console.error(localize(`MHL.Error.TooEarlyForBanner`, { type, bannerstr }));
  } else {
    ui.notifications[type](bannerstr, { console: doConsole, permanent });
  }
  if (typeof log === "object" && Object.keys(log).length) log(loggable, { type, prefix });
  return bannerstr;
}

export function modBanner(text, options = {}) {
  let { context, prefix, type, console, permanent, log, func, mod } = options;
  type ??= setting("log-level") ?? "info";
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
      context: { var: "text", type: typeof text, expected: "string" },
    });
    text = String(text);
  }
  const errorstr = prefix + localize(text, context);
  if (banner) localizedBanner(errorstr, { type: "error", console: false, permanent });
  if (typeof log === "object" && Object.keys(log).length) log(log, { type: "error", prefix });
  return Error(errorstr);
}

export function modError(text, options = {}) {
  let { context, banner, prefix, log, func, permanent, mod } = options;
  banner ??= true;
  prefix = getLogPrefix(text, { prefix, mod, func });
  if (typeof log === "object" && Object.keys(log).length) modLog(log, { type: "error", prefix });
  if (banner && game.ready) MHLBanner(text, { context, prefix, type: "error", permanent, console: false });
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
