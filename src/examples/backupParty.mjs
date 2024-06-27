async function backupParty({
  party = null,
  pack = null,
  keepId = true,
  overwrite = false,
  unlock = false,
  backupCount = 3,
} = {}) {
  const FUNC = "backupParty";
  let packID = (providedPack = "");
  const now = new Date();
  //party can be an actor ID, a party name, or a party document reference
  if (typeof party === "string") {
    const providedParty = party;
    party = fromUuidSync(party) ?? game.actors.get(party) ?? game.actors.getName(party);
    if (!party) {
      return !ui.notifications.error(
        `${FUNC}: provided party "${providedParty}" not a valid ID or name in this world.`
      );
    }
  }
  if (!(party instanceof Actor) || party.type !== "party") {
    console.error(`${FUNC}: Provided party variable: `, providedParty);
    return !ui.notifications.error(
      `${FUNC}: provided party reference resolved to "${party?.name}" (${party.uuid}), not a party.`
    );
  }
  //pack can, similar to party, be a pack ID, pack name, or CompendiumCollection.
  if (typeof pack === "string") {
    providedPack = pack;
    pack = game.packs.get(providedPack);
    pack ??= game.packs.find((p) => p.metadata.label === providedPack);

    if (!pack) return !ui.notifications.error(`${FUNC}: provided pack "${providedPack}" not found.`);

    packID = pack.collection;
  } else if (pack instanceof CompendiumCollection) {
    if (pack.documentName !== "Actor")
      return !ui.notifications.error(
        `${FUNC}: Provided pack "${pack.metadata.label}" (${pack.collection}) is not an Actor compendium (${pack.documentName})`
      );
    packID = pack.collection;
  } else {
    //only bother logging pack if provided
    if (pack !== null) console.error(`${FUNC}: Provided pack variable: `, pack);
    return !ui.notification.error(`${FUNC}: no valid target pack provided for backup.`);
  }

  if (pack.documentName !== "Actor")
    return !ui.notifications.error(
      `${FUNC}: provided pack "${pack.metadata.label}" (${packID}) is not an Actor compendium`
    );

  if (pack.locked) {
    if (unlock) {
      await pack.configure({ locked: false });
    } else {
      return !ui.notifications.error(`${FUNC}: provided pack "${pack.metadata.label}" (${packID}) is locked.`);
    }
  }
  const displayTime = (date) => date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const folders = pack.folders;
  let existingBackupFolders = folders
    .filter((f) => f.flags?.world?.backupPartyID === party.id)
    .sort((a, b) => a.flags.world.partyBackupTime - b.flags.world.partyBackupTime);

  if (existingBackupFolders.length > backupCount) {
    const difference = existingBackupFolders.length - backupCount;
    const lastAllowed = existingBackupFolders.at(-(difference + 1));
    const lastAllowedSavedTime = lastAllowed.flags.world.backupPartyTime;
    const toDiscardIDs = existingBackupFolders.slice(-difference).map((f) => f.id);
    const content = `<h2>Too Many Backups</h2>More backups found than specificied allowed backup count (${backupCount}).<br />
Delete oldest ${difference} backup(s), leaving the most recent as being from ${displayTime(
      new Date(lastAllowedSavedTime)
    )}?`;
    const overageResponse = await Dialog.confirm({
      title: `Delete Backups Beyond Specified Count?`,
      content,
    });
    if (!overageResponse)
      return !ui.notifications.info("Backup aborted (chose not to delete backups beyond specified count limit).");

    await Folder.deleteDocuments(toDiscardIDs, {
      deleteSubfolders: true,
      deleteContents: true,
      pack: packID,
    });
    //update our folder list after deletions
    existingBackupFolders = existingBackupFolders.filter((f) => !toDiscardIDs.includes(f.id));
  }
  
  if (existingBackupFolders.length === backupCount) {
    const lastFolder = existingBackupFolders.at(-1);
    const lastSavedTime = lastFolder.flags.world.backupPartyTime;
    if (!overwrite) {
      const deleteResponse = await Dialog.confirm({
        title: `Delete Oldest Backup?`,
        content: `<h2>Backup count (${backupCount}) reached. </h2>
                  Delete oldest backup for: <br /> 
                  <strong>${party.name}</strong> (saved ${displayTime(new Date(lastSavedTime))})?`,
      });
      if (!deleteResponse)
        return !ui.notifications.info("Backup aborted (backup count reached, chose not to delete oldest).");
    }
    // if overwrite = true, or we got permission, delete the oldest backup
    await lastFolder.delete({ deleteSubfolders: true, deleteContents: true });
  }

  const firstSort = existingBackupFolders[0]?.sort ?? -CONST.SORT_INTEGER_DENSITY;
  const newFolder = await Folder.create(
    {
      name: `Backup: ${party.name} (${displayTime(now)})`,
      type: "Actor",
      flags: {
        world: {
          backupPartyName: party.name,
          backupPartyID: party.id,
          backupPartyTime: now.getTime(),
        },
      },
      sort: firstSort - CONST.SORT_INTEGER_DENSITY,
    },
    { pack: packID }
  );

  //if we just do {members} = party we get reference weirdness
  const members = party.system.details.members.map((m) => fromUuidSync(m.uuid));
  members.push(party);

  const creations = members.map((m) => {
    const data = m.toObject();
    if (typeof data.flags !== "object") data.flags = {};
    data.flags.world ??= {};
    data.flags.world.backupPartyOriginalID = m.id;
    data.folder = newFolder.id;
    return data;
  });

  const createOptions = {
    pack: packID,
    keepId: backupCount === 1 && keepId, // only save with original IDs if we're not going to get conflicts
  };
  const created = await Actor.createDocuments(creations, createOptions);

  if (pack.sortingMode === "a") pack.toggleSortingMode();
  await pack.render(true);

  return {
    folder: newFolder,
    created,
  };
}

const out = await backupParty({
  pack: "esheyw-transfer.local-pf2e-actors2",
  party: "xxxPF2ExPARTYxxx",
  unlock: true,
  backupCount: 2,
});
console.warn({ out });