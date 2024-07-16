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
      width: 480,
      height: "auto",
    },
    form: {
      handler: this.#onSubmitForm,
      closeOnSubmit: true,
    },
    actions: {
      addAll: this.#onAddAll,
      removeAll: this.#onRemoveAll,
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
    const allFolders = [];
    if (this.toCreate.Folder) allFolders.push(...this.toCreate.Folder);
    if (this.toUpdate.Folder) allFolders.push(...this.toUpdate.Folder);

    return Object.entries(toImport).map(([docType, docs]) => {
      const config = CONFIG[docType];
      const cls = getDocumentClass(docType);

      // Get a tree represntation of the docs in their folders
      const tree =
        docType === "Folder"
          ? this.#buildTreeForFolders(docs)
          : this.#buildTree(docType, docs, allFolders);

      // Flatten the folders to be used as select optgroups
      const groups = [];
      const fillGroups = (node, prefix) => {
        if (node.folder) {
          groups.push(`${prefix}${node.folder.name}`);
          prefix += `${node.folder.name} — `;
        }
        node.children.forEach((c) => fillGroups(c, prefix));
      };
      fillGroups(tree, "");

      // Build the list of documents for select options
      const options = [];
      const fillOptions = (node, prefix) => {
        let group = undefined;
        if (node.folder) {
          group = `${prefix}${node.folder.name}`;
          prefix += `${node.folder.name} — `;
        }
        node.entries.forEach((e) => {
          const option = { value: e._id, label: e.name };
          if (group) option.group = group;
          options.push(option);
        });
        node.children.forEach((c) => fillOptions(c, prefix));
      };
      fillOptions(tree, "");

      return {
        id: docType,
        icon: config.sidebarIcon,
        label: game.i18n.localize(cls.metadata.labelPlural),
        options,
        groups,
      };
    });
  }

  #buildTree(docType, docs, allFolders) {
    // Get the folders used by the documents
    const folders = allFolders.filter((f) => f.type === docType);

    const createNode = (folder) => ({ folder, children: [], entries: [] });
    const fillFolder = (folder, depth) => {
      const node = createNode(folder);
      // traverse the child folders
      if (depth <= CONST.FOLDER_MAX_DEPTH) {
        node.children = folders
          .filter((f) => f.folder === folder._id)
          .map((f) => fillFolder(f, depth + 1))
          .filter((node) => node !== null);
      }
      // find documents in this folder
      node.entries = docs.filter((doc) => doc.folder === folder._id);
      // only return node if it's not empty, we don't want to show empty folders
      return node.children.length || node.entries.length ? node : null;
    };

    // build root node
    const tree = createNode(null);
    tree.children = folders
      .filter((f) => !f.folder)
      .map((f) => fillFolder(f, 1))
      .filter((node) => node !== null);
    tree.entries = docs.filter((d) => !d.folder);

    return tree;
  }

  /**
   * Special handling for folders, group by document type rather than the normal tree
   */
  #buildTreeForFolders(docs) {
    // organize the folders by type
    const byType = docs.reduce((obj, folder) => {
      if (!obj[folder.type]) obj[folder.type] = [];
      obj[folder.type].push(folder);
      return obj;
    }, {});

    // make fake folders to group by type
    const children = Object.entries(byType).map(([docType, folders]) => {
      const cls = getDocumentClass(docType);
      return {
        folder: { name: game.i18n.localize(cls.metadata.labelPlural) },
        children: [],
        entries: folders,
      };
    });

    return { folder: null, children, entries: [] };
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

  /**
   * Actions
   */

  static #onAddAll(event, actionButton) {
    event.stopPropagation();

    // select each option
    const multiSelect = actionButton.closest("fieldset").querySelector("multi-select");
    Object.keys(multiSelect._choices).forEach((value) => multiSelect.select(value));
  }

  static #onRemoveAll(event, actionButton) {
    event.stopPropagation();

    // unselect each option
    const multiSelect = actionButton.closest("fieldset").querySelector("multi-select");
    Object.keys(multiSelect._choices).forEach((value) => multiSelect.unselect(value));
  }
}
