import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
page.on("pageerror", (e) => errors.push(e.stack));
try {
  await page.goto(origin + "/fuxuan/");
  await page.getByText("人机对战 // VS AI", { exact: true }).waitFor();
  await page.evaluate(() => {
    const d = __r(841).deckStore;
    d.saveDeck({
      ...d.listDecks()[0],
      id: "test-local-deck",
      name: "本地保存测试",
    });
  });
  await page.reload();
  await page.getByText("构筑", { exact: true }).click();
  assert.equal(
    await page
      .getByText("本地保存测试", { exact: true })
      .evaluateAll(
        (elements) =>
          elements.filter((element) => element.getClientRects().length).length,
      ),
    1,
  );
  const draft = JSON.parse(
    await fs.readFile(
      "community/sandbox-reference/riftbound-sandbox/assets/before-combat.json",
      "utf8",
    ),
  );
  await page.evaluate((d) => __r(841).sandboxStore.save(d), draft);
  await page.getByText("Sandbox", { exact: true }).click();
  await page.getByText("交战前局面", { exact: true }).waitFor();
  await page.getByText("开始", { exact: true }).click();
  await page.waitForFunction(
    () => __r(841).useGameStore.getState().player.hand.length === 1,
  );
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const s = __r(841).useGameStore.getState();
    s.playCard("player", s.player.hand[0].id, "base", "hand");
  });
  for (let step = 0; step < 30; step++) {
    const state = await page.evaluate(() => {
      const s = __r(841).useGameStore.getState();
      return {
        hand: s.player.hand.length,
        base: s.player.unitArea.length,
        errors: s.lastErrors,
        prompt: s.interaction,
      };
    });
    assert.deepEqual(state.errors, []);
    if (state.hand === 0 && state.base === 2) break;
    await page.evaluate(() => {
      const s = __r(841).useGameStore.getState(),
        p = s.interaction.prompt,
        c = s.interaction.current;
      if (Object.keys(s.pendingCommands).length) return;
      if (p?.kind.type === "extraCost") s.confirmExtraCost([]);
      else if (p?.kind.type === "optional") s.confirmOptionalChoice(false);
      else if (c?.passKind === "reaction") s.passReactionFocus(c.ownerId);
      else if (c?.passKind === "spellDuel") s.passSpellDuelFocus(c.ownerId);
    });
    await page.waitForTimeout(300);
  }
  const played = await page.evaluate(() => {
    const s = __r(841).useGameStore.getState();
    return {
      hand: s.player.hand.length,
      base: s.player.unitArea.length,
      runes: s.player.activeRunes.filter((r) => r.isTapped).length,
    };
  });
  assert.equal(played.hand, 0);
  assert.equal(played.base, 2);
  assert(played.runes > 0, "Playing must pay its cost");
  const perspective = await page.evaluate(
    () => __r(841).useGameStore.getState().realLocalPlayerId,
  );
  await page.evaluate(() => {
    const s = __r(841).useGameStore.getState();
    s.moveUnitToBattlefield(
      "player",
      "sandbox_card_p1-base-1",
      s.battlefields[1].id,
    );
  });
  for (let step = 0; step < 30; step++) {
    await page.waitForTimeout(250);
    const done = await page.evaluate(() => {
      const s = __r(841).useGameStore.getState(),
        c = s.interaction.current;
      if (s.player.score + s.opponent.score > 0) return true;
      if (Object.keys(s.pendingCommands).length) return false;
      if (c?.passKind === "reaction") s.passReactionFocus(c.ownerId);
      else if (c?.passKind === "spellDuel") s.passSpellDuelFocus(c.ownerId);
      else if (c?.ownerId === "opponent") s.toggleSandboxPerspective();
      return false;
    });
    if (done) break;
  }
  await page.evaluate((id) => {
    const s = __r(841).useGameStore.getState();
    if (s.realLocalPlayerId !== id) s.toggleSandboxPerspective();
  }, perspective);
  await page.waitForTimeout(300);
  const moved = await page.evaluate(() => {
    const s = __r(841).useGameStore.getState();
    return {
      score: s.player.score,
      errors: s.lastErrors,
      units: s.battlefields[1].units.map((u) => u.card.id),
    };
  });
  assert.equal(moved.score, 1);
  assert.deepEqual(moved.errors, []);
  assert(moved.units.includes("sandbox_card_p1-base-1"));
  await page.screenshot({ path: "community/test-results/local-sandbox.png" });
  await page.evaluate(() => FuxuanLocal.transport.emit("stopLocalSession"));
  await page.evaluate(
    (d) => __r(841).useGameStore.getState().initSandbox(d),
    draft,
  );
  await page.waitForFunction(
    () =>
      __r(841).useGameStore.getState().player.hand.length === 1 &&
      __r(841).useGameStore.getState().player.score === 0,
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "community/test-results/features-result.json",
    JSON.stringify(
      { savedDeck: true, played, moved, restarted: true, errors },
      null,
      2,
    ),
  );
  console.log(
    "PASS: saved deck survives reload; native sandbox validates, pays card cost, moves/conquers and restarts.",
  );
} finally {
  await browser.close();
}
