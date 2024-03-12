let scoutidx = 0;
const scoutids = [
    '',
    'Compendium.pf2e.other-effects.EMqGwUi3VMhCjTlF', //Effect: Scouting
    'Compendium.pf2e.other-effects.la8rWwUtReElgTS6', //Effect: Scouting (Incredible Scout)
];
const scoutingmods = [
    '',
    new game.pf2e.Modifier('Scouting', 1, 'circumstance'),
    new game.pf2e.Modifier('Scouting (Incredible Scout)', 2, 'circumstance')
];

let playertokens = [];
let friendlytokens = [];
let hostiletokens = [];
const DMPCUserID = 'h1RtX0va8IgVXvRd';

//partition between player, friendly and selected hostile tokens; search the first two groups for scouts
for (token of canvas.tokens.placeables) {
    if (token.actor.traits.has('minion')) continue;
    if (token.actor.system.details.alliance === 'party') {
        const rollopts = token.actor.getRollOptions(['initiative']);
        if (rollopts.some(re => ['self:effect:scout', 'self:effect:scouting'].includes(re))) {
            scoutidx = Math.max(scoutidx, rollopts.includes('feat:incredible-scout') ? 2 : 1);
        }
        if (token.actor.type === 'npc' || token.actor.ownership[DMPCUserID] === 3) {
            friendlytokens.push(token);
            continue;
        }
        playertokens.push(token);
        continue;
    }
    //add selected hostiles, *and* hostiles in the tracker who haven't rolled or have had their init reset
    if (canvas.tokens.controlled.includes(token) || game.combat?.getCombatantByToken(token.id)?.initiative === null) {
        hostiletokens.push(token)
    }
}

if (!canvas.tokens.controlled.length && !playertokens.length) {
    return ui.notifications.warn('No tokens selected and no player tokens on scene.')
}
//create combat if none exists
const combat = game.combat ?? await Combat.create({scene: canvas.scene.id, active: true});
//add and roll hostiles + npcs
let rollabletokens = hostiletokens.concat(friendlytokens);
for (const rt of rollabletokens) {
    if (!rt.inCombat) await rt.toggleCombat();
    const combatant = game.combat.getCombatantByToken(rt.id);
    //if you want to reroll initiatve, blank it on the tracker first
    if (combatant.initiative === null) {
        const rollData = {
            event,
            rollMode: CONST.DICE_ROLL_MODES.PRIVATE
        };
        if (friendlytokens.includes(rt)) {
            rollData.rollMode = CONST.DICE_ROLL_MODES.PUBLIC;
            if (scoutidx) rollData.modifiers = [scoutingmods[scoutidx]];
        }
        await rt.actor.initiative.roll(rollData);
    }
}
//add player tokens to combat
for (const pt of playertokens) if (!pt.inCombat) await pt.toggleCombat();