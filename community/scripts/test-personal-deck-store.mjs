import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  createPersonalDeckStore,
  PERSONAL_DECK_KEY,
} from "../public/local/personal-deck-store.mjs";
const seeds = JSON.parse(
  await fs.readFile(
    new URL("../public/local/recommended-decks.json", import.meta.url),
    "utf8",
  ),
).decks;
const seedCount = seeds.length;
const copy = (value) => structuredClone(value);
function memory() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    data,
  };
}
function validate(deck) {
  assert.equal(deck.mainDeckCardIds.length, 39);
  assert.equal(deck.runeCardIds.length, 12);
  assert.equal(deck.battlefieldCardIds.length, 3);
  if (deck.name === "invalid") throw Error("invalid deck");
}
test("recommendations and legacy migration run once; explicit removals survive reload", () => {
  const storage = memory(),
    store = createPersonalDeckStore(storage, validate);
  const legacy = {
    ...copy(seeds[0]),
    id: "legacy",
    name: "已有卡组",
    mainDeckCardIds: [
      ...seeds[0].mainDeckCardIds.slice(1),
      seeds[0].mainDeckCardIds.at(-1),
    ],
  };
  store.initialize(seeds, [legacy]);
  assert.equal(store.list().length, seedCount + 1);
  store.remove(seeds[1].id);
  const reloaded = createPersonalDeckStore(storage, validate);
  reloaded.initialize(seeds, [legacy]);
  assert.equal(reloaded.list().length, seedCount);
  assert(!reloaded.get(seeds[1].id));
});
test("reordered copies deduplicate and preserve provenance; renames and edits persist", () => {
  const storage = memory(),
    store = createPersonalDeckStore(storage, validate);
  store.initialize(seeds, []);
  const imported = {
    ...copy(seeds[0]),
    id: "new-import",
    name: "我的奥恩",
    source: undefined,
    sourceCards: undefined,
    mainDeckCardIds: [...seeds[0].mainDeckCardIds].reverse(),
  };
  const saved = store.save(imported);
  assert.equal(saved.id, seeds[0].id);
  assert.equal(store.list().length, seedCount);
  assert.equal(saved.source.player, "MICE TheManLand");
  const reloaded = createPersonalDeckStore(storage, validate);
  assert.equal(reloaded.get(saved.id).name, "我的奥恩");
  const edit = {
    ...saved,
    mainDeckCardIds: [
      ...saved.mainDeckCardIds.slice(1),
      saved.mainDeckCardIds.at(-1),
    ],
  };
  reloaded.save(edit);
  assert.equal(reloaded.list().length, seedCount);
});
test("one malformed deck rejects a whole backup without partially importing", () => {
  const storage = memory(),
    store = createPersonalDeckStore(storage, validate);
  store.initialize([seeds[0]], []);
  const before = storage.getItem(PERSONAL_DECK_KEY);
  assert.throws(() =>
    store.saveMany([seeds[1], { ...seeds[0], name: "invalid" }]),
  );
  assert.equal(storage.getItem(PERSONAL_DECK_KEY), before);
});
test("quota failure preserves the previous saved collection", () => {
  const storage = memory(),
    store = createPersonalDeckStore(storage, validate);
  store.initialize([seeds[0]], []);
  const before = storage.getItem(PERSONAL_DECK_KEY);
  storage.setItem = () => {
    throw Error("QuotaExceededError");
  };
  assert.throws(() => store.save(seeds[1]), /未能保存/);
  assert.equal(storage.getItem(PERSONAL_DECK_KEY), before);
  assert.equal(store.list().length, 1);
});
test("corrupt data is not overwritten by seeding or importing", () => {
  const storage = memory();
  storage.setItem(PERSONAL_DECK_KEY, "{broken");
  const store = createPersonalDeckStore(storage, validate);
  assert.throws(() => store.initialize(seeds, []), /原数据已保留/);
  assert.equal(storage.getItem(PERSONAL_DECK_KEY), "{broken");
});
test("an invalid legacy deck does not block valid recommendations or get deleted", () => {
  const storage = memory(),
    store = createPersonalDeckStore(storage, validate);
  const invalid = { ...copy(seeds[0]), id: "old-invalid", name: "invalid" };
  const skipped = store.initialize(seeds, [invalid]);
  assert.equal(skipped.length, 1);
  assert.equal(store.list().length, seedCount);
  assert.equal(invalid.name, "invalid");
});
test("exported backup round trips and does not share object references", () => {
  const storage = memory(),
    store = createPersonalDeckStore(storage, validate);
  store.initialize(seeds, []);
  const backup = store.backup();
  const second = createPersonalDeckStore(memory(), validate);
  second.saveMany(JSON.parse(JSON.stringify(backup)).decks);
  assert.equal(second.list().length, seedCount);
  backup.decks[0].name = "changed";
  assert.notEqual(store.list()[0].name, "changed");
});
test("adding a recommendation preserves edited decks and previously removed recommendations", () => {
  const storage = memory(),
    store = createPersonalDeckStore(storage, validate);
  const previous = seeds.slice(0, 2),
    added = seeds.slice(2);
  store.initialize(previous, []);
  const edited = store.save({
    ...previous[0],
    name: "我自己的奥恩",
    mainDeckCardIds: [
      ...previous[0].mainDeckCardIds.slice(1),
      previous[0].mainDeckCardIds.at(-1),
    ],
  });
  store.remove(previous[1].id);
  const before = JSON.stringify(store.get(edited.id));
  createPersonalDeckStore(storage, validate).initialize(seeds, []);
  assert.equal(JSON.stringify(store.get(edited.id)), before);
  assert.equal(store.get(previous[1].id), undefined);
  for (const deck of added) assert(store.get(deck.id));
  assert.equal(store.list().length, 1 + added.length);
});
