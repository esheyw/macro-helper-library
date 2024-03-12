import { oneTokenOnly } from "../helpers/tokenHelpers.mjs";
import { MHLError, requireSystem } from "../helpers/errorHelpers.mjs";
export async function recoverOldLashingCurrents() {
  const func = "recoverOldLashingCurrents";
  requireSystem("pf2e", `MHL | ${func}`);
  const token = oneTokenOnly();
  const actor = token.actor;
  const existingLC = await pickItemFromActor(actor, {
    itemType: "weapon",
    otherFilter: (i) => i.flags.pf2e.isLashingCurrents,
    errorIfEmpty: false,
  });
  if (!existingLC) {
    throw MHLError("MHL.Macros.LashingCurrents.Error.NoExistingFound", { context: { name: token.name }, func });
  }
  let originalRelicWeaponData = JSON.parse(existingLC.flags.pf2e.originalRelicWeapon);

  originalRelicWeaponData.system.runes.potency = originalRelicWeaponData.system.potencyRune;
  delete originalRelicWeaponData.system.potencyRune;

  originalRelicWeaponData.system.runes.striking = originalRelicWeaponData.system.strikingRune;
  delete originalRelicWeaponData.system.strikingRune;

  originalRelicWeaponData.system.runes.property = [];
  for (let i = 1; i <= 4; i++) {
    const rune = originalRelicWeaponData.system[`propertyRune${i}`].value ?? null;
    if (!rune) continue;
    delete originalRelicWeaponData.system[`propertyRune${i}`];
    originalRelicWeaponData.system.runes.property.push(rune);
  }

  const [originalRelicWeapon] = await actor.createEmbeddedDocuments("Item", [originalRelicWeaponData]);
  await originalRelicWeapon.update({
    "system.equipped.carryType": existingLC.system.equipped.carryType,
    "system.equipped.handsHeld": existingLC.system.equipped.handsHeld,
  });
  await existingLC.delete();
}
