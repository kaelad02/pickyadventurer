Hooks.once("init", () => {
  console.log("Hello world, Picky Adventurer here");
})

Hooks.on("preImportAdventure", (adventure, importOptions, toCreate, toUpdate) => {
  if (importOptions.pickyadventurer) {
    console.log("Picky Adventurer options are present");
  } else {
    console.log("Picky Adventurer options are NOT presetnt");

    // show dialog then import again
    console.log("pretending to show dialog, then importing again");
    importOptions.pickyadventurer = {};
    adventure.import(importOptions);
  }

  return false;
});
