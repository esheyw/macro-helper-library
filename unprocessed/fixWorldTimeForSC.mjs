// Fix Simple Calendar being out of sync with smalltime
let settime = "1971-01-01T00:00:00.000Z";
let currtime = game.settings.get("pf2e", "worldClock.worldCreatedOn")
console.warn(`Current world time: ${currtime} | Setting to ${settime}`);
game.settings.set("pf2e", "worldClock.worldCreatedOn", settime)