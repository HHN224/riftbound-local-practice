import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  acceptDownloads: true,
});
const page = await context.newPage(),
  errors = [],
  failed = [],
  external = [];
await fs.mkdir("community/test-results", { recursive: true });
await context.route("**/*", (route) => {
  const url = route.request().url();
  if (
    url.startsWith(origin + "/") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  )
    return route.continue();
  external.push(url);
  return route.abort();
});
page.on("pageerror", (e) => errors.push(e.stack));
page.on("response", (r) => {
  if (r.status() >= 400) failed.push([r.status(), r.url()]);
});
const shelf = page.getByTestId("personal-deck-select"),
  open = () => page.getByTestId("open-personal-decks").click();
const personal = () =>
  page.evaluate(() => FuxuanLocal.personalDecks.store.list());
const count = async () => (await personal()).length;
const codeInput = page.locator(".pd-import textarea");
const submit = () =>
  page.getByRole("button", { name: "导入并保存", exact: true }).click();
try {
  await page.goto(origin + "/fuxuan/");
  await page.waitForFunction(() => !!globalThis.FuxuanLocal?.personalDecks);
  assert.equal(await count(), 2);
  await open();
  assert.equal(await page.locator(".pd-deck").count(), 2);
  await page.getByTestId("personal-deck-search").fill("内瑟斯");
  assert.equal(await page.locator(".pd-deck").count(), 1);
  await page.getByTestId("personal-deck-search").fill("");
  assert.equal(await page.locator(".pd-deck").count(), 2);
  const art = page.locator(".pd-deck img").first();
  await art.hover();
  await page.getByTestId("local-card-hover").waitFor({ state: "visible" });
  await art.click({ button: "right" });
  await page.locator(".fx-modal:not([hidden])").waitFor();
  await page.keyboard.press("Escape");
  assert(await page.getByRole("dialog", { name: "个人卡组列表" }).isVisible());
  await page.screenshot({
    path: "community/test-results/personal-decks-1366.png",
  });
  const ornn = page.locator('[data-deck-id="personal-ornn-la-2026"]');
  await ornn.getByRole("button", { name: "使用这套卡组", exact: true }).click();
  assert.equal(await shelf.inputValue(), "personal-ornn-la-2026");
  await page.getByTestId("save-current-deck").click();
  assert.equal(await count(), 2);
  await page.reload();
  await page.waitForFunction(() => !!FuxuanLocal.personalDecks);
  assert.equal(await shelf.inputValue(), "personal-ornn-la-2026");
  // Round trip the author's native deck code, including all sideboard copies.
  const code = await page.evaluate(() =>
    __r(1327).exportDeckToCode(
      FuxuanLocal.personalDecks.store.get("personal-ornn-la-2026"),
      __r(944),
    ),
  );
  await open();
  await codeInput.fill(code);
  await page.locator('input[name="deckName"]').fill("奥恩练习");
  await submit();
  await page
    .locator(".pd-import-status")
    .filter({ hasText: "已保存" })
    .waitFor();
  assert.equal(await count(), 2);
  let saved = await personal();
  assert.equal(
    saved.find((d) => d.id === "personal-ornn-la-2026").name,
    "奥恩练习",
  );
  assert.equal(
    saved.find((d) => d.id === "personal-ornn-la-2026").source.player,
    "MICE TheManLand",
  );
  await codeInput.fill("this is not a deck");
  await submit();
  assert.equal(await count(), 2);
  assert(
    !(await page.locator(".pd-import-status").innerText()).includes("已保存"),
  );
  const third = await page.evaluate(() => {
    const d = __r(841)
      .deckStore.listDecks()
      .find((d) => d.id.startsWith("preset_"));
    return { ...d, name: "导入的个人卡组" };
  });
  await page.getByLabel("读取卡组文件").setInputFiles({
    name: "deck.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, decks: [third] })),
  });
  await page.waitForFunction(() =>
    document.querySelector(".pd-import textarea").value.startsWith("{"),
  );
  await submit();
  await page
    .locator(".pd-import-status")
    .filter({ hasText: "已保存" })
    .waitFor();
  assert.equal(await count(), 3);
  // A backup containing an unknown card is rejected atomically.
  const before = JSON.stringify(await personal());
  const invalid = {
    ...third,
    name: "坏卡表",
    mainDeckCardIds: ["UNKNOWN-999", ...third.mainDeckCardIds.slice(1)],
  };
  await codeInput.fill(
    JSON.stringify({ schemaVersion: 1, decks: [third, invalid] }),
  );
  await submit();
  assert.equal(JSON.stringify(await personal()), before);
  assert(
    (await page.locator(".pd-import-status").innerText()).includes("找不到"),
  );
  const row = page.locator('[data-deck-id="personal-ornn-la-2026"]');
  await row.getByRole("button", { name: "重命名", exact: true }).click();
  await row.getByLabel("新的卡组名称").fill("我的装备奥恩");
  await row.getByRole("button", { name: "保存名称", exact: true }).click();
  await row.getByRole("heading", { name: "我的装备奥恩" }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("backup-personal-decks").click();
  const download = await downloadPromise;
  const backup = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  assert.equal(backup.decks.length, 3);
  // Original builder saves automatically synchronize to the personal snapshot.
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByText("保存卡组", { exact: true }).waitFor();
  await page.waitForTimeout(600);
  assert.equal(await page.locator(".pd-shelf").isVisible(), false);
  await page.getByText("保存卡组", { exact: true }).click();
  await page.waitForFunction(() => FuxuanLocal.screen === "menu");
  assert.equal(
    (await personal()).find((d) => d.id === "personal-ornn-la-2026").name,
    "我的装备奥恩",
  );
  await open();
  const nasus = page.locator('[data-deck-id="personal-nasus-la-2026"]');
  await nasus.getByRole("button", { name: "移出个人列表" }).click();
  await nasus.getByRole("button", { name: "确认移出" }).click();
  assert.equal(await count(), 2);
  await page.reload();
  await page.waitForFunction(() => !!FuxuanLocal.personalDecks);
  assert.equal(await count(), 2);
  // Restore the user's downloaded backup through the import UI.
  await open();
  await codeInput.fill(JSON.stringify(backup));
  await submit();
  assert.equal(await count(), 3);
  await page.getByTestId("close-personal-decks").click();
  await page.evaluate(() =>
    __r(841).deckStore.deleteDeck("personal-ornn-la-2026"),
  );
  assert(
    (await personal()).some((deck) => deck.id === "personal-ornn-la-2026"),
  );
  await shelf.selectOption("personal-ornn-la-2026");
  assert(
    await page.evaluate(
      () => !!__r(841).deckStore.getDeck("personal-ornn-la-2026"),
    ),
  );
  // Fast switching does not disturb opponents/settings, and each list reaches
  // the original native game's action phase with its chosen hero and legend.
  const games = [];
  for (const hero of ["奥恩", "内瑟斯"]) {
    const d = (await personal()).find((d) => d.heroName === hero);
    await shelf.selectOption(d.id);
    await page.getByText("人机对战 // VS AI", { exact: true }).click();
    assert.equal(await page.locator(".pd-shelf").isVisible(), false);
    let state;
    for (let n = 0; n < 100; n++) {
      state = await page.evaluate(() => {
        const s = __r(841).useGameStore.getState(),
          p = s.preGame;
        if (!Object.keys(s.pendingCommands).length) {
          if (p.battlefieldPick?.myPickPending) s.confirmOpponentBattlefield();
          else if (p.legendDraft?.isPending)
            (p.legendDraft.stage === "ban"
              ? s.banLegend
              : s.pickSecondaryLegend)(p.legendDraft.availableTemplateIds[0]);
          else if (p.dice?.isMyTurnToRoll) s.rollPreGameDice();
          else if (p.dice?.iAmWinner && p.dice.stage === "choosing")
            s.chooseFirstPlayer("first");
          else if (p.sideboard?.isPending)
            s.submitSideboard(
              s.player.heroSlot.id,
              s.player.mainDeck.map((c) => c.id),
              s.player.sideboard.map((c) => c.id),
            );
          else if (p.mulligan?.isPending) s.submitMulligan([]);
          else if (s.interaction.current?.passKind === "reaction")
            s.passReactionFocus(s.interaction.current.ownerId);
          else if (s.interaction.current?.passKind === "spellDuel")
            s.passSpellDuelFocus(s.interaction.current.ownerId);
          else if (s.interaction.prompt?.kind.type === "optional")
            s.confirmOptionalChoice(false);
        }
        return {
          phase: s.phase,
          legend: s.player.legendCard?.templateId,
          hero: s.player.heroSlot?.templateId,
          errors: s.lastErrors,
          interaction: s.interaction.current,
        };
      });
      assert.deepEqual(state.errors, []);
      if (state.phase === "action") break;
      await page.waitForTimeout(250);
    }
    assert.equal(state.phase, "action");
    assert.equal(state.legend, d.legendCardId);
    assert.equal(state.hero, d.heroCardId);
    games.push({ ...state, name: d.name });
    await page.screenshot({
      path: `community/test-results/personal-game-${d.heroName}.png`,
    });
    await page.reload();
    await page.waitForFunction(() => !!FuxuanLocal.personalDecks);
  }
  // Existing entries cannot be silently evicted when the upstream cache is full.
  const capacity = await page.evaluate(() => {
    const s = __r(841).deckStore;
    const template = s.listDecks()[0];
    while (s.listDecks().length < 50)
      s.saveDeck({ ...template, id: "fill-" + s.listDecks().length });
    const before = JSON.stringify(s.listDecks());
    let message;
    try {
      s.saveDeck({ ...template, id: "should-not-evict" });
    } catch (e) {
      message = e.message;
    }
    return {
      message,
      unchanged: before === JSON.stringify(s.listDecks()),
    };
  });
  assert(capacity.message.includes("已满"));
  assert(capacity.unchanged);
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  assert.deepEqual(external, []);
  const result = {
    savedAcrossReload: true,
    codeImport: true,
    fileImport: true,
    deduplicated: true,
    backupRestored: true,
    invalidImportAtomic: true,
    nativeBuilderSync: true,
    removalSurvivesReload: true,
    capacity,
    games,
    errors,
    failed,
    external,
  };
  await fs.writeFile(
    "community/test-results/personal-decks-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
