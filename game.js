(() => {
  const MODULE_BUILD = "0.1.0-module-split";

  function loadClassicScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${path}?v=${MODULE_BUILD}`;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${path}`));
      document.head.appendChild(script);
    });
  }

  loadClassicScript("./src/runtime/core.js")
    .then(() => loadClassicScript("./src/data/progression-definitions.js"))
    .then(() => loadClassicScript("./src/data/balance-profile.js"))
    .then(() => loadClassicScript("./src/systems/balance-formulas.js"))
    .then(() => loadClassicScript("./src/systems/balance-runtime.js"))
    .catch((error) => console.error("Angle Incremental failed to load", error));
})();
