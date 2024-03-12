const mainPCs = game.folders.getName("AV PCs").contents;
const testingFolder = game.folders.getName("TESTING");

for (const a of mainPCs) {
    
    const testingName = 'Testing ' + a.prototypeToken.name;
    const testingActor = game.actors.getName(testingName);
    const testingID = testingActor.id
    
    const clone = a.clone({
        name: testingName,
        folder: testingFolder.id 
    }).toObject()
    clone.items = clone.items.filter(i=> !(['effect', 'condition'].includes(i.type)));
    clone.system.attributes.hp.value = a.hitPoints.max;

    const updateoptions = {
        diff: false, 
        recursive: false 
    };
    console.warn(await testingActor.update(clone,updateoptions));         
}