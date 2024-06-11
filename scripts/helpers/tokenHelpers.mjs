import { MHLError } from "./errorHelpers.mjs";
import { mhlocalize } from "./stringHelpers.mjs";
const PREFIX = `MHL.Token`;
export function oneTokenOnly(options = {}) {
  let { fallback, func, useFirst } = options;
  fallback ??= true;
  useFirst ??= false;
  const tokens = anyTokens({ fallback });
  //if it was 0 it got caught by anyTokens
  if (tokens.length > 1) {
    if (useFirst) {
      mhlog(`MHL.Warning.Fallback.FirstToken`, { context: { name: tokens[0].name }, func });
    } else {
      throw MHLError(`MHL.Error.Token.NotOneSelected`, { func });
    }
  }
  return tokens[0];
}
export function anyTokens(options = {}) {
  let { fallback, func } = options;
  fallback ??= true;
  if (canvas.tokens.controlled.length === 0) {
    if (fallback && game.user.character) {
      const activeTokens = game.user.character.getActiveTokens();
      if (activeTokens.length) return activeTokens[0];
    }
    throw MHLError(`MHL.Error.Token.NotAnySelected`, {
      context: { fallback: fallback ? mhlocalize(`MHL.Error.Token.Fallback`) : "" },
      func,
    });
  }
  return canvas.tokens.controlled;
}
