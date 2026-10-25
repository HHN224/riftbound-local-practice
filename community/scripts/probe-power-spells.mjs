import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto(origin + "/fuxuan/");
  await page.getByTestId("open-personal-decks").waitFor();
  const draft = JSON.parse(
    await fs.readFile(
      "community/sandbox-reference/riftbound-sandbox/assets/before-combat.json",
      "utf8",
    ),
  );
  draft.players.p1.hand = [
    { ref: "buff1", templateId: "UNL-031/219" },
    { ref: "buff2", templateId: "OGN·058/298" },
  ];
  draft.players.p1.runes.forEach((r) => (r.color = "green"));
  await page.evaluate((d) => __r(841).sandboxStore.save(d), draft);
  await page.getByText("构筑", { exact: true }).click();
  await page.getByText("Sandbox", { exact: true }).click();
  await page.getByText("开始", { exact: true }).click();
  await page.getByTestId("card-flight:sandbox_card_p1-base-1").waitFor();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.powerCues = [];
    __r(841).useGameStore.subscribe((s) =>
      s.pendingKeyframes.forEach((f) =>
        f.cues
          .filter((c) => c.type === "power-modified")
          .forEach((c) => {
            if (!powerCues.includes(c)) powerCues.push(c);
          }),
      ),
    );
  });
  const perspective = await page.evaluate(
    () => __r(841).useGameStore.getState().realLocalPlayerId,
  );
  const powers = [];
  for (const [id, expected] of [
    ["buff1", 6],
    ["buff2", 8],
  ]) {
    await page.evaluate((initial) => {
      const s = __r(841).useGameStore.getState();
      if (s.realLocalPlayerId !== initial) s.toggleSandboxPerspective();
    }, perspective);
    await page.waitForTimeout(200);
    await page.evaluate(
      (id) =>
        __r(841)
          .useGameStore.getState()
          .playCard("player", "sandbox_card_" + id, "base", "hand"),
      id,
    );
    let power;
    for (let step = 0; step < 70; step++) {
      await page.waitForTimeout(150);
      const out = await page.evaluate(() => {
        const s = __r(841).useGameStore.getState(),
          current = s.interaction.current,
          target = s.interaction.targetingSession;
        if (!Object.keys(s.pendingCommands).length) {
          if (current?.ownerId === "opponent") s.toggleSandboxPerspective();
          else if (target && !target.viewOnly)
            s.selectTargetsForAbility(["sandbox_card_p1-base-1"]);
          else if (current?.passKind === "reaction")
            s.passReactionFocus(current.ownerId);
          else if (current?.passKind === "spellDuel")
            s.passSpellDuelFocus(current.ownerId);
        }
        return {
          power: [...s.player.unitArea, ...s.opponent.unitArea].find(
            (u) => u.id === "sandbox_card_p1-base-1",
          )._effectivePower,
          errors: s.lastErrors,
        };
      });
      assert.deepEqual(out.errors, []);
      power = out.power;
      if (power === expected) break;
    }
    assert.equal(
      power,
      expected,
      "Native engine must apply the spell delta, never a constant 15",
    );
    powers.push(power);
    await page.waitForTimeout(1300);
  }
  const cues = await page.evaluate(() => powerCues);
  assert.deepEqual(
    cues.map((c) => c.amount),
    [1, 2],
  );
  assert.deepEqual(
    cues.map((c) => c.nextPower),
    powers,
  );
  // Perspective changes can skip playback. Replay the exact native power cues
  // through the real keyframe renderer to check the resulting visible labels.
  await page.evaluate(() => {
    window.nativePowerFloats = [];
    __r(994).subscribeFloats((items) =>
      items.forEach((item) => {
        if (!nativePowerFloats.some((x) => x.id === item.id))
          nativePowerFloats.push(item);
      }),
    );
    const s = __r(841).useGameStore.getState();
    __r(841).useGameStore.setState({
      pendingKeyframes: [
        {
          id: "native-cue-replay",
          eventKind: "presentation-test",
          cues: powerCues,
          display: {
            player: s.player,
            opponent: s.opponent,
            battlefields: s.battlefields,
            resolutionArea: [],
          },
        },
      ],
    });
  });
  await page.waitForFunction(() => nativePowerFloats.length === 2);
  assert.deepEqual(
    await page.evaluate(() => nativePowerFloats.map((f) => f.text)),
    ["+1 战力", "+2 战力"],
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: native 实战经验 and 训练有素 change power 5→6→8, emit amounts 1/2, and their replay shows +1 战力 / +2 战力.",
  );
} finally {
  await browser.close();
}
