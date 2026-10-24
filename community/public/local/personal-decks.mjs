import {
  createPersonalDeckStore,
  PERSONAL_DECK_KEY,
} from "./personal-deck-store.mjs";

const shelf = document.createElement("aside");
shelf.className = "pd-shelf";
shelf.hidden = true;
shelf.innerHTML =
  '<label>我的练牌卡组<select aria-label="快速切换个人卡组" data-testid="personal-deck-select"></select></label><button type="button" data-testid="save-current-deck">保存当前卡组</button><button type="button" class="pd-primary" data-testid="open-personal-decks">个人卡组列表</button>';
const overlay = document.createElement("div");
overlay.className = "pd-overlay";
overlay.hidden = true;
overlay.innerHTML =
  '<section class="pd-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-title"><header><div><span class="pd-eyebrow">LOCAL COLLECTION</span><h1 id="pd-title">个人卡组列表</h1><p>导入一次，保存后随时切换。卡组保存在当前浏览器。</p></div><button type="button" data-testid="close-personal-decks">关闭 · Esc</button></header><div class="pd-tools"><label>搜索卡组<input type="search" placeholder="卡组名、英雄名…" data-testid="personal-deck-search"></label><button type="button" data-testid="backup-personal-decks">导出全部备份</button></div><p class="pd-status" role="status" aria-live="polite"></p><div class="pd-body"><div class="pd-list" data-testid="personal-deck-list"></div><form class="pd-import"><h2>导入并保存卡组</h2><p>支持符玄 / Piltover Archive 卡组码，以及此处导出的 JSON 备份。网页上的卡组请先复制卡组码。</p><label>卡组名称<input name="deckName" maxlength="100" placeholder="可选，留空使用原名称"></label><label>卡组码或备份 JSON<textarea name="deckCode" required spellcheck="false" placeholder="在此粘贴卡组码或 JSON…" rows="8"></textarea></label><label class="pd-file">或读取本地文件<input type="file" accept=".json,.txt" aria-label="读取卡组文件"></label><button type="submit" class="pd-primary">导入并保存</button><p class="pd-import-status" role="alert"></p></form></div></section>';
const toast = document.createElement("div");
toast.className = "pd-toast";
toast.hidden = true;
toast.setAttribute("role", "status");
document.body.append(shelf, overlay, toast);
const select = shelf.querySelector("select"),
  list = overlay.querySelector(".pd-list"),
  search = overlay.querySelector('input[type="search"]'),
  form = overlay.querySelector("form"),
  status = overlay.querySelector(".pd-status");
let store, upstream, catalog, byId, initialization, previousFocus, toastTimer;
const clone = (value) => JSON.parse(JSON.stringify(value));
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const notify = (message) => {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4500);
};
const explain = (error) =>
  error instanceof Error ? error.message : String(error);

