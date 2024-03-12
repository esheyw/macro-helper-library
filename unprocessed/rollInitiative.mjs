const combat = game.combat;
if (!combat) return ui.notifications.warn("COMBAT.NoneActive", {localize: true});

async function chronoInit(token) {    
    const stabDialogData = {
        title: `Adjust Timestream for ${token.name}?`,
        buttons: {
            stabilize: {
                label: 'Stabilize',
                icon: `<i class='fas fa-scale-balanced'></i>`
            },
            destabilize: {
                label: 'Destabilize',
                icon: `<i class='fas fa-scale-unbalanced fa-beat-fade'></i>`
            },
            roll: {
                label: 'Regular Roll',
                icon: `<i class='fas fa-dice-d20 fa-spin-pulse'></i>`
            }
        },
        close: () => {return 'close'},
    }
    return await Dialog.wait(stabDialogData);   
}
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

const ownedcombatants = game.combat.combatants.filter(c=>c.players.includes(game.user));
let playertokens = canvas.tokens.controlled;
if (!playertokens.length) {
    //if nothing selected, check combat tracker for our tokens (assumption being they're added by the start combat macro)
    const ownedcombatanttokens = ownedcombatants.map(c=>canvas.tokens.get(c.tokenId));
    //if nothing in the tracker, maybe our assigned character forgot to get added to initiative
    if (!ownedcombatanttokens) {
        const charToken = game.user.character?.getActiveTokens()[0];
        //no hope, bail
        if (!charToken) return ui.notifications.warn("You have no tokens selected, no owned tokens in combat, and no tokens of your assigned character on this scene.");

        playertokens.push(charToken);
    } else {
        playertokens = playertokens.concat(ownedcombatanttokens);
    }        
}
//check party for scouts
const partytokens = canvas.tokens.placeables.filter(p => p.actor.system.details.alliance === 'party' && !p.actor.traits.has('minion'));
let skimmers = [];
for (const partytoken of partytokens) {
    const rollopts = partytoken.actor.getRollOptions(['initiative']);
    if (rollopts.some(re => ['self:effect:scout', 'self:effect:scouting'].includes(re))) {
        scoutidx = Math.max(scoutidx, rollopts.includes('feat:incredible-scout') ? 2 : 1);
    }
    //check for Chronoskimmers 
    if (rollopts.includes('feat:chronoskimmer-dedication')) skimmers.push(partytoken) 
}

//roll our tokens, adding to combat if they somehow got missed
for (const playertoken of playertokens) {    
    const rollData = {event};
    let response = '';
    let rollflavor = '';
    if (scoutidx) rollData.modifiers = [scoutingmods[scoutidx]];
    if (!playertoken.inCombat) await playertoken.toggleCombat();
    const combatant = game.combat.getCombatantByToken(playertoken.id);
    //if you want to reroll initiatve, blank it on the tracker first
    if (combatant.initiative === null) {
        if (skimmers.includes(playertoken)) {            
            const response = await chronoInit(playertoken);
            switch (response) {
                case 'stabilize':
                    rollflavor = `<strong>Timestream Stabilized</strong>`;
                    rollData.extraRollOptions = [`chronoskimming:stabilized`];
                    break;
                case 'destabilize':
                    const fc = await new Roll('1d20').roll({async: true});
                    //show DsN for the flat check since there's no d20
                    if (game.modules.get('dice-so-nice')?.active) game.dice3d.showForRoll(fc, game.user, true); 
                    const fcs = fc.total > 10;
                    rollflavor = `<strong>Timestream Destabilization: <span data-tooltip="${fc.result}" data-tooltip-direction="UP" style="color:${fcs? 'green">Positive!':'red">Negative.'}</span></strong>`;
                    rollData.extraRollOptions = [`chronoskimming:destabilized:${fcs?"positive":"negative"}`];
                    break;
                case 'roll':
                default:
                    break;
            }
        }        
        await playertoken.actor.initiative.roll(rollData);
        if (skimmers.includes(playertoken)) {
            initmessage = game.messages.contents.slice().reverse().find(m=>m.speaker.token===playertoken.id)
            await initmessage.update({
                flavor: rollflavor + initmessage.flavor
            });
        }
    }
}