//Check for exactly one selected token
if (canvas.tokens.controlled.length > 1) {
  ui.notifications.warn("Please select only a single or zero token(s).");
  return;
}
function localize(key) {
   return game.i18n.localize(key);
}
class ValidatedDialog extends Dialog {
  submit(button, event) {
      if (button.label === 'Submit') {
          if (!this.element[0].querySelector('#actorID').value
           && !this.element[0].querySelector('#groupType').value) {                 
              return ui.notifications.warn('Please select something to delete!');
          }
      }
      super.submit(button, event);
  }
}

let toBeKilled = game.actors.get(canvas.tokens.controlled[0]?.actor.id);

let response = '';
if (!toBeKilled) {
  function generateOptions(filter = (f) => true) {
      let out = ``;
      const folders = game.folders.filter(f => f.type === 'Actor')
      if (folders.length) {
          out += `<optgroup label="Folders">`;
          for (const f of folders) {
              out += `<option value="${f.id}">${f.name}</option>`;
          }
          out += `</optgroup>`;
      }
  
      out += `<optgroup label="Other Groupings">`;
      for (const [type,label] of Object.entries(CONFIG.Actor.typeLabels)) {
          out += `<option value="${type}">Type: ${localize(label)}</option>`   
      }    
      out += `</optgroup>`
      return out;
  }
  function generateActors(filter = (f) => true) {
      let out = '';
      for (const [type,label] of Object.entries(CONFIG.Actor.typeLabels)) {
          const actors = game.actors.filter(a => a.type === type).filter(filter);
          if (actors.length) {
              out += `<optgroup label="${localize(label)}">`;
              for (const actor of actors) {
                  out += `<option value="${actor.uuid}">${actor.name}</option>`;
              }
              out += `</optgroup>`;
          }
      }
      return out;
  }
  const form = `
  <form>
      <div class="form-group">
          <label for="actorID">Select Actor:&nbsp;</label>
          <select id="actorID" name="actorID">
              <option id="defaultoption" value="" selected></option>
              ${generateActors()}
          </select>
      </div>
      <div class="form-group">
          <label for="groupType">Or Select Grouping:&nbsp;</label>
          <select id="groupType" name="groupType">
              <option id="defaultoption" value="" selected></option>
              ${generateOptions()}
          </select>
      </div>
      <div class="form-group">
          <label for="fdelete">Delete Folder:&nbsp;</label>
          <input type="checkbox" name="fdelete" id="fdelete" />
      </div>                  
  </form> 
  `;

  function renderCallback(html) {
      html[0].closest('.app').addEventListener('drop', dropCallback);
  }
  async function dropCallback(event) {
      const dropdata = JSON.parse(event.dataTransfer?.getData("text/plain"));
      if (!dropdata || dropdata.type !== 'Actor') {
          ui.notifications.warn('Not an Actor');
          return;      
      } 
      actor = await fromUuid(dropdata.uuid);
      if (!actor) return ui.notifications.warn(`Couldn't retrieve effect ${dropdata.uuid}`);
      this.querySelector('#actorID').value = actor.uuid;
  }
  function pickTarget(html) {    
      const formElement = html[0].querySelector('form');
      const formData = new FormDataExtended(formElement);
      return formData.toObject();
  }
  const dData = {
      title: "Select Actor to Remove",
      content: form,
      render: renderCallback,
      buttons: {      
          submit: { label: "Submit", callback: pickTarget, icon: '<i class="fas fa-check"></i>' },            
          cancel: { label: "Cancel", icon: '<i class="fas fa-times"></i>' }
      },
      default: 'submit',
  } 
  const dOpts = {
      height: "auto",
      width: "auto",
  }
  response = await ValidatedDialog.wait(dData, dOpts);
  if (response === 'cancel') return;
  toBeKilled = await fromUuid(response.actorID);
}
if (toBeKilled) {
  const cData = {
    title: `Deleting ${toBeKilled.name}`,
    content: `Are you sure you want to delete <strong>${toBeKilled.name}</strong> <em>and</em> all their associated tokens from this world?`,
    yes: () => {},
    no: () => {},
    defaultYes: false
  }
  const confirm = await Dialog.confirm(cData);
  if (confirm !== 'yes') return;
  for (const scene of game.scenes) {
      for (const token of scene.tokens) {
          if (token.actorId === toBeKilled.id) {
              token.delete();
          }
      }
  }
  toBeKilled.delete();
}
if (response.groupType) {
let cData = '';
let killfolder = '';
  
  let actors = [];
  if (Object.keys(CONFIG.Actor.typeLabels).includes(response.groupType)) {
      cData = {
        title: `Deleting All ${localize(CONFIG.Actor.typeLabels[response.groupType])}`,
        content: `Are you sure you want to delete <strong>All ${localize(CONFIG.Actor.typeLabels[response.groupType])}</strong> actors <em>and</em> all their associated tokens from this world?`,
        yes: () => {},
        no: () => {},
        defaultYes: false
      }
      actors = game.actors.filter(a => a.type === response.groupType)
  } else {
      killfolder = game.folders.find(f => f.id === response.groupType);
      cData = {
        title: `Deleting Contents of Folder ${killfolder.name}`,
        content: `Are you sure you want to delete <strong>All</strong> actors in <strong>${killfolder.name}</strong> <em>and</em> all their associated tokens from this world`,
        yes: () => {},
        no: () => {},
        defaultYes: false
      }
      if (response.fdelete) cData.content += `, as well as the folder`;
      cData.content += `?`;
      actors = killfolder.contents;
  }
  
  const confirm = await Dialog.confirm(cData);
  if (confirm !== 'yes') return;
  
  for (const a of actors) {
      for (const scene of game.scenes) {
          for (const token of scene.tokens) {
              if (token.actorId === a.id) {
                  token.delete();
              }
          }
      }
      a.delete();
  }
  if (response.fdelete && killfolder) killfolder.delete();
}