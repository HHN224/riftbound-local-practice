import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import legality from "../public/local/deck-legality.cjs";
const read = async (name) =>
  JSON.parse(
    await fs.readFile(
      new URL("../public/local/" + name, import.meta.url),
      "utf8",
    ),
  );
const policy = await read("banlist.json"),
  pool = await read("ai-legal-decks.json"),
  recommended = (await read("recommended-decks.json")).decks;
const rules = legality.create(policy, pool),
  good = recommended[0];
assert.equal(policy.cards.length, 12);
for (const card of policy.cards)
  for (const id of card.templateKeys) {
    assert(
      rules
        .issues({ mainDeckCardIds: [id.replace(":", "-")] })
        .some((c) => c.name === card.name),
    );
  }
assert.equal(
  rules.issues({ heroCardId: "RAD·061/167", mainDeckCardIds: ["SFD·019/221"] })
    .length,
  0,
);
for (const d of pool.decks) assert.equal(rules.error(d), "", d.name);
for (const zone of [
  "mainDeckCardIds",
  "sideboardCardIds",
  "battlefieldCardIds",
]) {
  const bad = { ...good, [zone]: ["OGN·183/298"] };
  assert.throws(() => rules.resolveMatch({ deckSelection: bad }), /卡牌骗术/);
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
try {
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto(origin + "/fuxuan/");
  await page.waitForFunction(() => FuxuanLocal.personalDecks);
  const audit = await page.evaluate(() => {
    const rules = FuxuanLocal.deckRules,
      originals = __r(1253).PRESET_DECKS_AS_SAVED,
      bad = originals.filter((d) => rules.issues(d).length);
    for (const d of FuxuanAiDecks.decks) FuxuanLocal.personalDecks.validate(d);
    return bad.map((d) => {
      const resolved = rules.resolveMatch({
        deckSelection: FuxuanAiDecks.decks[0],
        opponentDeckSelection: d,
      });
      if (
        FuxuanAiDecks.heroNames[d.heroCardId] !==
        FuxuanAiDecks.heroNames[
          resolved.payload.opponentDeckSelection.heroCardId
        ]
      )
        throw Error("Wrong AI champion");
      return {
        before: d.name,
        after: resolved.payload.opponentDeckSelection.name,
        legend: d.legendCardId,
      };
    });
  });
  assert.equal(audit.length, 10);
  const bad = {
    ...good,
    id: "ban-test",
    name: "禁卡保留测试",
    mainDeckCardIds: ["OGN·183/298", ...good.mainDeckCardIds.slice(1)],
  };
  await page.evaluate((d) => FuxuanLocal.personalDecks.store.save(d), bad);
  await page.getByTestId("open-personal-decks").click();
  await page.getByTestId("personal-deck-search").fill("禁卡保留测试");
  const row = page.locator(".pd-deck").filter({ hasText: "禁卡保留测试" });
  assert(
    await row.getByRole("button", { name: "含禁卡 · 不可使用" }).isDisabled(),
  );
  assert((await row.innerText()).includes("卡牌骗术"));
  assert.equal(
    await row.getByRole("button", { name: "编辑", exact: true }).isEnabled(),
    true,
  );
  assert(
    await page.evaluate(() =>
      FuxuanLocal.personalDecks.store
        .list()
        .some((d) => d.name === "禁卡保留测试"),
    ),
  );
  await row.locator("img").hover(); // Original legend remains readable; no unrelated legend-wide ban.
  await page.getByTestId("close-personal-decks").click();
  const api = await page.evaluate(async (bad) => {
    const response = await fetch(
      "/local-api/command?session=" + FuxuanLocal.transport.session,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "initGame",
          payload: { deckSelection: bad },
        }),
      },
    );
    return { status: response.status, body: await response.json() };
  }, bad);
  assert.equal(api.status, 400);
  assert(api.body.error.includes("卡牌骗术"));
  // Real match preparation for each new same-champion replacement, not just a JSON check.
  const starts = [];
  for (const replacement of pool.decks.filter((d) =>
    d.id.startsWith("ai-legal-la-"),
  )) {
    await page.evaluate((d) => {
      __r(841).deckStore.saveDeck(d);
      __r(841).deckStore.setOpponentDeckId(d.id);
      FuxuanLocal.refreshMenu();
    }, replacement);
    await page.getByText("人机对战 // VS AI", { exact: true }).click();
    await page.getByTestId("battlefield-pick-panel").waitFor();
    assert.deepEqual(
      await page.evaluate(() => __r(841).useGameStore.getState().lastErrors),
      [],
    );
    const legend = await page.evaluate(
      () => __r(841).useGameStore.getState().opponent.legendCard?.templateId,
    );
    assert.equal(legend, replacement.legendCardId);
    starts.push(replacement.name);
    await page.reload();
    await page.waitForFunction(() => FuxuanLocal.personalDecks);
  }
  // A real visible banned card is labelled and readable; hidden cards are not
  // marked from their retained template IDs. Sandbox remains a rules lab.
  const draft = JSON.parse(
    await fs.readFile(
      new URL(
        "../sandbox-reference/riftbound-sandbox/assets/before-combat.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  draft.players.p1.hand = [{ ref: "banned-hand", templateId: "OGN·183/298" }];
  await page.evaluate((d) => __r(841).sandboxStore.save(d), draft);
  await page.getByText("构筑", { exact: true }).click();
  await page.getByText("Sandbox", { exact: true }).click();
  await page.getByText("开始", { exact: true }).click();
  const card = page.getByTestId("card:OGN·183/298");
  await card.waitFor();
  await page.waitForTimeout(400);
  assert((await card.getAttribute("class")).includes("fx-banned-card"));
  await card.hover();
  await page.getByTestId("local-card-hover").waitFor({ state: "visible" });
  assert(
    (await page.getByTestId("local-card-hover").innerText()).includes(
      "标准构筑禁用",
    ),
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "community/test-results/banlist-results.json",
    JSON.stringify(
      { audit, starts, personalDecksPreserved: true, apiRejectsBanned: true },
      null,
      2,
    ),
  );
  console.log(
    "PASS: 12 bans and aliases, all 10 old AI lists replaced with same champion, personal deck preserved/disabled, HTTP guard, six native AI starts.",
  );
} finally {
  await browser.close();
}
