const pack = game.packs.get('esheyw-transfer.local-macros');
const docs = await pack.getDocuments();
// console.warn(docs)
const outerfolder = game.folders.getName('Local Macros')
// console.warn(outerfolder)

function extractMacros(folder) {
    const macros = [];
    if (folder.children) {
        for (f of folder.children) {
            // console.warn(f)
            macros.push(...extractMacros(f.folder))
        }
    }
    if (folder?.contents) {
        macros.push(...folder.contents)
    }
    return macros;
}
importedMacros = extractMacros(outerfolder);
console.warn('superfluous macros: ', out.filter(e=>!docs.find(d=>d.name===e.name)))
for (cMacro of docs) {
    const imported = importedMacros.find(m=>m.name===cMacro.name) 
    if (!imported) {
        console.warn(`No imported macro "${cMacro.name}"`);
        continue;
    }
    if (cMacro.command !== imported.command) {
        console.warn(`${imported.name} is different from its compendium counterpart`)
    }
}