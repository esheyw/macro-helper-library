//Check for exactly one selected token
if (canvas.tokens.controlled.length > 1) return ui.notifications.error("Please select only a single token.");
const token = canvas.tokens.controlled[0] ?? game.user.character?.getActiveTokens()[0];
if (!token) return ui.notifications.error("Please select exactly one token or assign yourself a character.");
const actor = token.actor;
async function pickItemFromActor(actor, {itemType=null, otherFilter=null, held=false, title=null, dialogOptions={}}={})  {  
  const prependArticle = (word) => {
    const vowels = 'aeiou';
    const article = (vowels.indexOf(word[0].toLowerCase()) > -1) ? 'an ' : 'a ';
    return article + word; 
  }
  const PHYSICAL_TYPES = [
    "armor",
    "consumable",
    "equipment",
    "shield",
    "treasure",
    "weapon"
  ]
  let filteredItems;
  if (!itemType || itemType === 'physical') {
    itemType ??= "physical (default)";
    filteredItems = actor.items.filter(i => PHYSICAL_TYPES.includes(i.type)) ?? [];    
  } else {
    filteredItems = actor.items.filter(i => i.type === itemType) ?? [];
  }
  if (!filteredItems.length) {
    ui.notifications.error(`Selected actor lacks any items of type "${itemType}"`);
    return null;
  }
  
  if (otherFilter && typeof otherFilter === 'function') {
    filteredItems = filteredItems.filter(otherFilter);
    if (!filteredItems.length) {
      ui.notifications.error(`Provided filter 
      ${otherFilter.toString()}
      produced no items.`);
      return null;
    } 
  }
  
  if (held) {
    filteredItems = filteredItems.filter(i => i.system.equipped.carryType === 'held') ?? [];
    if (!filteredItems.length) {
      ui.notifications.error(`Selected actor is not holding any matching items.`);
      return null;
    }
  }
   
  
  const style = `<style>
  .esheyw-sel-item-dialog .dialog-buttons {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .esheyw-sel-item-dialog img {
    width: 40px;
    height: 40px;
    margin: auto 2px auto 2px;
  }
  .esheyw-sel-item-dialog button {
    display: flex;
    flex-direction: row;
    justify-content: left;
    padding: 0px;
    margin: 0px;
  }
  .esheyw-sel-item-dialog button span.item-name {
    text-align: left;
    margin: auto;
    margin-left: 2%;
  }
  .esheyw-sel-item-dialog button span.dupe-id {
    font-size: 0.7em
    text-align: right;
    margin: auto;
    margin-right: 2%;
    color: var(--color-cool-3);
  }
  </style>`;
  const names = {};
  for (const item of filteredItems) {
    names[item.name] ??= 0;
    names[item.name]++;
  }
  const buttons = Object.fromEntries(filteredItems.map(i => {
    let label = `<img src="${i.img}" alt="${i.name}" data-tooltip="${i.id}" /><span class="item-name">${i.name}</span>`;
    if (names[i.name] > 1) {
      label += `<span class="dupe-id">(${i.id})</span>`;
    }
    return [i.id, { label }];
  }));
  title ??= `Select ${prependArticle(itemType)}`.titleCase();
  const dialogData = {
    title,
    content: style,
    close: () => {return null;},
    buttons,
  };
  dialogOptions = mergeObject({
      classes: ["esheyw-sel-item-dialog"]
    },
    dialogOptions
  );
  const response = await Dialog.wait(dialogData, dialogOptions);
  return actor.items.get(response);
}
const r = await pickItemFromActor(actor, {
  itemType:'weapon',
  // otherFilter: (i) => i.slug === 'longsword',
  // held: true,
  dialogOptions: {
    width: 300,
  },
});
console.warn(r)