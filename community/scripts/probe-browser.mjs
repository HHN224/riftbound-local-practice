import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [],
  failed = [],
  external = [],
  history = [];
await fs.mkdir("community/test-results", { recursive: true });
await context.route("**/*", (route) => {
  const url = route.request().url();
  if (
    url.startsWith(origin + "/") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  )
    return route.continue();
  external.push(url);
  return route.abort();
});
page.on("pageerror", (e) => errors.push(e.stack));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) failed.push([r.status(), r.url()]);
});
try {
  await page.goto(origin + "/fuxuan/");
  await page.getByText("人机对战 // VS AI", { exact: true }).waitFor();
  await page.evaluate(() => {
    window.thinkingEvents = [];
    window.thinkingVisible = 0;
    FuxuanLocal.transport.on("serverMessage", (message) => {
      if (message.type === "aiThinking") {
        window.thinkingEvents.push(message.payload);
        if (
          message.payload.thinking &&
          !document.querySelector('[data-testid="local-ai-thinking"]').hidden
        )
          window.thinkingVisible++;
      }
    });
    const t = FuxuanLocal.transport,
      emit = t.emit.bind(t);
    t.emit = (event, payload, callback) =>
      emit(
        event,
        event === "initGame"
          ? { ...payload, seed: "local-web-regression-1" }
          : payload,
        callback,
      );
  });
  await page.screenshot({ path: "community/test-results/local-menu.png" });
  await page.getByText("人机对战 // VS AI", { exact: true }).click();
  const deadline = Date.now() + 300000;
  let final,
    previous = "",
    played = false;
  while (Date.now() < deadline) {
    final = await page.evaluate(() => {
      const s = __r(841).useGameStore.getState();
      return {
        phase: s.phase,
        turn: s.turnNumber,
        current: s.currentTurn,
        winner: s.winner,
        winReason: s.winReason,
        score: [s.player.score, s.opponent.score],
        errors: s.lastErrors,
        prompt: s.interaction.current,
        cursor: s.eventCursor,
      };
    });
    const key = JSON.stringify(final);
    if (key !== previous) {
      history.push(final);
      console.log(JSON.stringify(final));
      previous = key;
    }
    assert.deepEqual(final.errors, [], "Engine rejected a command");
    if (final.winner) break;
    const action = await page.evaluate((played) => {
      const s = __r(841).useGameStore.getState(),
        p = s.preGame;
      if (Object.keys(s.pendingCommands).length) return;
      if (p.battlefieldPick?.myPickPending) s.confirmOpponentBattlefield();
      else if (p.legendDraft?.isPending)
        (p.legendDraft.stage === "ban" ? s.banLegend : s.pickSecondaryLegend)(
          p.legendDraft.availableTemplateIds[0],
        );
      else if (p.dice?.isMyTurnToRoll) s.rollPreGameDice();
      else if (p.dice?.iAmWinner && p.dice?.stage === "choosing")
        s.chooseFirstPlayer("first");
      else if (p.mulligan?.isPending) s.submitMulligan([]);
      else if (p.sideboard?.isPending)
        s.submitSideboard(
          s.player.heroSlot.id,
          s.player.mainDeck.map((c) => c.id),
          s.player.sideboard.map((c) => c.id),
        );
      else if (s.interaction.current?.ownerId === "player") {
        if (s.interaction.current.passKind === "reaction")
          s.passReactionFocus("player");
        else if (s.interaction.current.passKind === "spellDuel")
          s.passSpellDuelFocus("player");
        else if (s.interaction.prompt?.kind.type === "optional")
          s.confirmOptionalChoice(false);
        else if (s.interaction.prompt?.kind.type === "extraCost")
          s.confirmExtraCost([]);
      } else if (
        s.phase === "action" &&
        s.currentTurn === "player" &&
        !s.interaction.current
      ) {
        const simple = s.player.hand.find(
          (c) =>
            c._canPlay &&
            c.subType === "unit" &&
            !c.abilities?.length &&
            !c.extraCosts?.length,
        );
        if (!played && simple) {
          s.playCard("player", simple.id, "base", "hand");
          return "played";
        }
        s.endTurn();
      }
    }, played);
    if (action === "played") played = true;
    await page.waitForTimeout(650);
  }
  await page
    .getByText("// MATCH RESULT", { exact: true })
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: "community/test-results/local-game.png" });
  const state = await page.evaluate(() => {
    const s = __r(841).useGameStore.getState();
    return {
      eventLog: s.eventLog,
      player: s.player,
      opponent: s.opponent,
      battlefields: s.battlefields,
      preGame: s.preGame,
      interaction: s.interaction,
    };
  });
  await fs.writeFile(
    "community/test-results/game-state.json",
    JSON.stringify(state, null, 2),
  );
  const result = { final, played, errors, failed, external, history };
  const thinking = await page.evaluate(() => ({
    signals: window.thinkingEvents.length,
    shown: window.thinkingVisible,
  }));
  assert(
    thinking.signals > 0 && thinking.shown > 0,
    "Real APK AI signals must display the thinking indicator",
  );
  assert.equal(
    await page.getByTestId("local-ai-thinking").isVisible(),
    false,
    "Spinner must clear after game end",
  );
  console.log("AI thinking feedback", thinking);
  await fs.writeFile(
    "community/test-results/browser-result.json",
    JSON.stringify(result, null, 2),
  );
  assert(final.winner, "Match did not finish within five minutes");
  assert(final.turn >= 3, "Expected multiple complete rounds");
  assert(final.score[1] > 0, "Expected AI to score");
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  assert.deepEqual(external, []);
  await page.getByText("再来一局", { exact: true }).click({ timeout: 15000 });
  await page.waitForFunction(() => {
    const s = __r(841).useGameStore.getState();
    return (
      s.winner === null && s.phase === "setup" && !!s.preGame.battlefieldPick
    );
  });
  console.log(
    "PASS: complete local match, visible result and restart, original AI scores, no browser errors or external requests.",
  );
} finally {
  await browser.close();
}
