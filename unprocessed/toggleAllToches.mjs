//Check for one or more selected tokens:
const tokens = canvas.tokens.controlled;
if (!tokens.length) {
    const charToken = game.user.character?.getActiveTokens()[0];
    if (!charToken) {
        ui.notifications.warn("Please select at least one token or assign yourself a character.");
        return;
    } else {
        tokens.push(charToken);
    }
}
tokens.forEach(t => {
     t.actor.toggleRollOption("all", "lit-torch");    
});