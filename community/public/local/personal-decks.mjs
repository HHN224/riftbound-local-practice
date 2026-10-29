import {
  createPersonalDeckStore,
  PERSONAL_DECK_KEY,
} from "./personal-deck-store.mjs";

const entry = document.createElement("button");
entry.type = "button";
entry.className = "pd-nav-entry";
entry.dataset.testid = "open-personal-decks";
entry.innerHTML = "<span>我的卡组</span><small>// SAVED</small>";
const pageView = document.createElement("div");
pageView.className = "pd-page";
pageView.hidden = true;
pageView.innerHTML = `
<main class="pd-layout" aria-label="个人卡组列表">
  <header class="pd-header">
    <div><span class="pd-eyebrow">FUXUANBOUND <b>/</b> PERSONAL COLLECTION</span><h1>我的卡组<span class="pd-total"></span></h1><p>你的构筑，你的下一场对局。</p></div>
    <button type="button" class="pd-back" data-testid="close-personal-decks">← 返回首页 <small>ESC</small></button>
  </header>
  <div class="pd-current"><span class="pd-current-label">当前出战 <small>// ACTIVE DECK</small></span><strong class="pd-current-name"></strong><button type="button" data-testid="save-current-deck">＋ 保存当前卡组</button></div>
  <div class="pd-body">
    <section class="pd-library" aria-label="已保存的卡组">
      <div class="pd-tools"><div><h2>已保存的卡组</h2><span class="pd-library-note">选择一套，回到首页开始练牌</span></div><label><span class="pd-sr-only">搜索卡组</span><input type="search" placeholder="搜索卡组、英雄…" data-testid="personal-deck-search"></label></div>
      <p class="pd-status" role="status" aria-live="polite"></p>
      <div class="pd-list" data-testid="personal-deck-list"></div>
    </section>
    <aside class="pd-sidebar">
      <form class="pd-import">
        <span class="pd-eyebrow">IMPORT / 01</span><h2>把新卡组带进来</h2>
        <p>粘贴符玄 / Piltover Archive 卡组码，或导入个人卡组备份。</p>
        <label>卡组名称 <small>选填</small><input name="deckName" maxlength="100" placeholder="留空使用原名称"></label>
        <label>卡组码或 JSON<textarea name="deckCode" required spellcheck="false" placeholder="在这里粘贴卡组码…" rows="5"></textarea></label>
        <label class="pd-file">或读取文件<input type="file" accept=".json,.txt" aria-label="读取卡组文件"></label>
        <button type="submit" class="pd-primary">＋ 导入并保存</button>
        <p class="pd-import-status" role="alert"></p>
      </form>
      <section class="pd-backup"><span class="pd-eyebrow">LOCAL / BACKUP</span><h2>让收藏跟你走</h2><p>卡组保存在当前浏览器。换电脑或浏览器前，先导出一份备份。</p><button type="button" data-testid="backup-personal-decks">↓ 导出全部备份</button></section>
    </aside>
  </div>
  <footer class="pd-footer"><span>符玄战场 · 本地练牌</span><span>保存 · 构筑 · 再来一局</span></footer>
</main>`;
const toast = document.createElement("div");
toast.className = "pd-toast";
toast.hidden = true;
toast.setAttribute("role", "status");
document.body.append(toast);
const list = pageView.querySelector(".pd-list"),
  search = pageView.querySelector('input[type="search"]'),
  form = pageView.querySelector("form"),
  status = pageView.querySelector(".pd-status");
