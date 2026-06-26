// Applies external achievement and challenge definitions after the legacy core
// has completed its initial setup. This keeps the extracted data authoritative
// while the core source is reduced in later refactor phases.

applyProgressionDefinitions();

// IC7's active restriction belongs to the balance layer rather than its base
// challenge definition, so preserve the post-balance wording and behavior.
INFINITY_CHALLENGES[6].restriction = {
  ja: "ショップの価格が1e30を超えると、通常アップグレードを購入できなくなる",
  en: "Normal upgrades whose cost exceeds 1e30 cannot be bought.",
};

if (typeof createChallengeRows === "function") createChallengeRows();
if (typeof createAchievementRows === "function") createAchievementRows();
if (typeof updateUi === "function") updateUi();
if (typeof draw === "function") draw();
