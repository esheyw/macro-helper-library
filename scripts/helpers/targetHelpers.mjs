import { MHLError, mhlog } from "./errorHelpers.mjs";
export function oneTargetOnly(options = {}) {
  let { user, useFirst, func } = options;
  const targets = anyTargets({ user, func });
  // if there were 0 targets it got caught by anyTargets
  const firstTarget = targets.first();
  if (targets.size > 1) {
    if (useFirst) {
      mhlog(`MHL.Warning.Fallback.FirstTarget`, { localize: true, context: { name: firstTarget.name }, func });
    } else {
      throw MHLError(`MHL.Error.Target.NotOneTargetted`, { func });
    }
  }
  return firstTarget;
}
export function anyTargets(options = {}) {
  let { user, func } = options;
  user ??= game.user;
  if (typeof user === "string") user = game.users.get(user) ?? game.users.getName(user);
  if (!(user instanceof User)) {
    throw MHLError(`MHL.Error.Type.User`, { context: { var: "user" }, log: { user }, func });
  }
  if (user.targets.size === 0) {
    throw MHLError(`MHL.Error.Target.NotAnyTargetted`, { func });
  }
  return user.targets;
}
