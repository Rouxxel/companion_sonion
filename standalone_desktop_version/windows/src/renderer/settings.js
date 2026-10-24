(() => {
  const app = window.desktopApp;
  const $ = (selector) => document.querySelector(selector);
  const form = $("#settings-form"); const status = $("#status"); const profiles = $("#profiles");
  const fields = { alwaysOnTop: $("#always-on-top"), defaultSize: $("#default-size"), minSize: $("#min-size"), maxSize: $("#max-size"), maxCompanions: $("#max-companions") };
  const say = (message, bad = false) => { status.textContent = message; status.style.color = bad ? "#ffadad" : "#a9e7bd"; };
  const renderSettings = (config) => { const s = config.settings || config; fields.alwaysOnTop.checked = !!s.alwaysOnTop; fields.defaultSize.value = s.defaultSize; fields.minSize.value = s.minSize; fields.maxSize.value = s.maxSize; fields.maxCompanions.value = s.maxCompanions; };
  const refreshProfiles = async () => { const names = await app.listProfiles(); profiles.replaceChildren(...names.map((name) => new Option(name, name))); };
  const load = async () => { try { renderSettings(await app.getSettings()); await refreshProfiles(); } catch { say("Could not load settings.", true); } };
  form.addEventListener("submit", async (event) => { event.preventDefault(); try { const settings = await app.updateSettings({ alwaysOnTop: fields.alwaysOnTop.checked, defaultSize: Number(fields.defaultSize.value), minSize: Number(fields.minSize.value), maxSize: Number(fields.maxSize.value), maxCompanions: Number(fields.maxCompanions.value) }); renderSettings(settings); say("Settings saved."); } catch { say("Could not save settings.", true); } });
  $("#add-companion").addEventListener("click", async () => { try { await app.addCompanion(); say("Companion added."); } catch { say("Could not add companion.", true); } });
  $("#save-profile").addEventListener("click", async () => { const name = $("#profile-name").value.trim(); if (!name) return say("Enter a layout name.", true); try { await app.saveProfile(name); await refreshProfiles(); say("Layout saved."); } catch { say("Could not save that layout.", true); } });
  $("#load-profile").addEventListener("click", async () => { if (!profiles.value) return; try { renderSettings(await app.loadProfile(profiles.value)); say("Layout loaded."); } catch { say("Could not load that layout.", true); } });
  $("#delete-profile").addEventListener("click", async () => { if (!profiles.value) return; try { await app.deleteProfile(profiles.value); await refreshProfiles(); say("Layout deleted."); } catch { say("Could not delete that layout.", true); } });
  void load();
})();
