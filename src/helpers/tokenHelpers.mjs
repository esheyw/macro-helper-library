import { mhlError, mhlog } from "./errorHelpers.mjs";

export function oneTokenOnly({ useFirst = false, document = false, fallback = true, func } = {}) {
  const tokens = anyTokens({ fallback, func, prefix, documents: document });
  //if it was 0 it got caught by anyTokens
  if (tokens.length > 1) {
    if (useFirst) {
      mhlog(`MHL.Fallback.FirstToken`, { context: { name: tokens[0].name }, func });
    } else {
      throw mhlError(`MHL.Error.Token.NotOneSelected`, { func });
    }
  }
  return tokens[0];
}
export function anyTokens({ documents = false, fallback = true, func } = {}) {
  if (canvas.tokens.controlled.length === 0) {
    if (fallback && game.user.character) {
      const activeTokens = game.user.character.getActiveTokens();
      if (activeTokens.length) return activeTokens[0];
    }
    throw mhlError(`MHL.Error.Token.NotAnySelected`, {
      context: { fallback: fallback ? `MHL.Error.Token.Fallback` : "" },
      func,
    });
  }
  return documents ? canvas.tokens.conrolled.map((t) => t.document) : canvas.tokens.controlled;
}
