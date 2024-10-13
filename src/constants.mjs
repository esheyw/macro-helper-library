export const MODULE_ID = "macro-helper-library";
export const PHYSICAL_ITEM_TYPES = [
  "armor",
  "backpack",
  "book",
  "consumable",
  "equipment",
  "shield",
  "treasure",
  "weapon",
];
export const fu = foundry.utils;
export const CONSOLE_TYPES = ["trace", "debug", "log", "info", "warn", "error"];
export const BANNER_TYPES = CONSOLE_TYPES.slice(3);
export const LABELABLE_TAGS = ["button", "input", "meter", "output", "progress", "select", "textarea"];
export const VERIFIED_SYSTEM_VERSIONS = {
  pf2e: "6.0.4",
};

export const MODULE = () => game.modules.get(MODULE_ID);
export const MHL = () => MODULE().api;
export const AIF_ACTIVE = () => game.modules.get("additional-icon-fonts")?.active;
export const SM = () => MHL().managers.get(MODULE_ID);
export const MHL2 = () => MODULE().mhl
