export default async function trickyMagic() {
    const DamageRoll = CONFIG.Dice.rolls.find(((R) => R.name === "DamageRoll"));
    const CheckRoll = CONFIG.Dice.rolls.find(((R) => R.name === "CheckRoll"));


    let caster;
    if (!game.user.targets.size || game.user.targets.size > 1) {
        ui.notifications.warn('You must have a single target for Tricky Magic.');
        return;
    }
    if (!(canvas.tokens.controlled.length)) {
        const charToken = canvas.scene.tokens.filter(t => t.actor?.id === game.user.character?.id).pop();
        if (charToken) {
            caster = charToken.actor;
            ui.notifications.info("Falling back to assigned Character.");
        } else {
            ui.notifications.warn("Please select exactly one token");
            return;
        }
    }
    caster ??= canvas.tokens.controlled[0].actor;
    const target = game.user.targets.first().actor;

    // const rollopts = () => [
        // ...caster.getRollOptions(['all','skill-check']),
        // 'action:tricky-magic'
    // ];
    // console.warn(rollopts());
    const perdc = target.perception.dc.value;
    return await caster.skills.arcana.roll({dc: perdc, event})
}