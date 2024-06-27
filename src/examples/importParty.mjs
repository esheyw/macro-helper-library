function checkIfBackup(source) {
  let test;
  if (source instanceof Folder) test = source;
  else if (source.folder) test = source.folder;
  return !!test?.flags?.world?.backupPartyID;  
}
function checkIfTypeActor(source) {
  if (source instanceof CompendiumCollection) return source.documentName === 'Actor';
  if (source instanceof Folder) return source.type === 'Actor';
  return false;
}
function getActorPack(source) {  
  if (source instanceof CompendiumCollection) return source;
  let pack;
  if (!(pack = game.packs.get(source))) {
    if (!(pack = game.packs.find(p => p.metadata.label === source))) {
      return !ui.notifications.error(`Pack ${source} not found.`);
    }
    if (pack.documentName !== 'Actor') return !ui.notifications.error(`Provided pack is not an Actor compendium.`);
  }
  return pack;
}
function getBackupDocument(source, {pack = null, type = null}={} ) {
  if (source instanceof Document) return source;
  if (source.length === 16 && typeof type === 'string') {

    pack = getActorPack(pack);
    if (!pack) return !ui.notifications.error(``)
  }
}
const displayTime = (date) => date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
function iSDRenderCallback(html) {
  const modeToggle = html.querySelector('#create-new');
  modeToggle.addEventListener('change', (ev) => {
    console.warn(ev.currentTarget.closest('form').querySelector('div#conflict-options').classList.toggle('hide-group'))
  })
}
async function importSummaryDialog({memberMap, party}={}) {
  let template = `
  <style>
  .party-backup-utility {
    
  }
  .party-backup-utility th.name {
    width:35%
  }
  .party-backup-utility th.time {
    width:15%
  }
  .party-backup-utility td.time.newer {
    color: var(--adjusted-higher);
  }
  .party-backup-utility td.time:not(.newer){
    color: var(--adjusted-lower)
  }
  .party-backup-utility label {
    flex: 2;
    line-height: var(--form-field-height);
  }
  .party-backup-utility div.hide-group {
    display: none;
  }
  </style>
  <h2>Import Summary for <strong>{{partyName.backup}}</strong>:</h2>
  <table>
    <thead>
      <tr>
        <th class="name">Backup Member</th>
        <th class="time">Last Modified</th>
        <th class="name">World Member</th>
        <th class="time">Last Modified</th>
      </tr>
    </thead>
    <tbody>
    {{#each memberMap as |row|}}
      <tr>
        <td class="name">{{row.backup.name}}</td>
        <td class="time{{#unless row.worldNewer}} newer{{/unless}}">{{row.backupTime}}</td>
        <td class="name">{{row.world.name}}</td>
        <td class="time{{#if row.worldNewer}} newer{{/if}}">{{row.worldTime}}</td>
      </tr>
    {{/each}}
    </tbody>
  </table>
  <form>
    <div class="form-group">
      <div class="flexrow">
        <label for="keepId">Party Import Mode:</label>
        <div class="form-fields">
          <select id="create-new" data-Dtype="Boolean" name="create-new">
              <option value="false" selected>Import Over Existing</option>
              <option value="true">Create New Party</option>
            </select> 
        </div>
      </div>
    </div>
    <div class="form-group" id="conflict-options">
      <fieldset>
        <legend>Conflict Options</legend>      
        <div class="flexrow">
          <label for="backup-unique-import">Import actors only found in the backup:</label>
          <div class="form-fields">          
            <input type="checkbox" id="backup-unique-import" name="backup-unique-import" checked>
          </div>
        </div>
        <div class="flexrow">
          <label for="world-unique-import">Delete actors only found in the world:</label>
          <div class="form-fields">
            <input type="checkbox" id="world-unique-delete" name="world-unique-delete">
          </div>
        </div>
        <div class="flexrow">
          <label>Merge behaviour for actors found in both:</label>
          <div class="form-fields">
            <select id="matches-import" name="matches-import">
              <option value="ow" selected>Overwrite If Newer</option>
              <option value="owf">Overwrite Always</option>
              <option value="no">Do Not Import</option>
            </select>      
          </div>
        </div>
      </fieldset>
    </div>
  </form>
  `;
  let templateData = {
    partyNames: {
      backup: party.name,
      world: worldParty.name
    }
    memberMap,
  }
  let content = (Handlebars.compile(template))(templateData);

  return await Dialog.wait({
    title: `Party Import Summary`,
    content,
    close: () => false,    
    buttons: {
      confirm: {
        label: `Import`,
        icon: `<i class="fa-solid fa-file-import"></i>`,
        callback: html => new FormDataExtended(html.querySelector("form")).object,
      },
      cancel: {
        label: `Cancel`,
        icon: `<i class="fa-solid fa-times"></i>`,
        callback: () => false
      }
    },
    default: 'confirm',
    render: iSDRenderCallback
  }, {
      width: 600,
      jQuery:false,
      classes: ["party-backup-utility"]
    });
}

