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

function generateSkillOptions(actor) {
    const currInit = actor.system.attributes.initiative.statistic;
    let t = 'perception'==currInit?'yes':'no';

    let out = `<option value="perception" selected>${'perception'==currInit?"<strong>":""}Perception${'perception'==currInit?"</strong>":""}</option>\n`;
    const askills = Object.entries(actor.skills).sort();
    
    for (const [slug,object] of askills) {
        out += `<option value="${slug}">${slug==currInit?"<strong>":""}${object.label}${slug==currInit?"</strong>":""}</option>\n`;
    }

    return out;
}

async function setInitSkill(actor, skillname='perception') {
    return await actor.update({
        'system.attributes.initiative.statistic': skillname
    });        
}
async function submitCallback(html) {
    let actor = fromUuidSync(html[0].querySelector('#tokenUUID').value).actor
    let skill = html[0].querySelector('#init-skill').value;
    return await actor.update({
        'system.attributes.initiative.statistic': skill
    });   
}
for (const token of tokens) {
    const dData = {
      title: `Set Initiative Skill for ${token.name}`,
      content: `
        <form>
          <div class="form-group">
            <select id="init-skill" name="init-skill">
                ${generateSkillOptions(token.actor)}
            </select>
            <input type="hidden" id="tokenUUID" name="tokenUUID" value="${token.document.uuid}" />
          </div>
        </form>
        `,
      buttons: {
        yes: {
          icon: "<i class='fas fa-check'></i>",
          label: `Apply Changes`,
          callback:  submitCallback,
        },
        no: {
          icon: "<i class='fas fa-times'></i>",
          label: `Cancel Changes`
        },
      },
      default: "yes", 
    }

    const response = new Dialog(dData).render(true);
}