(() => {
  const app = window.desktopApp;
  const $ = (selector) => document.querySelector(selector);
  const form = $("#settings-form"); const status = $("#status"); const profiles = $("#profiles");
  const fields = {
    alwaysOnTop: $("#always-on-top"), defaultSize: $("#default-size"), minSize: $("#min-size"), maxSize: $("#max-size"), maxCompanions: $("#max-companions"),
    hoverOpacity: $("#hover-opacity"), idleSleepEnabled: $("#idle-sleep-enabled"), idleSleepMinutes: $("#idle-sleep-minutes"), startWithWindows: $("#start-with-windows"),
    shortcutsEnabled: $("#shortcuts-enabled"), shortcutAdd: $("#shortcut-add"), shortcutSettings: $("#shortcut-settings")
  };
  const say = (message, bad = false) => { status.textContent = message; status.style.color = bad ? "#ffadad" : "#a9e7bd"; };
  // IPC errors arrive as "Error invoking remote method 'x': Error: <message>"; keep only the message.
  const reason = (error) => String(error && error.message || "").replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/, "");
  const fail = (prefix, error) => { const why = reason(error); say(why ? `${prefix} ${why}` : prefix, true); };

  const showOpacity = () => { $("#hover-opacity-value").textContent = `${fields.hoverOpacity.value}%`; };
  const renderSettings = (config) => {
    const s = config.settings || config;
    fields.alwaysOnTop.checked = !!s.alwaysOnTop; fields.defaultSize.value = s.defaultSize; fields.minSize.value = s.minSize; fields.maxSize.value = s.maxSize; fields.maxCompanions.value = s.maxCompanions;
    fields.hoverOpacity.value = Math.round((s.hoverOpacity ?? 0.3) * 100); showOpacity();
    const idle = s.idleSleep || { enabled: true, minutes: 5 };
    fields.idleSleepEnabled.checked = !!idle.enabled; fields.idleSleepMinutes.value = idle.minutes; fields.idleSleepMinutes.disabled = !idle.enabled;
    fields.startWithWindows.checked = !!s.startWithWindows;
    const shortcuts = s.shortcuts || {};
    fields.shortcutsEnabled.checked = shortcuts.enabled !== false; fields.shortcutAdd.value = shortcuts.addCompanion || ""; fields.shortcutSettings.value = shortcuts.openSettings || "";
    fields.shortcutAdd.disabled = fields.shortcutSettings.disabled = !fields.shortcutsEnabled.checked;
  };
  const shortcutText = (enabled, registered) => !enabled ? "Off." : registered ? "Active." : "Not available: another app uses it, or the combination isn't valid.";
  const renderInfo = (info) => {
    $("#version").textContent = info.version;
    const updates = $("#check-updates");
    updates.disabled = !info.updatesAvailable;
    updates.title = info.updatesAvailable ? "" : "Updates are only available in the installed app.";
    $("#data-path").textContent = info.dataPath;
    // macOS: shortcuts are written with Command (⌘) instead of Control
    if (info.platform === "darwin") {
      $("#shortcut-example").textContent = "Command+Alt+Shift+A (⌘⌥⇧A)";
      fields.shortcutAdd.placeholder = "Command+Alt+Shift+A";
      fields.shortcutSettings.placeholder = "Command+Alt+Shift+S";
    }
    // Start at login: label, availability and explanation come from the platform (Windows, macOS, Linux)
    $("#autostart-label").textContent = info.autostart.label;
    fields.startWithWindows.disabled = !info.autostart.available;
    const note = $("#start-with-windows-note");
    note.hidden = !info.autostart.note;
    note.textContent = info.autostart.note || "";
    const enabled = fields.shortcutsEnabled.checked;
    for (const [id, registered] of [["#shortcut-add-status", info.shortcuts.addCompanion], ["#shortcut-settings-status", info.shortcuts.openSettings]]) {
      const element = $(id); element.textContent = shortcutText(enabled, registered); element.classList.toggle("warning", enabled && !registered);
    }
  };
  const refreshProfiles = async () => { const names = await app.listProfiles(); profiles.replaceChildren(...names.map((name) => new Option(name, name))); };
  const load = async () => { try { renderSettings(await app.getSettings()); renderInfo(await app.getInfo()); await refreshProfiles(); } catch (error) { fail("Could not load settings.", error); } };

  fields.hoverOpacity.addEventListener("input", showOpacity);
  fields.idleSleepEnabled.addEventListener("change", () => { fields.idleSleepMinutes.disabled = !fields.idleSleepEnabled.checked; });
  fields.shortcutsEnabled.addEventListener("change", () => { fields.shortcutAdd.disabled = fields.shortcutSettings.disabled = !fields.shortcutsEnabled.checked; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const settings = await app.updateSettings({
        alwaysOnTop: fields.alwaysOnTop.checked, defaultSize: Number(fields.defaultSize.value), minSize: Number(fields.minSize.value), maxSize: Number(fields.maxSize.value), maxCompanions: Number(fields.maxCompanions.value),
        hoverOpacity: Number(fields.hoverOpacity.value) / 100,
        idleSleep: { enabled: fields.idleSleepEnabled.checked, minutes: Number(fields.idleSleepMinutes.value) },
        ...(fields.startWithWindows.disabled ? {} : { startWithWindows: fields.startWithWindows.checked }),
        shortcuts: { enabled: fields.shortcutsEnabled.checked, addCompanion: fields.shortcutAdd.value.trim(), openSettings: fields.shortcutSettings.value.trim() }
      });
      renderSettings(settings); renderInfo(await app.getInfo()); say("Settings saved.");
    } catch (error) { fail("Could not save settings.", error); }
  });
  $("#add-companion").addEventListener("click", async () => { try { await app.addCompanion(); say("Companion added."); } catch (error) { fail("Could not add companion.", error); } });
  $("#save-profile").addEventListener("click", async () => { const name = $("#profile-name").value.trim(); if (!name) return say("Enter a layout name.", true); try { await app.saveProfile(name); await refreshProfiles(); say("Layout saved."); } catch (error) { fail("Could not save that layout.", error); } });
  $("#load-profile").addEventListener("click", async () => { if (!profiles.value) return; try { renderSettings(await app.loadProfile(profiles.value)); say("Layout loaded."); } catch (error) { fail("Could not load that layout.", error); } });
  $("#delete-profile").addEventListener("click", async () => { if (!profiles.value) return; try { await app.deleteProfile(profiles.value); await refreshProfiles(); say("Layout deleted."); } catch (error) { fail("Could not delete that layout.", error); } });
  $("#open-data-folder").addEventListener("click", async () => { try { await app.openDataFolder(); } catch (error) { fail("Could not open the data folder.", error); } });
  $("#export-world").addEventListener("click", async () => {
    try { const file = await app.exportWorld(); if (file) say(`Exported to ${file}`); } catch (error) { fail("Could not export.", error); }
  });
  $("#import-world").addEventListener("click", async () => {
    try {
      const result = await app.importWorld();
      if (!result) return;
      await load();
      say(`Imported ${result.companions} companion(s) and ${result.profiles} layout(s)${result.skipped ? `; skipped ${result.skipped} invalid` : ""}.`);
    } catch (error) { fail("Could not import.", error); }
  });
  $("#check-updates").addEventListener("click", async () => { try { await app.checkForUpdates(); } catch (error) { fail("Could not check for updates.", error); } });
  if (typeof app.onSettingsChanged === "function") app.onSettingsChanged(() => void load());
  void load();
})();