function validate(deck) {
  if (
    !deck ||
    typeof deck.id !== "string" ||
    typeof deck.name !== "string" ||
    !deck.name.trim()
  )
    throw Error("卡组缺少名称或编号。");
  for (const [zone, count, label] of [
    ["mainDeckCardIds", 39, "主牌（除英雄外）"],
    ["runeCardIds", 12, "符文"],
    ["battlefieldCardIds", 3, "战场"],
  ])
    if (!Array.isArray(deck[zone]) || deck[zone].length !== count)
      throw Error(`${label}需要 ${count} 张。`);
  if (
    !Array.isArray(deck.sideboardCardIds) ||
    deck.sideboardCardIds.length > 10 ||
    !Array.isArray(deck.secondaryLegendCardIds || [])
  )
    throw Error("备牌最多 10 张，副传奇格式必须正确。");
  const ids = [
    deck.legendCardId,
    deck.heroCardId,
    ...deck.mainDeckCardIds,
    ...deck.runeCardIds,
    ...deck.battlefieldCardIds,
    ...deck.sideboardCardIds,
    ...(deck.secondaryLegendCardIds || []),
  ];
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length)
    throw Error(
      "本地卡池找不到卡牌：" + [...new Set(missing)].slice(0, 5).join("、"),
    );
  const legend = byId.get(deck.legendCardId),
    hero = byId.get(deck.heroCardId);
  if (
    legend.type !== "legendary" ||
    hero.type !== "main" ||
    !String(hero.subType).includes("hero")
  )
    throw Error("请选择正确的传奇和英雄单位。");
  if (
    [...deck.mainDeckCardIds, ...deck.sideboardCardIds].some(
      (id) => byId.get(id).type !== "main",
    )
  )
    throw Error("主牌或备牌区包含类型错误的卡牌。");
  if (
    deck.runeCardIds.some((id) => byId.get(id).type !== "rune") ||
    deck.battlefieldCardIds.some((id) => byId.get(id).type !== "battlefield")
  )
    throw Error("符文或战场区包含类型错误的卡牌。");
  const rules = __r(178),
    secondary = (deck.secondaryLegendCardIds || []).map((id) => byId.get(id));
  const errors = [
    ...rules.checkSecondaryLegends(legend, secondary),
    ...rules.checkSecondaryLegendDeckRequirements(
      [hero, ...deck.mainDeckCardIds.map((id) => byId.get(id))],
      secondary.length,
    ),
  ];
  const copyError = rules.getCombinedDeckCopyLimitError([
    hero,
    ...deck.mainDeckCardIds.map((id) => byId.get(id)),
    ...deck.sideboardCardIds.map((id) => byId.get(id)),
  ]);
  if (errors.length || copyError) throw Error(errors[0] || copyError);
  if (
    !Array.isArray(deck.heroColors) ||
    JSON.stringify(deck.heroColors) !==
      JSON.stringify(legend.factions.slice(0, 2))
  )
    throw Error("卡组阵营与所选传奇不一致。");
}

