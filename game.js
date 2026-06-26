import("./src/main.js")
  .then(() => import("./src/patches/achievements-v2.js"))
  .catch((error) => console.error("Angle Incremental failed to start", error));