let store, upstream, catalog, byId, initialization, toastTimer;
let returnFocus = false;
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
FuxuanLocal.notify = notify;
const legalitySummary = node("p", null, "pd-legality-summary");
pageView.querySelector(".pd-tools").after(legalitySummary);
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
  return upstream.getSelectedDeckId() ?? upstream.listDecks()[0]?.id;
}
function render() {
  if (!store) return;
  const decks = store.list(),
    current = currentId();
  const illegal = decks.filter(
    (deck) => FuxuanLocal.deckRules.issues(deck).length,
  );
  legalitySummary.textContent = illegal.length
    ? `${illegal.length} 套卡组含禁卡，暂不可用于标准构筑：${illegal.map((d) => d.name).join("、")}。请编辑修正，原卡组已保留。`
    : `全部 ${decks.length} 套个人卡组未命中禁卡表（${FuxuanLocal.deckRules.policy.effective}）。`;
  pageView.querySelector(".pd-total").textContent = String(
    decks.length,
  ).padStart(2, "0");
  pageView.querySelector(".pd-current-name").textContent =
    upstream.getDeck(current)?.name || "尚未选择卡组";
  const query = search.value.trim().toLocaleLowerCase();
  list.replaceChildren();
  for (const deck of decks.filter((deck) =>
    [deck.name, deck.heroName, deck.legendName].some((text) =>
      text?.toLocaleLowerCase().includes(query),
    ),
  )) {
    const card = node("article", null, "pd-deck");
    card.dataset.deckId = deck.id;
    card.classList.toggle("pd-active", current === deck.id);
    const image = node("img");
    image.src = __r(942).cardInfoImageUrl(byId.get(deck.legendCardId));
    image.alt = deck.legendName;
    image.draggable = false;
    const info = node("div", null, "pd-deck-info");
    info.append(
      node(
        "span",
        current === deck.id ? "正在使用 / ACTIVE" : deck.legendName,
        "pd-deck-label",
      ),
      node("h2", deck.name),
      node(
        "p",
        `${deck.heroName} · 40 主牌 / 12 符文 / 3 战场 / ${deck.sideboardCardIds.length} 备牌`,
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
    const problem = FuxuanLocal.deckRules.error(deck);
    if (problem) info.append(node("p", problem, "pd-ban-warning"));
    const action = (label, fn, className) => {
      const button = node("button", label, className);
      button.type = "button";
      button.addEventListener("click", () => run(fn));
      actions.append(button);
      return button;
    };
    const use = action(
      problem
        ? "含禁卡 · 不可使用"
        : current === deck.id
          ? "当前使用"
          : "使用这套卡组",
      () => useDeck(deck.id),
      "pd-primary",
    );
    use.disabled = !!problem;
    action("编辑", () => {
      activate(deck);
      FuxuanLocal.editPersonalDeck(deck.id);
    });
    const more = node("details", null, "pd-more");
    more.append(node("summary", "更多 ···"));
    const menu = node("div", null, "pd-more-menu");
    more.append(menu);
    actions.append(more);
    const extraStart = actions.children.length;
    action("导出", () =>
      download({ schemaVersion: 1, decks: [deck] }, deck.name + ".json"),
    );
    action("重命名", () => rename(card, deck));
    action("移出个人列表", () => remove(card, deck));
    for (const button of [...actions.children].slice(extraStart)) {
      button.addEventListener("click", () => {
        more.open = false;
      });
      menu.append(button);
    }
    card.append(image, info, actions);
    list.append(card);
  }
  if (!list.childElementCount)
    list.append(
      node(
        "p",
        decks.length
          ? "没有匹配的卡组。"
          : "还没有个人卡组。导入卡组码，或使用上方的「保存当前卡组」。",
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
  const problem = FuxuanLocal.deckRules.error(deck);
  if (problem) throw Error(problem);
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
  returnFocus = true;
  FuxuanLocal.closePersonalDecks();
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
  FuxuanLocal.openPersonalDecks();
}
entry.onclick = () => run(open);
pageView.querySelector('[data-testid="save-current-deck"]').onclick = () =>
  run(() => {
    const deck = upstream.getDeck(currentId());
    if (!deck) throw Error("请先在对战页选择一套卡组。");
    store.save(clone(deck));
    render();
    status.textContent = "已保存到个人卡组：" + deck.name;
  });
pageView.querySelector('[data-testid="close-personal-decks"]').onclick = close;
pageView.querySelector('[data-testid="backup-personal-decks"]').onclick = () =>
  run(() => download(store.backup(), "符玄战场-个人卡组备份.json"));
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
    error.textContent = `已保存 ${new Set(saved.map((d) => d.id)).size} 套卡组，可在列表中点击使用。`;
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
      pageView.hidden ||
      document.querySelector(".fx-modal:not([hidden])")
    )
      return;
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      const menu = pageView.querySelector("details[open]");
      if (menu) {
        menu.open = false;
        menu.querySelector("summary").focus();
      } else close();
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
function attachEntry() {
  if (FuxuanLocal.screen !== "menu" || entry.isConnected) return;
  // Match a semantic label from the pinned menu, never generated CSS classes.
  const decks = [...document.querySelectorAll('#root [role="button"]')].find(
    (el) => el.textContent.includes("// DECKS"),
  );
  const bar = decks?.parentElement?.parentElement;
  if (bar) {
    bar.classList.add("pd-menu-nav");
    bar.append(entry);
    if (returnFocus) {
      returnFocus = false;
      entry.focus({ preventScroll: true });
    }
  }
}
let menuScheduled = false;
new MutationObserver(() => {
  if (menuScheduled || FuxuanLocal.screen !== "menu") return;
  menuScheduled = true;
  requestAnimationFrame(() => {
    menuScheduled = false;
    attachEntry();
  });
}).observe(document.getElementById("root"), { childList: true, subtree: true });
FuxuanLocal.mountPersonalDecks = (host) => host.append(pageView);
function screenChanged() {
  pageView.hidden = FuxuanLocal.screen !== "personalDecks";
  if (!pageView.hidden) {
    const host = document.getElementById("personal-decks-host");
    if (host && pageView.parentElement !== host) host.append(pageView);
    run(() => {
      render();
      pageView.querySelector(".pd-back").focus({ preventScroll: true });
    });
  } else if (FuxuanLocal.screen === "menu") {
    attachEntry();
    run(render);
  }
}
document.addEventListener("fuxuan:screen", screenChanged);
if (FuxuanLocal.screen) screenChanged();
