import { oneTokenOnly } from "../helpers/tokenHelpers.mjs";
import { pickItemFromActor } from "../helpers/pf2eHelpers.mjs";
import { MHLError, localizedBanner, requireSystem } from "../helpers/errorHelpers.mjs";

export async function lashingCurrents() {
  const PREFIX = "MHL.Macro.LashingCurrents";
  const func = "lashingCurrents";
  requireSystem("pf2e", `MHL | ${func}`);
  const token = oneTokenOnly();
  const actor = token.actor;
  const FORBIDDEN_RUNES = ["bloodbane", "kinWarding"];
  const rules = [
    {
      key: "Strike",
      category: "simple",
      damage: {
        base: {
          damageType: "bludgeoning",
          dice: 1,
          die: "d4",
        },
      },
      slug: "lashing-currents",
      label: "Lashing Currents",
      group: "flail",
      traits: ["disarm", "finesse", "reach-10", "trip", "versatile-s"],
      img: "icons/magic/water/waves-water-blue.webp",
    },
  ];
  const existingLC = await pickItemFromActor(actor, {
    itemType: "weapon",
    otherFilter: (i) => i.system.rules.find((r) => r?.slug === "lashing-currents"),
    errorIfEmpty: false,
  });
  if (!existingLC) {
    const relicWeapon = await pickItemFromActor(actor, {
      held: true,
      itemType: "weapon",
    });
    if (!relicWeapon) throw MHLError(`${PREFIX}.Error.NoneSelected`, { func });
    rules.push({
      key: "Striking",
      selector: "lashing-currents-damage",
      value: relicWeapon.system.runes.striking,
    });
    rules.push({
      key: "WeaponPotency",
      selector: "lashing-currents-attack",
      value: relicWeapon.system.runes.potency,
    });
    for (const propRune of relicWeapon.system.runes.property) {
      if (FORBIDDEN_RUNES.includes(propRune)) continue;
      rules.push({
        key: "AdjustStrike",
        mode: "add",
        property: "property-runes",
        value: propRune,
        definition: ["item:slug:lashing-currents"],
      });
    }
    await relicWeapon.update({ "system.rules": rules.concat(relicWeapon.system.rules) });
  } else {
    const oldRules = existingLC.system.rules.filter(
      (r) =>
        !(
          r?.selector?.includes("lashing-currents") ||
          r?.definition?.[0]?.includes("lashing-currents") ||
          r?.slug === "lashing-currents"
        )
    );
    await existingLC.update({ "system.rules": oldRules });
    localizedBanner(`${PREFIX}.Info.Removing`, { context: { name: existingLC.name }, console: false });
  }
}
