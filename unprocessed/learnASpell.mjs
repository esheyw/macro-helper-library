if (canvas.tokens.controlled.length > 1) return ui.notifications.error("Please select only a single token.");
const token = canvas.tokens.controlled[0] ?? game.user.character?.getActiveTokens()[0];
if (!token) return ui.notifications.warn("Please select exactly one token or assign yourself a character.");
const actor = token.actor;

const LEVELS = [
  {cost:2,dc:15},
  {cost:6,dc:18},
  {cost:16,dc:20},
  {cost:36,dc:23},
  {cost:70,dc:26},
  {cost:140,dc:28},
  {cost:300,dc:31},
  {cost:650,dc:34},
  {cost:1500,dc:36},
  {cost:7000,dc:41},
]
const style = `
<style>
.learn-a-spell {
  height: auto !important;
}
.learn-a-spell .drop-zone {
  width: 200px;
  height: 50px;
  text-aligh: center;
}
.learn-a-spell .spell-info-container {
  display: none;
}
.learn-a-spell .spell-info-container img {
  width: 50px;
  height: 50px;
}
.learn-a-spell .spell-info-container button {
  
}
.spellcastingEntryContainer {
  transition: all 400ms ease-in-out;
  height: auto;
}
.hide {
  height: 0;
  transition: all 0s ease-in-out;
}
</style>`;
const template = `
<form>
    <div class="form-group">        
        <div class="drop-zone">
            <i class="fa-solid fa-fw fa-info-circle" data-tooltip="Drop a spell item or scroll here."></i>
            <span class="drop-text">Drop Here</span>
        </div>
        <fieldset class="spell-info-container">
          <legend>Name</legend>
          <img src="systems/pf2e/icons/default-icons/spell.svg" /><button type="button" id="reselect">Reselect</button><br />
          <label for="learn-dc">DC:</label><input type="text" name="learn-dc" id="learn-dc" value="15"><br />
          <label for="spell-name">Cost:</label><input type="text" name="learn-cost" id="learn-cost" value="2gp">
          <label for="spellcastingEntryToggle">Add to spellcasting entry?</label>
          <input name="spellcastingEntryToggle" id="spellcastingEntryToggle" type="checkbox">
          <div class="spellcastingEntryContainer hide">
            <label for="spellcastingEntrySelect">
            <select id="spellcastingEntrySelect" name="spellcastingEntrySelect">
            {{#each spellcastingEntries as |entry|}}
              <option value="{{entry.id}}">{{entry.name}}</option>
            {{/each}}
            </select>
          </div>          
        </fieldset>
    </div>                
</form> 
`;
const templateData = {
  spellcastingEntries: actor.itemTypes.spellcastingEntry
  .filter(e => e.system.prepared.value === 'prepared')
  .sort((a,b) => a.spells.size > b.spells.size ? -1 : a.spells.size < b.spells.size ? 1 : 0)
  .map(e => {return {
    id: e._id,
    name: e.name
  }}),
};
const form = (Handlebars.compile(template))(templateData);

async function dropCallback(event) {
  const thisApp = ui.windows[event.target.closest('.dialog').dataset.appid]
  const dropdata = JSON.parse(event.dataTransfer?.getData("text/plain"));
  const dropTextSpan = this.querySelector('.drop-text');
  if (!dropdata || dropdata.type !== 'Item') {
    dropTextSpan.innerHTML = 'Invalid spell or spell-containing object!';
    return;
  }
  const spell = await fromUuid(dropdata.uuid);
  if (!spell) {
    return ui.notifications.error(`Couldn't retrive item with UUID ${dropdata.uuid}`);
  }
  const dropZone = this;
  const spellInfo = this.parentElement.parentElement.querySelector('.spell-info-container')
  const spellData = (spell.type === 'consumable' && spell.system?.spell) ? spell.system.spell : spell.toObject();
  console.warn(spellData)
  const {cost, dc} = LEVELS[spellData.system.level.value - 1];
  spellInfo.querySelector('img').src = spellData.img;
  spellInfo.querySelector('legend').innerHTML = `${spellData.name} (Rank ${spellData.system.level.value})`;
  spellInfo.querySelector('#learn-dc').value = dc;
  spellInfo.querySelector('#learn-cost').value = `${cost}gp`;
  spellInfo.style.display = 'block';
  dropZone.style.display = 'none';
  // thisApp.setPosition();
  console.warn(thisApp);
}
function renderCallback(html) {
  const dropZone = html[0].querySelector('div.drop-zone');
  dropZone.addEventListener('drop', dropCallback);
  
  const reselect = html[0].querySelector('#reselect');
  reselect.addEventListener('click', reselectCallback);
  
  const spellcastingEntryToggle = html[0].querySelector('input#spellcastingEntryToggle');
  spellcastingEntryToggle.addEventListener('change', (event) => {
    console.warn(event.currentTarget.parentElement.querySelector('.spellcastingEntryContainer').classList.toggle('hide'))//.classList.toggle('hide');
  });
  
  const submit = html[2].querySelector('button.submit');
  submit.disabled = true;
}
function reselectCallback(event) {
  const form = this.closest('form');
  form.querySelector('.spell-info-container').style.display = 'none';
  form.querySelector('.drop-zone').style.display = 'block';
}
const dialogData = {
  title: `Learn a Spell`,
  content: style + form,
  render: renderCallback,
  buttons: {      
    submit: { 
      label: "Submit", 
      // callback: effectcallback, 
      icon: '<i class="fas fa-check"></i>' 
    },            
    cancel: { 
      label: "Cancel", 
      icon: '<i class="fas fa-times"></i>' 
    }
  },
  default: 'submit',
}    
const dialogOptions = {
  classes: ["learn-a-spell"],
  // jQuery:false;
}
const response = await Dialog.wait(dialogData, dialogOptions);
console.warn(response);