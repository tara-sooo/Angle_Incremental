import assert from "node:assert/strict";
import { openGamePage, trackPage } from "../../browser-harness.mjs";

export async function runTimelineCopyRegression(browser, origin, httpFailures) {
  const timelineErrors = [];
  const { context: timelineContext, page: timelinePage } = await openGamePage(browser, origin, {
    viewport: { width: 1280, height: 900 },
    stubFonts: true,
    freezeAnimationFrame: false,
  });
  trackPage(timelinePage, "timeline-copy", timelineErrors, httpFailures);
  try {
    const timelineCopy = await timelinePage.evaluate(() => {
      const { state, runtime, switchMainTab, switchEternitySubtab } = window.__angleDebug;
      const originalState = structuredClone(state);
      const originalMainTab = runtime.activeMainTab;
      const originalEternitySubtab = runtime.activeEternitySubtab;
      const nodeIds = [
        "Real-BC16500",
        "Parallel-BC16500",
      ];
      const ownedNodes = nodeIds.map((id) => {
        const node = runtime.timelineNode(id);
        if (!node) throw new Error("missing Timeline node definition: " + id);
        return { id: node.id, costTF: node.costTF };
      });
      const readNode = (id) => {
        const card = document.querySelector('[data-timeline-node="' + id + '"]');
        if (!card) throw new Error("missing Timeline node card: " + id);
        card.click();
        window.advanceTime(0);
        return {
          description: document.querySelector("#timelineNodeDetailDescription")?.textContent?.trim() ?? "",
          currentEffect: document.querySelector("#timelineNodeDetailCurrentEffect")?.textContent?.trim() ?? "",
          currentEffectHidden: document.querySelector("#timelineNodeDetailCurrentEffect")?.hidden ?? false,
          prerequisites: document.querySelector("#timelineNodeDetailPrerequisites")?.textContent?.trim() ?? "",
          cardStatus: card.querySelector(".timeline-node-status")?.textContent?.trim() ?? "",
        };
      };
      const readLanguage = (language) => {
        Object.assign(state, {
          eternityCount: 1,
          scoreTfClaims: 0,
          ipTfClaims: 0,
          eternityTfClaims: 0,
          timelinePurchasedNodes: ownedNodes,
          unlockedMainTabs: ["eternity", "timeline"],
          language,
          score: Number.MAX_VALUE,
          scoreLog10: 14000,
          infinityCount: 10 ** 15,
          towerFloor: 1,
        });
        runtime.appliedLanguage = "";
        switchMainTab("eternity");
        switchEternitySubtab("timeline");
        window.advanceTime(0);
        return {
          scoreTrack: document.querySelector('[data-i18n="timelineScoreTrack"]')?.textContent?.trim() ?? "",
          scoreRequirement: document.querySelector("#timelineScoreRequirement")?.textContent?.trim() ?? "",
          nodes: Object.fromEntries(nodeIds.map((id) => [id, readNode(id)])),
        };
      };

      Object.assign(state, {
        eternityCount: 1,
        scoreTfClaims: 0,
        ipTfClaims: 0,
        eternityTfClaims: 0,
        timelinePurchasedNodes: [],
        unlockedMainTabs: ["eternity", "timeline"],
        language: "ja",
      });
      runtime.appliedLanguage = "";
      switchMainTab("eternity");
      switchEternitySubtab("timeline");
      window.advanceTime(0);
      const unpurchased = readNode("Real-BC16500");
      const japanese = readLanguage("ja");
      const english = readLanguage("en");
      const renderedNodeIds = Array.from(
        document.querySelectorAll(".timeline-node[data-timeline-node]"),
        (node) => node.dataset.timelineNode,
      );

      Object.assign(state, originalState);
      runtime.appliedLanguage = "";
      switchEternitySubtab(originalEternitySubtab);
      switchMainTab(originalMainTab);
      window.advanceTime(0);
      return { unpurchased, japanese, english, renderedNodeIds };
    });

    assert.equal(timelineCopy.unpurchased.currentEffectHidden, true, "unpurchased Timeline nodes should hide current effects");
    assert.equal(timelineCopy.unpurchased.currentEffect, "", "unpurchased Timeline nodes should not render inactive copy");
    assert.deepEqual(
      timelineCopy.renderedNodeIds,
      ["Real-BC16500", "Parallel-BC16500"],
      "0.14.0 Timeline should render only the two BC16500 nodes",
    );

    const japaneseDescriptions = {
      "Real-BC16500": "Infinity獲得量は現在所持しているIPの数に応じて強化される（元の獲得量 × (1 + log10(IP))）",
      "Parallel-BC16500": "IC8をクリアした後、IP獲得量は毎秒×3ずつ増加する（×10.00B SC）",
    };
    const englishDescriptions = {
      "Real-BC16500": "Infinity count gain is strengthened based on current IP (original gain × (1 + log10(IP))).",
      "Parallel-BC16500": "After clearing IC8, IP gain increases by ×3 each second (SC at ×10.00B).",
    };
    assert.deepEqual(
      Object.fromEntries(Object.entries(timelineCopy.japanese.nodes).map(([id, node]) => [id, node.description])),
      japaneseDescriptions,
      "Japanese Timeline descriptions should match the approved player-facing copy",
    );
    assert.deepEqual(
      Object.fromEntries(Object.entries(timelineCopy.english.nodes).map(([id, node]) => [id, node.description])),
      englishDescriptions,
      "English Timeline descriptions should stay semantically aligned",
    );
    assert.equal(timelineCopy.japanese.scoreTrack, "スコア", "Japanese Timeline score track should use スコア");
    assert.match(timelineCopy.japanese.scoreRequirement, / スコア$/, "Japanese score requirement should use スコア");
    assert.equal(timelineCopy.english.scoreTrack, "Score", "English Timeline score track should use Score");
    assert.match(timelineCopy.english.scoreRequirement, / Score$/, "English score requirement should use Score");
    assert.equal(
      Object.values(timelineCopy.japanese.nodes).every((node) => !node.currentEffectHidden),
      true,
      "owned Japanese Timeline nodes should show current effects",
    );
    assert.equal(
      Object.values(timelineCopy.english.nodes).every((node) => !node.currentEffectHidden),
      true,
      "owned English Timeline nodes should show current effects",
    );
    const japaneseVisibleCopy = Object.values(timelineCopy.japanese.nodes)
      .flatMap((node) => [node.description, node.currentEffect, node.prerequisites, node.cardStatus])
      .join("\n");
    assert.doesNotMatch(japaneseVisibleCopy, /Score|強度2|ソフトキャップなし|logソフトキャップ/, "Japanese Timeline copy should omit internal or stale wording");
    const englishVisibleCopy = Object.values(timelineCopy.english.nodes)
      .flatMap((node) => [node.description, node.currentEffect, node.prerequisites, node.cardStatus])
      .join("\n");
    assert.doesNotMatch(englishVisibleCopy, /strength-2|log softcap|where S|log10\(I\)|\bI \/ 4\b|no softcap/i, "English Timeline copy should omit internal or stale wording");
  } finally {
    await timelineContext.close();
  }
  assert.deepEqual(timelineErrors, [], "Timeline copy flow should produce no browser errors");
}