async function importParty({ source = null,  keepId = true , overwrite = true} = {}) {
  const FUNC = "importParty";
  const abort = (reason='No Reason Given',type='error')=> !ui.notifications[type](`${FUNC}: Aborted | ${reason}`);
  let sourceParty, sourceFolder,  providedSource, providedPack;
  if (!(source instanceof Folder) || !source?.flags?.world?.backupPartyID) return !ui.notifications.error(`${FUNC}: Provided source is not a valid backup folder`);
  const sourcePack = game.packs.get(source.pack);
  const folderContents = await sourcePack.getDocuments({
    folder__in: source.contents.map((a) => a.folder),
  });
  const parties = folderContents.filter(a => a.type === 'party');
  if (parties.length !== 1) return abort('Bad source: multiple parties detected');
  const [party] = parties;
  const members = folderContents.filter(a=> a !== party);
  const partyOriginalID = party.flags.world.backupPartyOriginalID;
  const worldParty = game.actors.get(partyOriginalID);
  if (worldParty) {
    if (keepId) {
      const worldMembers = [...worldParty.members];
      const partyTimeDiff = worldParty._stats.modifiedTime - party._stats.modifiedTime;
      const memberMap = members.concat(worldMembers)
        .reduce((acc,curr) => {
          let existing,currID;
          //if backupMember
          if (currID = curr.getFlag('world','backupPartyOriginalID')) {
            //if corresponding worldMember
            if (existing = acc.find(a=>a?.world?.id === currID)) {
              existing.backup = curr;
              existing.backupTime = displayTime(curr._stats.modifiedTime);
              existing.worldNewer = existing.world._stats.modifiedTime > curr._stats.modifiedTime;
            } else {
              acc.push({
                world: null,
                worldTime: null,
                backup: curr,
                backupTime: displayTime(curr._stats.modifiedTime),
                worldNewer: false
              });
            }        
          } else { 
            if (existing = acc.find(a => a.backup?.getFlag('world','backupPartyOriginalID') === curr.id)) {
              existing.world = curr;
              existing.worldTime = displayTime(curr._stats.modifiedTime);
              existing.worldNewer = existing.backup._stats.modifiedTime < curr._stats.modifiedTime;
            } else {
              acc.push({
                world: curr,
                worldTime: displayTime(curr._stats.modifiedTime),
                backup: null,
                backupTime: null,
                worldNewer: true
              });     
            }   
          }
          return acc;
        },[])
        .sort((a,b) => {
          if (a.backupTime && a.worldTime) {
            if (b.backupTime && b.worldTime) return a.backup.name.localeCompare(b.backup.name);
            return -1; //put all match entries above uniques
          }
          //sort by time, but backups on top
          if (a.backupTime) return b.backupTime ? b.backupTime - a.backupTime : -1; 
          return b.worldTime - a.worldTime;
        });  
      const summaryResponse = await importSummaryDialog({memberMap, party});
      
      if (!mismatchResponse) return abort('Party Size Mismatch','info');
      

      if (!overwrite) {
        const deleteResponse = await Dialog.confirm({
          title: `Overwrite Existing Party?`,
          content: `Attempting to backup, but backup count (${backupCount}) reached. <br />
                    Delete oldest backup for: <br /> 
                    <strong>${party.name}</strong> (saved ${displayTime(new Date(lastSavedTime))})?`,
        });
        if (!deleteResponse)
          return !ui.notifications.info("Backup aborted (backup count reached, chose not to delete oldest).");
      }
    }

  }
  // const extractFromParty = (party) => {
  //   const sourcePack = game.packs.get(party.pack);
  //   const sourceParty = source;
  //   if (
  //     !sourceParty.folder ||
  //     !sourceParty.folder?.flags?.world?.backupPartyID
  //   ) {
  //     ui.notifications.error(
  //       `${FUNC}: Provided source party was not produced by backupParty™.`
  //     );
  //     return null;
  //   }
  //   const sourceFolder = sourceParty.folder;
  //   return { sourcePack, sourceParty, sourceFolder };
  // // };
  
  // if (typeof source === "string") {
  //   providedSource = source;
  //   source = await fromUuid(source);
  //   if (!source) {
  //     if (!pack) {
  //       // if it's not a UUID, we need a pack reference to do anything else
  //       return !ui.notifications.error(`${FUNC}: provided source string "${providedSource}" is not a resolveable UUID, and no pack was provided.`);
  //     }
  //     if (typeof pack === "string") {
  //       sourcePack = game.packs.get(pack);
  //       if (!sourcePack) {
  //         return !ui.notifications.error(`${FUNC}: provided pack string "${providedPack}" not found.`);
  //       }
  //     } else if (pack instanceof CompendiumCollection) {
  //       if (pack.documentName !== "Actor")
  //         return !ui.notifications.error(
  //           `${FUNC}: Provided pack "${pack.metadata.label}" (${pack.collection}) is not an Actor compendium (${pack.documentName})`
  //         );
  //       sourcePack = pack;
  //     }
  //   }

  //   if (source && !source.pack) {
  //     ui.notifications.error(`${FUNC}: Provided source is not inside a compendium.`);
  //     return null;
  //   }
  //   if (source instanceof Actor && source.type === "party") {
  //     const maybe = extractFromParty(source);
  //   }
  // } else if (source instanceof Folder) {
  //   if (!source.pack) {
  //     ui.notifications.error(`${FUNC}: Provided source folder is not inside a compendium.`);
  //     return null;
  //   }
  //   sourcePack = game.packs.get(source.pack);

  //   if (source.type !== "Actor" || sourcePack.documentName !== "Actor") {
  //     ui.notifications.error(`${FUNC}: Provided source folder is not inside an Actor compendium.`);
  //     return null;
  //   }
  //   if (!source?.flags?.world?.backupPartyID) {
  //     ui.notifications.error(`${FUNC}: Provided source folder was not produced by backupParty™.`);
  //     return null;
  //   }
  // }
  
}

const target = await fromUuid("Compendium.esheyw-transfer.local-pf2e-actors2.Folder.h0WX4icDj811MdP0");
const out = await importParty({
  source: target,
});
