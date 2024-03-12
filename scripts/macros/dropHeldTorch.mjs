import { oneTokenOnly } from "../helpers/tokenHelpers.mjs";
import { MHLError, requireSystem } from "../helpers/errorHelpers.mjs";

export async function dropHeldTorch() {
  const PREFIX = "MHL.Macros.DropHeldTorch";
  const func = "dropHeldTorch";
  requireSystem("pf2e", `MHL | ${func}`);
  //Check for exactly one selected token
  const token = oneTokenOnly();
  if (!game.modules.get("item-piles")?.active) throw MHLError(`${PREFIX}.Error.ItemPilesDependency`, { func });
  const held = token.actor.items.filter((i) => i.carryType === "held");
  //eventually want this to be a select held item dialog, hardcoding to Torch for now)
  const [torch] = held.filter((i) => i.name === "Torch");
  if (!torch) {
    ui.notifications.warn("Token has no held torches!");
    return;
  }
  const [removed] = await game.itempiles.API.removeItems(token.actor, [{ _id: torch.id, quantity: 1 }]);
  const droppeditem = removed.item;

  //fix the quantity
  droppeditem.system.quantity = 1;

  let lightupdate = {};
  //if the item emits light..
  const [lightrule] = droppeditem.system?.rules?.filter((r) => r.key === "TokenLight");
  if (lightrule) {
    //...and that light is controlled by a toggle...
    if (lightrule.predicate?.length === 1) {
      //..and that toggle is on the item itself... (opu = option predicated upon)
      const [opu] = droppeditem.system.rules.filter((r) => r.toggleable && r.option === lightrule.predicate[0]);
      //..and that toggle is currently on..
      if (opu && opu.value) {
        //..turn it off and add the light to the token
        token.actor.toggleRollOption(opu.domain, opu.option);
        lightupdate = lightrule.value;
      }
    } else {
      //no predicate, always-on light, apply to the token
      lightupdate = lightrule.value;
    }
  }
  const aOverrides = {
    // "img": "Assets/icons/painterly/haste-fire-3.png"
  };
  const tOverrides = {
    "texture.scaleX": 0.5,
    "texture.scaleY": 0.5,
    // "texture.src": "Assets/icons/painterly/haste-fire-3.png",
    light: lightupdate,
    "flags.pf2e.linkToActorSize": false,
    "flags.pf2e.autoscale": false,
    name: droppeditem.name,
  };
  const options = {
    position: {
      x: token.position.x,
      y: token.position.y,
    },
    actorOverrides: aOverrides,
    tokenOverrides: tOverrides,
    items: [droppeditem],
    itemPileFlags: {
      type: game.itempiles.pile_types.PILE,
      displayOne: false,
      showItemName: true,
      overrideSingleItemScale: false,
    },
  };
  const pile = await game.itempiles.API.createItemPile(options);

  const message = ChatMessage.create({
    user: game.user.id,
    type: CONST.CHAT_MESSAGE_TYPES.IC,
    speaker: ChatMessage.getSpeaker(),
    content: `${token.name} has dropped their ${droppeditem.name}!`,
  });
  // const pactor = fromUuidSync(pile.actorUuid);
  // const ptoken = fromUuidSync(pile.tokenUuid);
  // await ptoken.update(tOverrides);
}
