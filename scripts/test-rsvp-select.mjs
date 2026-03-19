import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const rootDir = path.resolve(process.cwd());
const scriptPath = path.join(rootDir, "script.js");
const source = fs
  .readFileSync(scriptPath, "utf8")
  .replace(/\ninitPage\(\)\.catch\(\(error\) => \{\n  console\.error\("Page initialization failed\.", error\);\n\}\);\s*$/m, "\n");

function createSelectElement() {
  const element = {
    _innerHTML: "",
    options: [],
    value: "",
    disabled: false,
    required: true,
    selectedIndex: -1
  };

  Object.defineProperty(element, "innerHTML", {
    get() {
      return element._innerHTML;
    },
    set(value) {
      element._innerHTML = String(value);
      element.options = [...element._innerHTML.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(
        (match) => ({
          value: match[1],
          textContent: match[2]
        })
      );
      element.selectedIndex = element.options.findIndex((option) => option.value === element.value);
    }
  });

  Object.defineProperty(element, "selectedOptions", {
    get() {
      if (element.selectedIndex < 0 || element.selectedIndex >= element.options.length) {
        return [];
      }

      return [element.options[element.selectedIndex]];
    }
  });

  return element;
}

function createRadio(value, checked = false) {
  return {
    value,
    checked,
    disabled: false,
    addEventListener() {}
  };
}

function evaluateScript() {
  const groupSelect = createSelectElement();
  const existingGroupField = { hidden: false };
  const newGroupField = { hidden: true };
  const newGroupInput = { required: false, disabled: true, value: "" };
  const submitButton = { disabled: false, textContent: "Send RSVP" };
  const form = {
    querySelector(selector) {
      if (selector === 'button[type="submit"]') {
        return submitButton;
      }

      if (selector === 'input[name="new_group_name"]') {
        return newGroupInput;
      }

      return null;
    },
    addEventListener() {}
  };

  const groupModeInputs = [createRadio("existing", true), createRadio("create", false)];

  const documentStub = {
    body: { dataset: {} },
    getElementById(id) {
      if (id === "rsvp-form") {
        return form;
      }

      if (id === "group-slug") {
        return groupSelect;
      }

      return null;
    },
    querySelector(selector) {
      if (selector === "[data-new-group-field]") {
        return newGroupField;
      }

      if (selector === "[data-existing-group-field]") {
        return existingGroupField;
      }

      if (selector === 'input[name="group_mode"]:checked') {
        return groupModeInputs.find((input) => input.checked) || null;
      }

      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="group_mode"]') {
        return groupModeInputs;
      }

      return [];
    }
  };

  const context = {
    console,
    document: documentStub,
    window: {
      SUPABASE_CONFIG: null,
      location: { href: "http://localhost/rsvp.html" },
      supabase: null,
      setInterval() {},
      addEventListener() {}
    },
    URL,
    URLSearchParams,
    Blob: class {},
    FormData: class {},
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
    },
    encodeURIComponent,
    setTimeout,
    clearTimeout
  };

  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "script.js" });

  return {
    context,
    groupSelect,
    existingGroupField,
    groupModeInputs,
    newGroupField,
    newGroupInput
  };
}

function run() {
  {
    const { context, groupSelect } = evaluateScript();
    context.renderGroupOptions([
      { slug: "default", name: "Default" },
      { slug: "friends", name: "Friends" }
    ]);

    assert.equal(groupSelect.options.length, 2, "renderGroupOptions should build all options");
    assert.equal(groupSelect.value, "default", "default group should be selected when present");
  }

  {
    const { context, groupSelect } = evaluateScript();
    context.renderGroupOptions([{ slug: "friends", name: "Friends" }]);

    assert.equal(groupSelect.options.length, 1, "single option list should still render");
    assert.equal(groupSelect.value, "friends", "first group should be selected when default is missing");
  }

  {
    const { context, groupSelect } = evaluateScript();
    groupSelect.value = "palermitani";
    context.renderGroupOptions([
      { slug: "default", name: "Default" },
      { slug: "palermitani", name: "Palermitani" }
    ]);

    assert.equal(
      groupSelect.value,
      "palermitani",
      "existing selection should be preserved when still available"
    );
  }

  {
    const {
      context,
      groupSelect,
      existingGroupField,
      groupModeInputs,
      newGroupField,
      newGroupInput
    } = evaluateScript();

    groupModeInputs[0].checked = true;
    groupModeInputs[1].checked = false;
    context.syncGroupMode();

    assert.equal(groupSelect.disabled, false, "existing group mode should keep select enabled");
    assert.equal(groupSelect.required, true, "existing group mode should keep select required");
    assert.equal(existingGroupField.hidden, false, "existing group field should stay visible");
    assert.equal(newGroupField.hidden, true, "new group field should stay hidden in existing mode");
    assert.equal(newGroupInput.required, false, "new group input should not be required in existing mode");
  }

  {
    const {
      context,
      groupSelect,
      existingGroupField,
      groupModeInputs,
      newGroupField,
      newGroupInput
    } = evaluateScript();

    groupModeInputs[0].checked = false;
    groupModeInputs[1].checked = true;
    context.syncGroupMode();

    assert.equal(existingGroupField.hidden, true, "create group mode should hide the existing group field");
    assert.equal(groupSelect.disabled, true, "create group mode should disable group select");
    assert.equal(groupSelect.required, false, "create group mode should remove required from group select");
    assert.equal(newGroupField.hidden, false, "new group field should become visible in create mode");
    assert.equal(newGroupInput.required, true, "new group input should become required in create mode");
  }

  console.log("RSVP select logic tests passed.");
}

run();
