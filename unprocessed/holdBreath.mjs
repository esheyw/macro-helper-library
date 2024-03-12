export default async function holdBreath() {
    const edata = {
    type: 'effect',
    name: 'Holding Breath',
    img: 'systems/pf2e/icons/spells/powerful-inhalation.webp',
    system: {
        badge: {
            value: 1,
            type: 'counter',
            label: null,
        },
        tokenIcon: { show: true },
            duration: {
            value: 1,
            unit: 'unlimited',
            sustained: false,
            expiry: 'turn-start',
        },
        description: {
            value: `<p>You can hold your breath for a number of rounds equal to 5 + your Constitution modifier. Reduce your remaining air by 1 round at the end of each of your turns, or by 2 if you attacked or cast any spells that turn. You also lose 1 round worth of air each time you are critically hit or critically fail a save against a damaging effect. If you speak (including casting spells with verbal components or activating items with command components) you lose all remaining air.</p> <p>When you run out of air, you fall unconscious and start suffocating. You can’t recover from being unconscious and must attempt a @Check[type:fortitude|dc:20|showDC:all] at the end of each of your turns. On a failure, you take [[/r 1d10]] damage, and on a critical failure, you die. On each check after the first, the DC increases by 5 and the damage by 1d10; these increases are cumulative. Once your access to air is restored, you stop suffocating and are no longer unconscious (unless you’re at 0 Hit Points).</p>`,
        },
        unidentified: false,
        traits: {
            custom: '',
            rarity: 'common',
            value: [],
        },
        level: {
            value: 0,
        },
        slug: `holding-breath`,
    },
    flags: {},
    }
    const macrodoc = this;
    class ValidatedDialog extends Dialog {
    submit(button, event) {
        if (button.label === 'Submit' && !this.element[0].querySelector('#effectID').value) return;
        super.submit(button, event);
    }
    }
    let dData = {};
    let dOpts = {};
    let effectID = macrodoc.getFlag('world', 'effect');
    let effect;
    if (effectID) {
    effect = await fromUuid(effectID);
    }
    //only unset the effect if the saved ID is invalid, not if shift
    if (!effect) await macrodoc.unsetFlag('world', 'effect');
    if (!effect || event.shiftKey) {

    const initialName = effect?.name ?? "No Effect Saved";
    const initialID = effect?.uuid ?? "";
    const form = `
    <form>
        <div class="form-group">
            <label for="effect">Drop effect here:</label>
            <input id="effectName" name="effect" type="text" value="${initialName}" />
            <input id="effectID" name="effectID" type="hidden" value="${initialID}" />
        </div>                
    </form> 
    `;

    function renderCallback(html) {
        const textbox = html[0].querySelector('#effectName')
        textbox.addEventListener('drop', dropCallback);
        textbox.readOnly = true;
        const submit = html[2].querySelector('button.submit')
        if (!effect) submit.disabled = true;
    }
    async function dropCallback(event) {
        const dropdata = JSON.parse(event.dataTransfer?.getData("text/plain"));
        if (!dropdata || dropdata.type !== 'Item' || dropdata.itemType !== 'effect') {
            this.value = 'Invalid: Not an Effect';
            return;      
        } 
        const effect = await fromUuid(dropdata.uuid);
        if (!effect) return this.value = `Couldn't retrieve effect ${dropdata.uuid}`;
        if (!effect.system.badge || effect.system.badge.type !== 'counter' || 'labels' in effect.system.badge) {
            return this.value = 'Invalid: Effect lacks a counter.';
        }
                
        this.value = effect.name;

        this.parentElement.querySelector('#effectID').value = dropdata.uuid;
        this.closest('.app').querySelector("button.submit").disabled = false;
    }
    function effectcallback(html) {    
        const formElement = html[0].querySelector('form');
        const formData = new FormDataExtended(formElement);
        const formDataObject = formData.toObject();
        return formDataObject.effectID;
    }
    async function buildcallback(html) {
        const builteffect = await Item.create(edata);
        await builteffect.update({'flags.core.sourceId': builteffect.uuid});
        return builteffect.uuid;
    }
    dData = {
        title: "Drop Effect Here",
        content: form,
        render: renderCallback,
        buttons: {      
            submit: { label: "Submit", callback: effectcallback, icon: '<i class="fas fa-check"></i>' },            
            cancel: { label: "Cancel", icon: '<i class="fas fa-times"></i>' }
        },
        default: 'submit',
    }
    if (!game.items.getName('Holding Breath')) {
        dData.buttons.build = { label: "Build Default", callback: buildcallback }
    }
    dOpts = {
        height: "auto",
        width: 400,
    }
    const response = await ValidatedDialog.wait(dData, dOpts);
    if (response === 'cancel') return;    
    await macrodoc.setFlag('world', 'effect', response)
    }



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

    effect ??= await fromUuid(this.getFlag('world', 'effect'));

    for (token of tokens) {
    if (!(['character', 'npc'].includes(token.actor.type))) continue;    
    const effectExists = token.actor.items.filter(i => (i.flags?.core?.sourceId && i.flags.core.sourceId == effect.uuid))
    if (effectExists.length) continue;
    const effectdata = effect.toObject();
    effectdata.flags.core ??= [];
    effectdata.flags.core.sourceId = effect.uuid;
    effectdata.system.badge.value = token.actor.abilities.con.mod + 5;
    await token.actor.createEmbeddedDocuments("Item",[effectdata]);
    }
}