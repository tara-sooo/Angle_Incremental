// Applies non-destructive schema defaults after loading a save. Existing state
// values are never reset here; only fields absent from an older runtime shape
// are initialized and the serialized field list is made authoritative.

applyStateSchema();

if (window.__angleDebug) {
  Object.assign(window.__angleDebug, {
    stateDefaults: STATE_DEFAULTS,
    saveFields: SAVE_FIELD_DEFINITIONS,
  });
}
