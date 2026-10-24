export const PERSONAL_DECK_KEY = "fuxuan:personalDecks:v1";
const zones = [
  "mainDeckCardIds",
  "runeCardIds",
  "battlefieldCardIds",
  "sideboardCardIds",
  "secondaryLegendCardIds",
];

export function deckFingerprint(deck) {
  return JSON.stringify([
    deck.legendCardId,
    deck.heroCardId,
    ...zones.map((zone) => [...(deck[zone] || [])].sort()),
  ]);
}

// A separate snapshot, rather than favorites pointing at the upstream's bounded
// 50-deck list. Removing an upstream entry must not lose a saved personal deck.
export function createPersonalDeckStore(storage, validate) {
  function read() {
    const raw = storage.getItem(PERSONAL_DECK_KEY);
    if (!raw)
      return { schemaVersion: 1, decks: [], seeded: [], migratedLegacy: false };
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      throw Error(
        "个人卡组数据无法读取，原数据已保留。请先备份浏览器存储后再恢复。",
      );
    }
    if (
      value?.schemaVersion !== 1 ||
      !Array.isArray(value.decks) ||
      !Array.isArray(value.seeded)
    )
      throw Error("个人卡组数据格式不受支持，原数据已保留。");
    return value;
  }
  function write(value) {
    // setItem is atomic. A quota/permission failure propagates to the UI; never
    // report success or update an in-memory list before persistence succeeds.
    try {
      storage.setItem(PERSONAL_DECK_KEY, JSON.stringify(value));
    } catch {
      throw Error(
        "卡组未能保存：浏览器存储不可用或空间不足。请先导出备份并检查浏览器设置。",
      );
    }
  }
  function merge(value, deck) {
    validate(deck);
    const existing =
      value.decks.find((d) => d.id === deck.id) ||
      value.decks.find((d) => deckFingerprint(d) === deckFingerprint(deck));
    const saved = {
      ...deck,
      id: existing?.id || deck.id,
      createdAt: existing?.createdAt || deck.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    if (existing && deckFingerprint(existing) === deckFingerprint(deck)) {
      saved.source ??= existing.source;
      saved.sourceCards ??= existing.sourceCards;
    }
    const index = value.decks.findIndex((d) => d.id === saved.id);
    if (index < 0) value.decks.unshift(saved);
    else value.decks[index] = saved;
    return saved;
  }
  return {
    list: () => read().decks,
    get: (id) => read().decks.find((d) => d.id === id),
    save(deck) {
      const value = read(),
        saved = merge(value, deck);
      write(value);
      return saved;
    },
    saveMany(decks) {
      const value = read();
      const saved = decks.map((deck) => merge(value, deck));
      write(value);
      return saved;
    },
    remove(id) {
      const value = read();
      value.decks = value.decks.filter((d) => d.id !== id);
      write(value);
    },
    initialize(recommended, legacy) {
      const value = read();
      const skipped = [];
      let changed = false;
      for (const deck of recommended) {
        if (value.seeded.includes(deck.id)) continue;
        merge(value, deck);
        value.seeded.push(deck.id);
        changed = true;
      }
      if (!value.migratedLegacy) {
        for (const deck of legacy) {
          try {
            merge(value, deck);
          } catch (error) {
            skipped.push({ name: deck.name || deck.id, reason: error.message });
          }
        }
        value.migratedLegacy = true;
        changed = true;
      }
      if (changed) write(value);
      return skipped;
    },
    backup: () => ({ schemaVersion: 1, decks: read().decks }),
  };
}
