import { BANNER_TYPES, CONSOLE_TYPES, fu } from "../constants.mjs";
import { setting } from "../settings/settings.mjs";
import { isEmpty } from "./otherHelpers.mjs";
import { deeperClone } from "./otherHelpers.mjs";
import { localize } from "./stringHelpers.mjs";
/**
 * @typedef {import("../_types.mjs").LogOptions} LogOptions
 */

/**
 * The unified logging function of MHL
 *
 * @param {*} loggable The value to be logged. If a string, will be handled slightly differently, but that should be transparent
 * @param {LogOptions} [options] Options for the log call
 * @returns {void|Error} If it returns, it will be because `options.error` was true and will be an Error
 */
export function log(
  loggable,
  {
    type,
    text,
    localize: doLocalize = true,
    context,
    func,
    prefix,
    banner = false,
    permanent = false,
    console: doConsole = true,
    clone = false,
    softType,
    error = false,
  } = {}
) {
  const defaultType = "log";
  let loggableText = "";
  let processedType;
  if (typeof loggable === "string" && isEmpty(text)) {
    text = loggable;
    loggable = undefined;
  }
  if (typeof prefix === "string") loggableText += `${prefix} | `;
  if (typeof func === "string") loggableText += `${func} | `;
  if (typeof text === "string") loggableText += doLocalize ? localize(text, context) : text;
  loggableText = loggableText.trim();
  if (isEmpty(type) || !CONSOLE_TYPES.includes(type)) {
    processedType = setting("debug-mode", { suppress: true })
      ? setting("log-level", { suppress: true })
      : CONSOLE_TYPES.includes(softType)
      ? softType
      : // this can't be an inferred type or we infinite loop
        (mhlog(
          { type, defaultType, CONSOLE_TYPES },
          {
            func,
            text: `MHL.Fallback.LogType`,
            context: { type, fallback: defaultType },
            softType: "error",
          }
        ), // comma separated expressions are cursed
        defaultType);
  } else {
    processedType = type;
  }

  const bannerMap = {
    error: "error",
    warn: "warn",
    log: "info",
    trace: false,
    debug: false,
  };
  if (!isEmpty(banner)) {
    const mappedType = bannerMap[processedType];
    if (!BANNER_TYPES.includes(banner)) {
      if (banner !== true) {
        mhlog(`MHL.Fallback.BannerType`, {
          context: { type, fallback: mappedType || "MHL.Fallback.BannerDiscarded" },
        });
      }
      banner = mappedType;
    }
    if (banner) {
      if (game.ready) ui.notifications[banner](loggableText, { console: false, permanent });
      else error(`MHL.Error.TooEarlyForBanner`, { context: { type: banner, bannerstr: loggableText } });
    }
  }
  if (doConsole) {
    const args = [];
    if (loggableText) args.push(loggableText);
    if (loggable !== undefined) args.push(clone ? deeperClone(loggable) : loggable);
    console[processedType](...args);
  }
  if (error) {
    return Error(loggableText);
  }
}

/**
 * Calls log() with the `type` set to "error" (and `banner` if truthy)
 * Also sets `error` to `true` (will return a throwable `Error`)
 *
 * @param {any} loggable The value to be logged. If a string, will be handled slightly differently, but that should be transparent
 * @param {LogOptions} [options] Options for the log call
 * @returns {Error}
 */
export function error(loggable, options = {}) {
  options.type = "error";
  options.banner &&= "error";
  options.error = true;
  return log(loggable, options);
}

/** Calls log() with the `type` set to "warn" (and `banner` if truthy)
 *
 * @param {any} loggable The value to be logged. If a string, will be handled slightly differently, but that should be transparent
 * @param {LogOptions} [options] Options for the log call
 */
export function warn(loggable, options = {}) {
  options.type = "warn";
  options.banner &&= "warn";
  log(loggable, options);
}

/** Calls log() with the `type` set to "debug" (and `banner` tp "info" if truthy)
 *
 * @param {any} loggable The value to be logged. If a string, will be handled slightly differently, but that should be transparent
 * @param {LogOptions} [options] Options for the log call
 */
export function debug(loggable, options = {}) {
  options.type = "debug";
  options.banner &&= "info";
  log(loggable, options);
}

export function banner(loggable, options = {}) {
  options.console = false;
  if ((isEmpty(options.type) && isEmpty(options.banner)) || options.type === "debug") {
    options.banner = "info";
  } else {
    options.banner = options.type;
  }
  log(loggable, options);
}

export function mhlError(loggable, options = {}) {
  options.prefix = "MHL";
  return error(loggable, options);
}
export function mhlWarn(loggable, options = {}) {
  options.prefix = "MHL";
  return warn(loggable, options);
}
export function mhlog(loggable, options = {}) {
  options.prefix = "MHL";
  options.type ??= "log";
  return log(loggable, options);
}
export function mhlDebug(loggable, options = {}) {
  options.prefix = "MHL";
  return debug(loggable, options);
}

export function isPF2e() {
  return game.system.id === "pf2e";
}

export function requireSystem(system, options = {}) {
  //todo: add min/max version options
  options = fu.mergeObject(
    {
      context: { system },
      banner: true,
    },
    options,
    { inplace: false }
  );
  if (game.system.id !== system) throw error(`MHL.Error.RequiresSystem`, options);
}

export function logCastString(variable, name, { func = null, prefix = "MHL" } = {}) {
  return logCast(variable, name, { type: String, func, prefix });
}
export function logCastNumber(variable, name, { func = null, prefix = "MHL" } = {}) {
  return logCast(variable, name, { type: Number, func, prefix });
}
export function logCastBool(variable, name, { func = null, prefix = "MHL" } = {}) {
  return logCast(variable, name, { type: Boolean, func, prefix });
}
export function logCast(variable, name, { type = String, func = null, prefix = "MHL" } = {}) {
  type = typeof type === "function" ? type : globalThis[String(type)] ?? null;
  if (!type) return variable; //todo: logging lol
  const targetType = type.name.toLowerCase();
  if (typeof variable !== targetType) {
    debugger;
    log(
      { [name]: variable },
      {
        prefix,
        text: `MHL.Fallback.Type`,
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
