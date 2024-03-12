const message = game.messages.contents.filter(m => m.flags?.pf2e?.casting).pop()
if (!message) {
    ui.notifications.warn("No spell cards in scrollback!");
    return;
}
const sidebarw = parseInt(document.querySelector('#sidebar').style.width);
const messagew = 300;
const messageh = 900;
const options = {
    height: messageh,
    width: messagew,
    left: (window.innerWidth - sidebarw - messagew),
    top: (window.innerHeight - messageh)
}
const popout = new ChatPopout(message, options);
popout.render(true)
console.warn(sidebarw)