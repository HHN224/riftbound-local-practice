import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

// Isolated browser/storage and native sessions; never connects to a player's tab.
const fixture = JSON.parse(
  await fs.readFile(
    "community/sandbox-reference/riftbound-sandbox/assets/before-combat.json",
    "utf8",
  ),
);
const origin = `http://127.0.0.1:${process.env.FUXUAN_PORT || 4174}`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const actor of ["p1", "p2"]) {
    const page = await browser.newPage();
    const draft = structuredClone(fixture);
    draft.name = `Final point ${actor}`;
    draft.currentPlayer = actor;
    for (const [id, player] of Object.entries(draft.players)) {
      player.score = id === actor ? 7 : 0;
      player.hand = [];
      player.baseUnits =
        id === actor
          ? [1, 2].map((n) => ({
              ref: `${actor}-base-${n}`,
              templateId: "OGN·001/298",
              tapped: false,
            }))
          : [];
    }
    for (const field of draft.battlefields) {
      field.controller = null;
      field.units = [];
    }
    await page.goto(origin + "/fuxuan/");
    await page.getByText("人机对战 // VS AI", { exact: true }).waitFor();
    await page.evaluate((d) => __r(841).sandboxStore.save(d), draft);
    await page.getByText("构筑", { exact: true }).click();
    await page.getByText("Sandbox", { exact: true }).click();
    await page.getByText(draft.name, { exact: true }).waitFor();
    await page.getByText("开始", { exact: true }).click();
    await page.waitForFunction(() => {
      const s = __r(841).useGameStore.getState();
      return s.player.score + s.opponent.score === 7;
    });
    // The original GameBoard registers its command handlers after mounting.
    await page.waitForTimeout(1000);
    if (
      (await page.evaluate(
        () => __r(841).useGameStore.getState().player.score,
      )) !== 7
    ) {
      await page.evaluate(() =>
        __r(841).useGameStore.getState().toggleSandboxPerspective(),
      );
      await page.waitForFunction(
        () => __r(841).useGameStore.getState().player.score === 7,
      );
    }
    const actorId = await page.evaluate(
      () => __r(841).useGameStore.getState().realLocalPlayerId,
    );
    const snapshot = () =>
      page.evaluate((actor) => {
        const s = __r(841).useGameStore.getState();
        const side = s.realLocalPlayerId === actor ? "player" : "opponent";
        return {
          actorSide: side,
          score: s[side].score,
          hand: s[side].hand.length,
          winner: s.winner,
          errors: s.lastErrors,
          fields: s.battlefields.map((f) => ({
            controller: f.controllerId,
            scored: f.scoredByPlayers,
            units: f.units.map((u) => u.card.id),
          })),
        };
      }, actorId);
    const initial = await snapshot();
    for (const index of [0, 1]) {
      if (
        (await page.evaluate(
          () => __r(841).useGameStore.getState().realLocalPlayerId,
        )) !== actorId
      ) {
        await page.evaluate(() =>
          __r(841).useGameStore.getState().toggleSandboxPerspective(),
        );
        await page.waitForFunction(
          (id) => __r(841).useGameStore.getState().realLocalPlayerId === id,
          actorId,
        );
      }
      await page.evaluate(
        ({ actor, actorId, index }) => {
          const s = __r(841).useGameStore.getState();
          const side = s.realLocalPlayerId === actorId ? "player" : "opponent";
          s.moveUnitToBattlefield(
            side,
            `sandbox_card_${actor}-base-${index + 1}`,
            s.battlefields[index].id,
          );
        },
        { actor, actorId, index },
      );
      let settled = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        const ready = await page.evaluate(
          ({ actorId, index, hand }) => {
            const s = __r(841).useGameStore.getState();
            const side =
              s.realLocalPlayerId === actorId ? "player" : "opponent";
            if (s.lastErrors.length) throw Error(JSON.stringify(s.lastErrors));
            if (s.winner) return true;
            if (Object.keys(s.pendingCommands).length) return false;
            if (index === 0 && s[side].hand.length === hand + 1) return true;
            const c = s.interaction.current;
            if (c?.passKind === "reaction") s.passReactionFocus(c.ownerId);
            else if (c?.passKind === "spellDuel")
              s.passSpellDuelFocus(c.ownerId);
            else if (c?.ownerId === "opponent") s.toggleSandboxPerspective();
            return false;
          },
          { actorId, index, hand: initial.hand },
        );
        if (ready) {
          settled = true;
          break;
        }
        await page.waitForTimeout(100);
      }
      const result = await snapshot();
      assert(
        settled,
        `Native conquest did not settle: ${JSON.stringify(result)}`,
      );
      results.push({ actor, conquest: index + 1, ...result });
      assert.deepEqual(result.errors, []);
      assert(
        result.fields[index].units.includes(
          `sandbox_card_${actor}-base-${index + 1}`,
        ),
        JSON.stringify({ actor, index, result }),
      );
      assert.equal(result.score, index === 0 ? 7 : 8, JSON.stringify(result));
      if (index === 0) {
        assert.equal(result.winner, null);
        assert.equal(
          result.hand,
          initial.hand + 1,
          "Blocked final conquest point must draw instead",
        );
      } else {
        assert.equal(
          result.winner,
          result.actorSide,
          "Conquering both battlefields this turn must allow the final point",
        );
      }
    }
    await page.close();
  }
  await fs.mkdir("community/test-results", { recursive: true });
  await fs.writeFile(
    "community/test-results/final-point-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    "PASS: both native player seats stay at 7 and draw on first conquest; second battlefield conquest wins at 8.",
  );
} finally {
  await browser.close();
}
