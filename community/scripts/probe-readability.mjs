import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const b = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
const report = [];
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
await fs.mkdir("community/test-results", { recursive: true });
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    const p = await b.newPage({ viewport });
    p.on("pageerror", (e) => errors.push(e.stack));
    await p.goto(origin + "/fuxuan/");
    await p.getByText("人机对战 // VS AI", { exact: true }).waitFor();
    const draft = JSON.parse(
      await fs.readFile(
        "community/sandbox-reference/riftbound-sandbox/assets/before-combat.json",
        "utf8",
      ),
    );
    draft.battlefields[0].templateId = "OGN·296/298";
    draft.battlefields[1].templateId = "OGN·297/298";
    draft.players.p1.graveyard = [
      { ref: "p1-grave-1", templateId: "OGN·002/298" },
    ];
    draft.players.p2.hand = [{ ref: "p2-hand-1", templateId: "OGN·003/298" }];
    if (viewport.width === 1920) {
      for (let i = 7; i <= 12; i++) {
        draft.players.p1.runes.push({
          ref: "p1-rune-" + i,
          color: "red",
          tapped: false,
          flipped: false,
        });
        draft.players.p2.runes.push({
          ref: "p2-rune-" + i,
          color: "red",
          tapped: false,
          flipped: false,
        });
      }
    }
    await p.evaluate((d) => __r(841).sandboxStore.save(d), draft);
    await p.getByText("构筑", { exact: true }).click();
    await p.getByText("Sandbox", { exact: true }).click();
    await p.getByText("开始", { exact: true }).click();
    await p.waitForFunction(
      () => __r(841).useGameStore.getState().player.hand.length === 1,
    );
    await p.waitForTimeout(1000);
    const hover = p.getByTestId("local-card-hover"),
      dialog = p.getByRole("dialog", { name: "灼焰飞龙" });
    async function inspect(locator, name) {
      const hit = await locator.boundingBox();
      await p.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2);
      await hover.waitFor({ state: "visible" });
      await hover.locator("img").evaluate((img) => img.decode());
      assert((await hover.textContent()).includes(name));
      const r = await hover.boundingBox();
      assert(
        r.x >= 0 &&
          r.y >= 0 &&
          r.x + r.width <= viewport.width + 1 &&
          r.y + r.height <= viewport.height + 1,
      );
    }
    for (const id of ["p1-hand-1", "p1-base-1", "p2-field-1"])
      await inspect(
        p.getByTestId("card-flight:sandbox_card_" + id),
        "灼焰飞龙",
      );
    await p.screenshot({
      path: `community/test-results/readability-hover-${viewport.width}.png`,
    });
    await p.keyboard.press("i");
    await dialog.waitFor();
    assert((await dialog.textContent()).includes("额外支付"));
    assert.equal(await hover.isVisible(), false);
    await p.screenshot({
      path: `community/test-results/readability-pinned-${viewport.width}.png`,
    });
    await p.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await p
      .getByTestId("card-flight:sandbox_card_p1-hand-1")
      .click({ button: "right" });
    await dialog.waitFor();
    await p.getByRole("button", { name: "关闭 · Esc" }).click();
    await p.getByTestId("card:__deck__").first().hover();
    await p.waitForTimeout(350);
    assert.equal(await hover.isVisible(), false);
    // Opponent hand remains hidden even if DOM test IDs retain a template ID.
    const backs = p.locator('[data-testid^="card:"][aria-label="卡背"]');
    for (let i = 0; i < (await backs.count()); i++) {
      if (await backs.nth(i).isVisible()) {
        await backs.nth(i).hover();
        await p.waitForTimeout(300);
        assert.equal(await hover.isVisible(), false);
      }
    }
    await inspect(
      p.getByTestId("card-flight:sandbox_card_p1-grave-1"),
      "粗鲁的海盗",
    );
    const fields = p.locator(".fx-field-inspect");
    assert.equal(await fields.count(), 2);
    await fields.nth(1).click();
    const fieldDialog = p.getByRole("dialog", { name: "疾风山丘" });
    await fieldDialog.waitFor();
    assert((await fieldDialog.textContent()).includes("此处的单位获得游走"));
    await fieldDialog.locator("img").evaluate((img) => img.decode());
    const fieldImage = await fieldDialog.locator("img").boundingBox();
    assert(
      fieldImage.width > fieldImage.height,
      "Battlefield art must read horizontally",
    );
    await p.screenshot({
      path: `community/test-results/readability-battlefield-${viewport.width}.png`,
    });
    await p.keyboard.press("Escape");
    await p.getByTestId("self-rune-zone-toggle").click();
    await p.getByTestId("self-rune-zone-panel").waitFor();
    const firstRune = p.locator('[data-testid^="rune-card-"]').first();
    const rect = await firstRune.boundingBox();
    assert(rect.width >= 44 && rect.height >= 44);
    await firstRune.hover();
    await hover.waitFor({ state: "visible" });
    await p.screenshot({
      path: `community/test-results/readability-runes-${viewport.width}.png`,
    });
    await p.mouse.down();
    assert.equal(await hover.isVisible(), false);
    await p.mouse.up();
    await p.waitForTimeout(500);
    assert(
      (await p.evaluate(
        () =>
          __r(841)
            .useGameStore.getState()
            .player.activeRunes.filter((r) => r.runeStatus?.tapped).length,
      )) >= 1,
    );
    // A real mouse drag after previewing still reaches the original play action.
    await p.mouse.click(800, 35); // dismiss the upstream rune drawer
    await p.getByTestId("self-rune-zone-panel").waitFor({ state: "hidden" });
    const hand = p.getByTestId("card-flight:sandbox_card_p1-hand-1");
    await inspect(hand, "灼焰飞龙");
    const from = await hand.boundingBox(),
      to = await p.getByTestId("base-zone:self").boundingBox();
    await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await p.mouse.down();
    assert.equal(await hover.isVisible(), false);
    await p.mouse.move(to.x + to.width * 0.65, to.y + to.height / 2, {
      steps: 16,
    });
    await p.mouse.up();
    for (let step = 0; step < 40; step++) {
      const done = await p.evaluate(() => {
        const s = __r(841).useGameStore.getState();
        if (s.player.hand.length === 0) return true;
        if (Object.keys(s.pendingCommands).length) return false;
        if (s.interaction.prompt?.kind.type === "extraCost")
          s.confirmExtraCost([]);
        else if (s.interaction.current?.passKind === "reaction")
          s.passReactionFocus(s.interaction.current.ownerId);
        return false;
      });
      if (done) break;
      await p.waitForTimeout(150);
    }
    assert.equal(
      await p.evaluate(
        () => __r(841).useGameStore.getState().player.hand.length,
      ),
      0,
      "Mouse drag should play the hovered card",
    );
    report.push({
      viewport,
      cardHover: true,
      pinned: true,
      battlefield: true,
      hiddenCardsProtected: true,
      runeTarget: rect,
      mouseDrag: true,
    });
    await p.close();
  }
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("pageerror", (e) => errors.push(e.stack));
  await p.goto(origin + "/fuxuan/");
  await p.getByText("构筑", { exact: true }).click();
  await p.getByText("新建卡组", { exact: true }).click();
  const builderImage = p.locator('img[src*="/card-images/"]').first();
  const builderRect = await builderImage.boundingBox();
  await p.mouse.move(
    builderRect.x + builderRect.width / 2,
    builderRect.y + builderRect.height / 2,
  );
  await p.getByTestId("local-card-hover").waitFor({ state: "visible" });
  await p.keyboard.press("i");
  await p.locator(".fx-modal:not([hidden])").waitFor();
  assert((await p.locator(".fx-reader-description").innerText()).length > 10);
  await p.keyboard.press("Escape");
  await p.reload();
  await p.getByText("人机对战 // VS AI", { exact: true }).click();
  await p.getByTestId("battlefield-pick-panel").waitFor();
  await p.waitForTimeout(1000);
  await p.getByText("?", { exact: true }).first().hover();
  await p.waitForTimeout(350);
  assert.equal(await p.getByTestId("local-card-hover").isVisible(), false);
  await p.getByText("?", { exact: true }).first().click();
  const pick = p.getByTestId("battlefield-pick-card-front").first();
  await pick.waitFor();
  const pickRect = await pick.boundingBox();
  await p.mouse.move(
    pickRect.x + pickRect.width / 2,
    pickRect.y + pickRect.height / 2,
  );
  await p.getByTestId("local-card-hover").waitFor({ state: "visible" });
  await p
    .getByTestId("local-card-hover")
    .locator("img")
    .evaluate((img) => img.decode());
  await p.screenshot({
    path: "community/test-results/readability-pregame.png",
  });
  report.push({ deckBuilder: true, pregameBattlefield: true });
  await p.close();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "community/test-results/readability-results.json",
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(JSON.stringify({ report, errors }));
} finally {
  await b.close();
}
