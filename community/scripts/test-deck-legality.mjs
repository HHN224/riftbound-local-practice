import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import legality from "../public/local/deck-legality.cjs";

const read = async (name) =>
  JSON.parse(
    await fs.readFile(new URL("../public/local/" + name, import.meta.url), "utf8"),
  );
const policy = await read("banlist.json");
const pool = await read("ai-legal-decks.json");
const recommended = (await read("recommended-decks.json")).decks;
const before = legality.create(policy, pool, { now: "2026-11-22" });
const after = legality.create(policy, pool, { now: "2026-11-23" });
const named = (list, name) => list.find((deck) => deck.name === name);

test("November bans stay legal until 23 November and then match only their own printing", () => {
  assert.equal(policy.checked, "2026-11-18");
  assert.equal(policy.upcomingEffective, "2026-11-23");
  assert.equal(
    policy.cards.filter((card) => card.effective === "2026-11-23").length,
    10,
  );
  for (const id of ["OGN·160/298", "OGN·160-298.webp", "UNL-215/219", "RAD·043a/167"])
    assert.equal(before.issues({ mainDeckCardIds: [id] }).length, 0, id);
  assert.equal(after.issues({ mainDeckCardIds: ["UNL-160/219"] }).length, 0);
  assert.equal(after.issues({ mainDeckCardIds: ["RAD·114/167"] }).length, 0);
  assert.equal(after.issues({ mainDeckCardIds: ["VEN·041"] }).length, 0);
  const aurora = after.issues({ mainDeckCardIds: ["OGN·160-298.webp"] });
  assert.equal(aurora.length, 1);
  assert.equal(aurora[0].nameZh, "闪耀极光");
  assert.match(
    after.error({ mainDeckCardIds: ["RAD·043/167"] }),
    /锐雯 - 断剑之誓（禁卡表 2026-11-23）/,
  );
  assert.match(before.error({ mainDeckCardIds: ["OGN·183/298"] }), /2026-09-18/);
});

test("published lists that pick up a November ban remain usable until that date", () => {
  const jayce = named(recommended, "杰斯 · 洛杉矶同英雄最佳 · 龙蛋极光");
  const kennen = named(pool.decks, "凯南 · 洛杉矶合法替代");
  const ornn = named(recommended, "奥恩 · 洛杉矶八强 · 装备引擎");
  assert.equal(before.error(jayce), "");
  assert.match(after.error(jayce), /闪耀极光/);
  assert.equal(
    before.resolveMatch({
      deckSelection: ornn,
      opponentDeckSelection: jayce,
    }).payload.opponentDeckSelection,
    jayce,
  );
  assert.equal(
    after.resolveMatch({
      deckSelection: ornn,
      opponentDeckSelection: jayce,
    }).payload.opponentDeckSelection.name,
    "杰斯（四传奇）",
  );
  assert.throws(
    () =>
      after.resolveMatch({
        deckSelection: ornn,
        opponentDeckSelection: kennen,
      }),
    /裂魂者喇煞/,
  );
});
