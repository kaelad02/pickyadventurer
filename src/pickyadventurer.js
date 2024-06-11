Hooks.once("init", () => {
  console.log("Hello world, Picky Adventurer here");
});

Hooks.on("preImportAdventure", (adventure, importOptions, toCreate, toUpdate) => {
  if (importOptions.pickyadventurer) {
    console.log("Picky Adventurer options are present");
  } else {
    console.log("Picky Adventurer options are NOT presetnt");

    // show dialog then import again
    new Picker({ importOptions, toCreate, toUpdate }).render(true);
    /* console.log("pretending to show dialog, then importing again");
    importOptions.pickyadventurer = {};
    adventure.import(importOptions); */
  }

  return false;
});

/* Hooks.once("ready", () => {
  new Picker({}).render(true);
}); */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
class Picker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options) {
    super(options);

    this.importOptions = options.importOptions;
    this.toCreate = options.toCreate;
    this.toUpdate = options.toUpdate;
  }

  static DEFAULT_OPTIONS = {
    classes: ["pickyadventurer"],
    window: {
      title: "TODO",
      contentClasses: ["standard-form"],
    },
    position: {
      width: 400,
      height: "auto",
    },
    form: {
      closeOnSubmit: true,
    },
    actions: {
      // TODO
    },
  };

  static PARTS = {
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    create: {
      template: "modules/pickyadventurer/templates/picker-part-list.hbs",
      scrollable: [".scrollable"],
    },
    update: {
      template: "modules/pickyadventurer/templates/picker-part-list.hbs",
      scrollable: [".scrollable"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  tabGroups = {
    header: "create",
  };

  async _prepareContext(_options) {
    return {
      tabs: this.#getTabs(),
    };
  }

  async _preparePartContext(partId, context) {
    switch (partId) {
      case "footer":
        context.buttons = this.#getFooterButtons();
        break;
      case "create":
        context.tab = context.tabs.create;
        context.types = this.#getDocumentList(this.toCreate);
        break;
      case "update":
        context.tab = context.tabs.update;
        context.types = this.#getDocumentList(this.toUpdate);
        break;
    }
    console.log(`part ${partId} .types`, context.types);
    return context;
  }

  #getTabs() {
    const tabs = {
      create: { id: "create", group: "header", icon: "fa-solid fa-plus", label: "Create" },
      update: { id: "update", group: "header", icon: "fa-solid fa-pen-to-square", label: "Update" },
    };
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id;
      v.cssClass = v.active ? "active" : "";
    }
    return tabs;
  }

  #getFooterButtons() {
    return [{ type: "submit", icon: "fa-solid fa-download", label: "ADVENTURE.ImportSubmit" }];
  }

  #getDocumentList(toImport) {
    return Object.entries(toImport).map(([docType, docs]) => {
      const config = CONFIG[docType];
      const cls = getDocumentClass(docType);
      return {
        id: docType,
        icon: config.sidebarIcon,
        label: game.i18n.localize(cls.metadata.labelPlural),
        list: docs.map((doc) => ({ id: doc._id, name: doc.name })),
      };
    });
  }
}
