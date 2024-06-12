const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

Hooks.on("preImportAdventure", (adventure, importOptions, toCreate, toUpdate) => {
  if (importOptions.pickyadventurer) {
    // found the Picker options, filter the toCreate and toUpdate objects
    _filterImport(importOptions.pickyadventurer.toCreateIds, toCreate);
    _filterImport(importOptions.pickyadventurer.toUpdateIds, toUpdate);
  } else {
    // no Picker options, show it and stop the import
    new Picker({ adventure, importOptions, toCreate, toUpdate }).render(true);
    return false;
  }
});

function _filterImport(selectedIds, documents) {
  for (const type of Object.keys(documents)) {
    const ids = selectedIds[type] ?? [];
    documents[type] = documents[type].filter((doc) => ids.includes(doc._id));
    if (documents[type].length === 0) delete documents[type];
  }
}

class Picker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options) {
    super(options);

    this.adventure = options.adventure;
    this.importOptions = options.importOptions ?? {};
    this.toCreate = options.toCreate;
    this.toUpdate = options.toUpdate;
  }

  static DEFAULT_OPTIONS = {
    classes: ["pickyadventurer"],
    tag: "form",
    window: {
      contentClasses: ["standard-form"],
    },
    position: {
      width: 400,
      height: "auto",
    },
    form: {
      handler: this.#onSubmitForm,
      closeOnSubmit: true,
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

  get title() {
    return `${game.i18n.localize("PICKER.label")}: ${this.adventure.name}`;
  }

  /**
   * Context functions for the Handlebars templates
   */

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
        context.emptyLabel = "PICKER.TABS.createEmpty";
        break;
      case "update":
        context.tab = context.tabs.update;
        context.types = this.#getDocumentList(this.toUpdate);
        context.emptyLabel = "PICKER.TABS.updateEmpty";
        break;
    }
    return context;
  }

  #getTabs() {
    const tabs = {
      create: {
        id: "create",
        group: "header",
        icon: "fa-solid fa-plus",
        label: "PICKER.TABS.create",
      },
      update: {
        id: "update",
        group: "header",
        icon: "fa-solid fa-pen-to-square",
        label: "PICKER.TABS.update",
      },
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

  /**
   * Form submission
   */

  static #onSubmitForm(event, form, formData) {
    const toCreateIds = Picker.#prepareSubmitList("create", formData);
    const toUpdateIds = Picker.#prepareSubmitList("update", formData);

    // trigger Adventure import again
    this.importOptions.pickyadventurer = { toCreateIds, toUpdateIds };
    this.adventure.import(this.importOptions);
  }

  static #prepareSubmitList(action, formData) {
    return Object.entries(formData.object)
      .filter(([key, _]) => key.startsWith(`${action}.`))
      .reduce((obj, [key, ids]) => {
        if (ids && ids.length) {
          const type = key.split(".")[1];
          obj[type] = ids;
        }
        return obj;
      }, {});
  }
}
