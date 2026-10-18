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
        "Real-BC6000",
        "Parallel-BC6000",
        "Real-AD30",
        "Parallel-AD30",
      ];
      const routeSelections = [
        ["Real-BC16500", "Real-BC6000", "Real-AD30"],
        ["Parallel-BC16500", "Parallel-BC6000", "Parallel-AD30"],
      ];
      const ownedNodeMetadata = (ids) => ids.map((id) => {
        const node = runtime.timelineNode(id);
        if (!node) throw new Error("missing Timeline node definition: " + id);
        return { id: node.id, era: node.era, route: node.route, costTF: node.costTF };
      });
      const readNode = (id) => {
        const card = document.querySelector('[data-timeline-node="' + id + '"]');
        if (!card) throw new Error("missing Timeline node card: " + id);
        runtime.selectTimelineNode?.(id);
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
        const nodes = {};
        for (const selectedRoute of routeSelections) {
          Object.assign(state, {
            eternityCount: 1,
            scoreTfClaims: 12,
            ipTfClaims: 0,
            eternityTfClaims: 0,
            timelinePurchasedNodes: ownedNodeMetadata(selectedRoute),
            unlockedMainTabs: ["eternity", "timeline"],
            completedChallenges: (1 << (6 - 1)) | (1 << (8 - 1)),
            timelineParallelSecondsSinceIc8Clear: 5,
            language,
            score: Number.MAX_VALUE,
            scoreLog10: 14000,
            towerFloor: 1,
          });
          runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 1n);
          runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 10n ** 15n);
          runtime.syncInfinityPointCachesFromExact(10n ** 6n);
          runtime.appliedLanguage = "";
          switchMainTab("eternity");
          switchEternitySubtab("timeline");
          window.advanceTime(0);
          const routeNodes = Object.fromEntries(nodeIds.map((id) => [id, readNode(id)]));
          for (const id of nodeIds) {
            if (!nodes[id] || selectedRoute.includes(id)) nodes[id] = routeNodes[id];
          }
        }
        return {
          scoreTrack: document.querySelector('[data-i18n="timelineScoreTrack"]')?.textContent?.trim() ?? "",
          scoreRequirement: document.querySelector("#timelineScoreRequirement")?.textContent?.trim() ?? "",
          nodes,
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
      const unpurchased = Object.fromEntries(nodeIds.map((id) => [id, readNode(id)]));
      const japanese = readLanguage("ja");
      const english = readLanguage("en");
      const renderedNodeIds = Array.from(
        document.querySelectorAll(".timeline-node[data-timeline-node]"),
        (node) => node.dataset.timelineNode,
      );
      const renderedBridges = Array.from(
        document.querySelectorAll(".timeline-era-bridge"),
        (bridge) => [bridge.dataset.fromEra, bridge.dataset.toEra],
      );

      Object.assign(state, originalState);
      runtime.appliedLanguage = "";
      switchEternitySubtab(originalEternitySubtab);
      switchMainTab(originalMainTab);
      window.advanceTime(0);
      return { unpurchased, japanese, english, renderedNodeIds, renderedBridges };
    });

    assert.equal(
      Object.values(timelineCopy.unpurchased).every((node) => node.currentEffectHidden && node.currentEffect === ""),
      true,
      "unpurchased Timeline nodes should hide inactive current effects",
    );
    assert.deepEqual(
      timelineCopy.renderedNodeIds,
      ["Real-BC16500", "Parallel-BC16500", "Real-BC6000", "Parallel-BC6000", "Real-AD30", "Parallel-AD30"],
      "Timeline should render all six nodes across three eras",
    );
    assert.deepEqual(
      timelineCopy.renderedBridges,
      [["BC16500", "BC6000"], ["BC6000", "AD30"]],
      "Timeline should connect each era to the next without locking cross-era routes",
    );

    const japaneseDescriptions = {
      "Real-BC16500": "Infinity獲得量は現在所持しているIPの数に応じて強化される（元の獲得量 × (1 + log10(IP))）",
      "Parallel-BC16500": "IC8をクリアした後、IP獲得量は毎秒×3ずつ増加する（×10.00B SC）",
      "Real-BC6000": "IC6のInfinity数報酬に、Eternity回数ごとに×1.2の追加倍率を適用する（追加倍率は×1e10以降ソフトキャップ）",
      "Parallel-BC6000": "Towerのスコア累乗の増加量を+^0.05/Floorから+^0.07/Floorに変更する",
      "Real-AD30": "現在のスコアに応じてEternity獲得量を乗算する（既存獲得量 × (1 + log10(スコア) / 10000)）",
      "Parallel-AD30": "現在のInfinity数に応じてEternity獲得量を乗算する（既存獲得量 × (1 + log10(Infinity数) / 2)）",
    };
    const englishDescriptions = {
      "Real-BC16500": "Infinity count gain is strengthened based on current IP (original gain × (1 + log10(IP))).",
      "Parallel-BC16500": "After clearing IC8, IP gain increases by ×3 each second (SC at ×10.00B).",
      "Real-BC6000": "Multiply the IC6 Infinity-count reward by an additional ×1.2 per Eternity (the added multiplier softcaps after ×1e10).",
      "Parallel-BC6000": "Change the Tower score exponent increase from +^0.05/Floor to +^0.07/Floor.",
      "Real-AD30": "Multiply existing Eternity gain by (1 + log10(current Score) / 10000).",
      "Parallel-AD30": "Multiply existing Eternity gain by (1 + log10(current Infinity count) / 2).",
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
    assert.match(timelineCopy.japanese.nodes["Real-BC6000"].currentEffect, /現在のIC6 Infinity数報酬倍率/);
    assert.match(timelineCopy.japanese.nodes["Parallel-BC6000"].currentEffect, /現在のTowerスコア指数: \^1\.07/);
    assert.match(timelineCopy.japanese.nodes["Real-AD30"].currentEffect, /現在のEternity獲得倍率/);
    assert.match(timelineCopy.japanese.nodes["Parallel-AD30"].currentEffect, /現在のEternity獲得倍率/);
    assert.match(timelineCopy.english.nodes["Real-BC6000"].currentEffect, /Current IC6 Infinity-count reward multiplier/);
    assert.match(timelineCopy.english.nodes["Parallel-BC6000"].currentEffect, /Current Tower Score exponent: \^1\.07/);
    assert.match(timelineCopy.english.nodes["Real-AD30"].currentEffect, /Current Eternity gain multiplier/);
    assert.match(timelineCopy.english.nodes["Parallel-AD30"].currentEffect, /Current Eternity gain multiplier/);
    const japaneseVisibleCopy = Object.values(timelineCopy.japanese.nodes)
      .flatMap((node) => [node.description, node.currentEffect, node.prerequisites, node.cardStatus])
      .join("\n");
    assert.doesNotMatch(japaneseVisibleCopy, /Score|強度2|ソフトキャップなし|logソフトキャップ/, "Japanese Timeline copy should omit internal or stale wording");
    const englishVisibleCopy = Object.values(timelineCopy.english.nodes)
      .flatMap((node) => [node.description, node.currentEffect, node.prerequisites, node.cardStatus])
      .join("\n");
    assert.doesNotMatch(englishVisibleCopy, /strength-2|log softcap|where S|log10\(I\)|\bI \/ 4\b|no softcap/i, "English Timeline copy should omit internal or stale wording");

    const preparePurchaseTimeline = (page) => page.evaluate(() => {
      const { state, runtime, switchMainTab, switchEternitySubtab } = window.__angleDebug;
      runtime.closeUpdateModal?.();
      Object.assign(state, {
        eternityCount: 1,
        scoreTfClaims: 7,
        ipTfClaims: 0,
        eternityTfClaims: 0,
        timelinePurchasedNodes: [],
        unlockedMainTabs: ["eternity", "timeline"],
        completedChallenges: (1 << (6 - 1)) | (1 << (8 - 1)),
        language: "en",
        score: Number.MAX_VALUE,
        scoreLog10: 14000,
        towerFloor: 1,
      });
      runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 1n);
      runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 10n ** 15n);
      runtime.syncInfinityPointCachesFromExact(10n ** 6n);
      runtime.appliedLanguage = "";
      switchMainTab("eternity");
      switchEternitySubtab("timeline");
      runtime.updateUi();
      window.advanceTime(0);
    });

    await preparePurchaseTimeline(timelinePage);
    const keyboardCard = timelinePage.locator('.timeline-node[data-timeline-node="Real-BC16500"]');
    await keyboardCard.focus();
    await timelinePage.keyboard.press("Enter");
    await timelinePage.waitForFunction(() => (
      document.querySelector("#timelineNodeDetail")?.dataset.timelineNode === "Real-BC16500"
    ));
    const keyboardPurchase = timelinePage.locator('[data-timeline-node-purchase="Real-BC16500"]');
    const keyboardPurchaseState = await timelinePage.evaluate(() => {
      const { state, runtime } = window.__angleDebug;
      const availability = runtime.timelineNodeAvailability("Real-BC16500");
      const detail = document.querySelector("#timelineNodeDetail");
      const button = document.querySelector('[data-timeline-node-purchase="Real-BC16500"]');
      return {
        scoreTfClaims: state.scoreTfClaims,
        availableTf: runtime.timelineAvailableTf(),
        discovered: runtime.timelineDiscovered(),
        reason: availability.reason,
        detailNode: detail?.dataset.timelineNode,
        detailHidden: detail?.hidden,
        buttonHidden: button?.hidden,
        buttonDisabled: button?.disabled,
      };
    });
    assert.equal(
      await keyboardPurchase.isVisible(),
      true,
      `available Timeline nodes should expose the keyboard purchase control: ${JSON.stringify(keyboardPurchaseState)}`,
    );
    await keyboardPurchase.focus();
    await timelinePage.keyboard.press("Enter");
    const keyboardPurchasedIds = await timelinePage.evaluate(() => (
      window.__angleDebug.state.timelinePurchasedNodes.map((node) => node.id)
    ));
    assert.deepEqual(keyboardPurchasedIds, ["Real-BC16500"], "keyboard activation should purchase the selected Timeline node");

    const mobileErrors = [];
    const { context: mobileContext, page: mobilePage } = await openGamePage(browser, origin, {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      stubFonts: true,
      freezeAnimationFrame: false,
    });
    trackPage(mobilePage, "timeline-mobile-touch", mobileErrors, httpFailures);
    try {
      await preparePurchaseTimeline(mobilePage);
      const mobileLayout = await mobilePage.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        nodeCount: document.querySelectorAll(".timeline-node[data-timeline-node]").length,
      }));
      assert.equal(mobileLayout.nodeCount, 6, "mobile Timeline should render all six nodes");
      assert.ok(
        mobileLayout.documentWidth <= mobileLayout.viewportWidth + 1,
        `mobile Timeline should not overflow horizontally (${mobileLayout.documentWidth}px > ${mobileLayout.viewportWidth}px)`,
      );

      const touch = async (selector) => {
        const target = mobilePage.locator(selector);
        await target.scrollIntoViewIfNeeded();
        const bounds = await target.boundingBox();
        assert.ok(bounds, `touch target should have visible bounds: ${selector}`);
        await mobilePage.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      };
      const touchPurchase = async (id) => {
        await touch(`.timeline-node[data-timeline-node="${id}"]`);
        const purchase = mobilePage.locator(`[data-timeline-node-purchase="${id}"]`);
        assert.equal(await purchase.isVisible(), true, `mobile selection should expose purchase for ${id}`);
        await touch(`[data-timeline-node-purchase="${id}"]`);
      };
      await touchPurchase("Real-BC16500");
      await touchPurchase("Parallel-BC6000");
      await touchPurchase("Real-AD30");
      const mobilePurchased = await mobilePage.evaluate(() => ({
        ids: window.__angleDebug.state.timelinePurchasedNodes.map((node) => node.id),
        effectHidden: document.querySelector("#timelineNodeDetailCurrentEffect")?.hidden ?? true,
        effect: document.querySelector("#timelineNodeDetailCurrentEffect")?.textContent?.trim() ?? "",
      }));
      assert.deepEqual(
        mobilePurchased.ids,
        ["Real-BC16500", "Parallel-BC6000", "Real-AD30"],
        "mobile touch should purchase a valid mixed-route Timeline across all three eras",
      );
      assert.equal(mobilePurchased.effectHidden, false, "owned AD30 should show its mobile current effect");
      assert.notEqual(mobilePurchased.effect, "", "mobile current effect should contain its live Eternity multiplier");
    } finally {
      await mobileContext.close();
    }
    assert.deepEqual(mobileErrors, [], "mobile Timeline touch purchases should produce no browser errors");
  } finally {
    await timelineContext.close();
  }
  assert.deepEqual(timelineErrors, [], "Timeline copy flow should produce no browser errors");
}
