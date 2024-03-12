const tokens = canvas.tokens.controlled;
if (tokens.length !== 2) {
    return ui.notifications.warn("Please select exactly two tokens.");
}
const [t1, t2] = tokens;

const t1update = {x: t2.x, y: t2.y};
const t2update = {x: t1.x, y: t1.y};
//do it instantly if alt is held
const options = {
    animate: !event.altKey,
}
t1.document.update(t1update, options);
t2.document.update(t2update, options);