async function ready() {
  if (initialization) return initialization;
  initialization = (async () => {
    upstream = __r(841).deckStore;
    catalog = __r(944);
    byId = new Map(catalog.map((card) => [card.id, card]));
    store = createPersonalDeckStore(localStorage, validate);
    upstream.ensureDefaultDecks();
    const response = await fetch("/local/recommended-decks.json");
    if (!response.ok) throw Error("推荐卡组读取失败，请刷新重试。");
    const recommendations = await response.json();
    const skipped = store.initialize(
      recommendations.decks,
      upstream.listDecks().filter((deck) => !deck.id.startsWith("preset_")),
    );
    if (skipped.length)
      notify(
        `${skipped.length} 套旧卡组暂不符合当前卡池要求，仍保留在原构筑列表中。`,
      );
    // Capture future imports/builds made through the author's own screens.
    const originalSave = upstream.saveDeck.bind(upstream);
    upstream.saveDeck = (deck) => {
      if (!deck.id.startsWith("preset_")) validate(deck);
      if (
        !upstream.getDeck(deck.id) &&
        upstream.listDecks().length >= __r(1253).MAX_DECKS
      )
        throw Error(
          "原构筑列表已满（50 套）。请先在构筑页删除不用的条目；已存入个人列表的卡组仍会保留。",
        );
      originalSave(deck);
      if (!upstream.getDeck(deck.id))
        throw Error("原构筑列表保存失败，请检查浏览器存储。");
      if (!deck.id.startsWith("preset_")) store.save(deck);
      render();
    };
    FuxuanLocal.personalDecks = { store, validate, use: useDeck };
    render();
  })();
  try {
    await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

function currentId() {
  return upstream.getSelectedDeckId();
}
function render() {
  if (!store) return;
  const decks = store.list(),
    current = currentId();
  select.replaceChildren();
  const placeholder = node("option", "选择一套个人卡组…");
  placeholder.value = "";
  select.append(placeholder);
  for (const deck of decks) {
    const option = node("option", deck.name);
    option.value = deck.id;
    select.append(option);
  }
  select.value = decks.some((deck) => deck.id === current) ? current : "";
  const query = search.value.trim().toLocaleLowerCase();
  list.replaceChildren();
  for (const deck of decks.filter((deck) =>
    [deck.name, deck.heroName, deck.legendName].some((text) =>
      text?.toLocaleLowerCase().includes(query),
    ),
  )) {
    const card = node("article", null, "pd-deck");
    card.dataset.deckId = deck.id;
    const image = node("img");
    image.src = __r(942).cardInfoImageUrl(byId.get(deck.legendCardId));
    image.alt = deck.legendName;
    image.draggable = false;
    const info = node("div", null, "pd-deck-info");
    info.append(
      node("h2", deck.name),
      node(
        "p",
        `${deck.legendName} · ${deck.heroName}　主牌 40 / 符文 12 / 战场 3 / 备牌 ${deck.sideboardCardIds.length}`,
      ),
    );
    if (deck.source) {
      const source = node(
        "a",
        `${deck.source.event} · ${deck.source.player} · ${deck.source.label}`,
      );
      if (/^https:\/\//.test(deck.source.url)) {
        source.href = deck.source.url;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
      }
      info.append(source);
    }
    const actions = node("div", null, "pd-deck-actions");
    const action = (label, fn, className) => {
      const button = node("button", label, className);
      button.type = "button";
      button.addEventListener("click", () => run(fn));
      actions.append(button);
      return button;
    };
    action(
      current === deck.id ? "当前使用" : "使用这套卡组",
      () => useDeck(deck.id),
      "pd-primary",
    );
    action("编辑", () => {
      activate(deck);
      close();
      FuxuanLocal.editPersonalDeck(deck.id);
    });
    action("导出", () =>
      download({ schemaVersion: 1, decks: [deck] }, deck.name + ".json"),
    );
    action("重命名", () => rename(card, deck));
    action("移出个人列表", () => remove(card, deck));
    card.append(image, info, actions);
    list.append(card);
  }
  if (!list.childElementCount)
    list.append(
      node(
        "p",
        decks.length
          ? "没有匹配的卡组。"
          : "还没有个人卡组。导入卡组码，或在首页保存当前卡组。",
        "pd-empty",
      ),
    );
}
function activate(deck) {
  validate(deck);
  upstream.saveDeck(clone(deck));
  upstream.setSelectedDeckId(deck.id);
  if (upstream.getSelectedDeckId() !== deck.id)
    throw Error("切换卡组失败，请检查浏览器存储。");
  FuxuanLocal.refreshMenu();
  render();
}
function useDeck(id) {
  const deck = store.get(id);
  if (!deck) throw Error("这套个人卡组已被移出。");
  activate(deck);
  close();
  notify("已切换：" + deck.name + "。点击「人机对战」开始练习。");
}
function rename(card, deck) {
  const input = node("input");
  input.value = deck.name;
  input.maxLength = 100;
  input.setAttribute("aria-label", "新的卡组名称");
  const save = node("button", "保存名称");
  save.type = "button";
  const cancel = node("button", "取消");
  cancel.type = "button";
  const row = node("div", null, "pd-inline");
  row.append(input, save, cancel);
  card.append(row);
  input.focus();
  cancel.onclick = () => row.remove();
  save.onclick = () =>
    run(() => {
      const name = input.value.trim();
      if (!name) throw Error("卡组名称不能为空。");
      const updated = store.save({ ...deck, name });
      if (upstream.getDeck(updated.id)) upstream.saveDeck(updated);
      FuxuanLocal.refreshMenu();
      render();
      status.textContent = "名称已保存。";
    });
}
function remove(card, deck) {
  const row = node("div", null, "pd-inline");
  row.append(node("span", "仅从个人列表移出，原构筑条目会保留。"));
  const yes = node("button", "确认移出"),
    cancel = node("button", "取消");
  yes.type = cancel.type = "button";
  row.append(yes, cancel);
  card.append(row);
  yes.focus();
  cancel.onclick = () => row.remove();
  yes.onclick = () =>
    run(() => {
      store.remove(deck.id);
      render();
      status.textContent = "已移出个人列表。";
    });
}
function download(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = node("a");
  link.href = url;
  link.download = name.replace(/[<>:"/\\|?*]/g, "-");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function parse(text) {
  if (!text.trim()) throw Error("请先粘贴卡组码或备份 JSON。");
  if (text.length > 500000) throw Error("导入内容过大，请分批导入。");
  if (text.trim().startsWith("{")) {
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw Error("JSON 格式错误，原有卡组未改动。");
    }
    if (!json || typeof json !== "object" || Array.isArray(json))
      throw Error("请导入卡组对象或个人卡组备份。");
    if (Array.isArray(json.decks) && json.schemaVersion !== 1)
      throw Error("不支持此备份版本，原有卡组未改动。");
    const decks = Array.isArray(json.decks) ? json.decks : [json];
    if (!decks.length || decks.length > 100)
      throw Error("一次可以导入 1–100 套卡组。");
    return decks.map((deck) => ({
      ...deck,
      id: upstream.generateDeckId(),
      secondaryLegendCardIds: deck.secondaryLegendCardIds || [],
      sideboardCardIds: deck.sideboardCardIds || [],
    }));
  }
  const result = __r(1327).importDeckFromCode(
    text.trim(),
    catalog,
    upstream.generateDeckId,
    Date.now(),
  );
  if (!result.ok) throw Error(result.reason || "卡组码无法解析。");
  if (result.missing?.length || result.coverage?.missing)
    throw Error("卡组包含本地卡池未收录的牌，未保存不完整卡组。");
  return [result.deck];
}
function close() {
  overlay.hidden = true;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}
async function run(fn) {
  try {
    await ready();
    await fn();
  } catch (error) {
    status.textContent = explain(error);
    notify(explain(error));
  }
}
async function open() {
  await ready();
  previousFocus = document.activeElement;
  render();
  status.textContent = "";
  overlay.hidden = false;
  search.focus();
}
shelf.querySelector('[data-testid="open-personal-decks"]').onclick = () =>
  run(open);
shelf.querySelector('[data-testid="save-current-deck"]').onclick = () =>
  run(() => {
    const deck = upstream.getDeck(currentId());
    if (!deck) throw Error("请先在对战页选择一套卡组。");
    store.save(clone(deck));
    render();
    notify("已保存到个人卡组：" + deck.name);
  });
select.onchange = () => {
  if (select.value) run(() => useDeck(select.value));
};
overlay.querySelector('[data-testid="close-personal-decks"]').onclick = close;
overlay.querySelector('[data-testid="backup-personal-decks"]').onclick = () =>
  run(() => download(store.backup(), "符玄战场-个人卡组备份.json"));
overlay.onclick = (event) => {
  if (event.target === overlay) close();
};
search.oninput = () => run(render);
form.querySelector('input[type="file"]').onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 500000) {
    form.querySelector(".pd-import-status").textContent =
      "文件过大，请分批导入。";
    return;
  }
  form.elements.deckCode.value = await file.text();
};
form.onsubmit = async (event) => {
  event.preventDefault();
  const error = form.querySelector(".pd-import-status");
  error.textContent = "";
  try {
    await ready();
    const decks = parse(form.elements.deckCode.value);
    if (decks.length === 1 && form.elements.deckName.value.trim())
      decks[0].name = form.elements.deckName.value.trim();
    const saved = store.saveMany(decks);
    render();
    error.textContent = `已保存 ${new Set(saved.map((d) => d.id)).size} 套卡组，可在左侧点击使用。`;
    form.elements.deckCode.value = "";
    form.elements.deckName.value = "";
  } catch (e) {
    error.textContent = explain(e);
  }
};
document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.defaultPrevented ||
      overlay.hidden ||
      document.querySelector(".fx-modal:not([hidden])")
    )
      return;
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      const focusable = [
        ...overlay.querySelectorAll("button,input,select,textarea,a[href]"),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1).focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === focusable.at(-1)
      ) {
        event.preventDefault();
        focusable[0].focus();
      }
    }
  },
  true,
);
window.addEventListener("storage", (event) => {
  if (
    event.key === PERSONAL_DECK_KEY ||
    event.key === "riftbound:selectedDeckId"
  )
    run(render);
});
function screenChanged() {
  shelf.hidden = FuxuanLocal.screen !== "menu";
  if (shelf.hidden) close();
  else run(render);
}
document.addEventListener("fuxuan:screen", screenChanged);
if (FuxuanLocal.screen) screenChanged();
