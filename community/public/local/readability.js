(function () {
  "use strict";
  // Inspect only images actually exposed by the UI. Never resolve a card back
  // via its template ID: some original components retain that ID in the DOM.
  const hover = document.createElement("section");
  hover.className = "fx-reader fx-hover";
  hover.dataset.testid = "local-card-hover";
  hover.hidden = true;
  hover.setAttribute("role", "tooltip");
  const modal = document.createElement("div");
  modal.className = "fx-modal";
  modal.hidden = true;
  modal.innerHTML =
    '<section class="fx-reader" role="dialog" aria-modal="true" aria-labelledby="fx-card-title"><button class="fx-close" type="button">关闭 · Esc</button><div class="fx-reader-layout"><div class="fx-art"></div><div class="fx-reader-text"></div></div></section>';
  document.body.append(hover, modal);
  const closeButton = modal.querySelector("button");
  let candidate,
    timer,
    held = false,
    previousFocus,
    catalog;
  const fieldData = new WeakMap();
  const decorativeArt =
    '[data-testid^="battlefield-background:"], [data-testid^="base-legend-background:"], [data-testid="custom-playmat"]';
  const state = () => globalThis.__r?.(841).useGameStore.getState();
  const clean = (text) => String(text || "").replace(/\{\{(.*?)\}\}/g, "$1");
  function textElement(tag, text, className) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function imageFor(card) {
    return card?.templateId ? __r(942).cardFrontImageUrl(card) : null;
  }
  function catalogCard(url) {
    if (!catalog) {
      catalog = new Map();
      for (const card of __r(944)) {
        const src = __r(942).cardInfoImageUrl(card);
        if (src) catalog.set(new URL(src, location.href).pathname, card);
      }
    }
    return catalog.get(new URL(url, location.href).pathname);
  }
  function publicCard(id) {
    const s = state();
    // Hand lookup is restricted to the player's current visible perspective.
    const cards = [...(s.player?.hand || [])];
    for (const p of [s.player, s.opponent]) {
      if (!p) continue;
      cards.push(p.legendCard, p.heroSlot, ...(p.secondaryLegendCards || []));
      for (const zone of [
        "unitArea",
        "equipmentArea",
        "activeRunes",
        "graveyard",
        "exile",
      ])
        cards.push(...(p[zone] || []));
    }
    for (const f of s.battlefields || [])
      cards.push(f.card, ...f.units.map((u) => u.card));
    return cards.find((c) => c?.id === id);
  }
  function atPointer(event) {
    if (!(event.target instanceof Element) || event.target.closest(".fx-modal"))
      return null;
    const button = event.target.closest(".fx-field-inspect");
    if (button) return fieldData.get(button);
    const face = event.target.closest('[data-testid^="card:"]');
    if (face?.getAttribute("aria-label") === "卡背") return null;
    // React Native Image uses a pointer-transparent img plus a painted div.
    // Look in the nearest hit ancestor, checking image bounds to avoid picking
    // an adjacent thumbnail, a covered hand card, or the battlefield wallpaper.
    let node = face || event.target;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      if (node === document.body || node.id === "root") break;
      if (node.closest(decorativeArt)) return null;
      const images = [
        ...node.querySelectorAll(
          'img[src*="/card-images/"], img[src*="/cardbacks/"]',
        ),
      ];
      if (node.matches("img")) images.unshift(node);
      for (const img of images) {
        if (img.closest(decorativeArt)) continue;
        const rect = img.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom ||
          !rect.width ||
          !rect.height
        )
          continue;
        if (!img.src.includes("/card-images/")) return null;
        const owner = img.closest('[data-testid^="card:"]');
        if (owner?.getAttribute("aria-label") === "卡背") return null;
        const flight = owner?.querySelector('[data-testid^="card-flight:"]');
        const id = flight?.dataset.testid.slice("card-flight:".length);
        const card = (id && publicCard(id)) ||
          catalogCard(img.src) || {
            name: owner?.getAttribute("aria-label") || "卡牌",
          };
        return { src: img.src, card, element: owner || img.parentElement };
      }
      if (
        face ||
        images.length ||
        node.matches('[role="dialog"], [data-testid^="battlefield-zone:"]')
      )
        break;
    }
    return null;
  }
  function art(data) {
    const box = document.createElement("div");
    if (data.src) {
      const img = document.createElement("img");
      img.src = data.src;
      img.alt = data.card.name || "卡面";
      img.draggable = false;
      if (isBattlefield(data.card)) {
        // All pinned battlefield fronts are stored upright/portrait. Reserve
        // the rotated footprint before decoding to avoid a sideways flash.
        box.className = "fx-landscape-art";
        box.style.aspectRatio = "587 / 420";
        img.style.width = (100 * 420) / 587 + "%";
        img.style.height = (100 * 587) / 420 + "%";
      }
      img.onload = () => {
        if (isBattlefield(data.card) && img.naturalHeight > img.naturalWidth) {
          box.className = "fx-landscape-art";
          box.style.aspectRatio = img.naturalHeight / img.naturalWidth;
          img.style.width = (100 * img.naturalWidth) / img.naturalHeight + "%";
          img.style.height = (100 * img.naturalHeight) / img.naturalWidth + "%";
        }
      };
      img.onerror = () => {
        img.hidden = true;
        box.append(
          textElement(
            "p",
            "此卡暂无本地图像，请查看效果文字。",
            "fx-image-error",
          ),
        );
      };
      box.append(img);
    }
    return box;
  }
  function isBattlefield(card) {
    return (
      card.type === "battlefield" ||
      String(card.subType).includes("battlefield")
    );
  }
  function hideHover() {
    clearTimeout(timer);
    hover.hidden = true;
  }
  function showHover(data, x) {
    if (held || !modal.hidden || !data.element?.isConnected) return;
    hover.replaceChildren(
      art(data),
      textElement("p", data.card.name || "卡牌"),
      textElement("div", "右键 / 按 I 固定大图与效果文字", "fx-hint"),
    );
    hover.style.top = "12px";
    hover.classList.toggle("fx-landscape-hover", isBattlefield(data.card));
    hover.style.left = x < innerWidth / 2 ? "auto" : "12px";
    hover.style.right = x < innerWidth / 2 ? "12px" : "auto";
    hover.hidden = false;
    const ban = FuxuanLocal.deckRules.issues({
      mainDeckCardIds: [data.card.templateId || data.card.id],
    });
    if (ban.length)
      hover.append(
        textElement("p", "标准构筑禁用 · " + ban[0].nameZh, "fx-ban-warning"),
      );
  }
  function pin(data) {
    hideHover();
    previousFocus = document.activeElement;
    modal.querySelector(".fx-art").replaceChildren(art(data));
    const title = textElement("h2", data.card.name || "卡牌");
    title.id = "fx-card-title";
    modal
      .querySelector(".fx-reader-text")
      .replaceChildren(
        title,
        textElement("p", data.context || "卡牌效果", "fx-hint"),
        textElement(
          "p",
          clean(data.card.description) || "此卡没有效果文字。",
          "fx-reader-description",
        ),
        textElement(
          "p",
          "查看期间对局仍会继续。按 Esc 或点击空白处返回。",
          "fx-hint",
        ),
      );
    modal.hidden = false;
    const ban = FuxuanLocal.deckRules.issues({
      mainDeckCardIds: [data.card.templateId || data.card.id],
    });
    if (ban.length)
      modal
        .querySelector(".fx-reader-text")
        .append(
          textElement(
            "p",
            "标准构筑禁用（" + FuxuanLocal.deckRules.policy.effective + "）",
            "fx-ban-warning",
          ),
        );
    closeButton.focus({ preventScroll: true });
  }
  function close() {
    modal.hidden = true;
    candidate = null;
    if (previousFocus?.isConnected)
      previousFocus.focus({ preventScroll: true });
  }
  closeButton.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener(
    "pointermove",
    (event) => {
      if (
        held ||
        event.buttons ||
        !modal.hidden ||
        event.pointerType === "touch"
      )
        return;
      const next = atPointer(event);
      if (next?.element === candidate?.element && next?.src === candidate?.src)
        return;
      hideHover();
      candidate = next;
      if (next) timer = setTimeout(() => showHover(next, event.clientX), 260);
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    () => {
      held = true;
      hideHover();
    },
    true,
  );
  document.addEventListener(
    "pointerup",
    () => {
      held = false;
      candidate = null;
    },
    true,
  );
  document.addEventListener(
    "pointercancel",
    () => {
      held = false;
      candidate = null;
      hideHover();
    },
    true,
  );
  document.addEventListener(
    "contextmenu",
    (event) => {
      if (!modal.hidden) return;
      const data = atPointer(event);
      if (!data) return;
      event.preventDefault();
      event.stopPropagation();
      held = false;
      pin(data);
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (!modal.hidden) {
        // Do not send gameplay shortcuts through a reading dialog.
        event.stopPropagation();
        if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault();
          if (event.key === "Escape") close();
          else closeButton.focus();
        }
      } else if (event.key === "Escape") {
        hideHover();
        candidate = null;
      } else if (
        event.key.toLowerCase() === "i" &&
        candidate &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.target.closest('input,textarea,[contenteditable="true"]')
      ) {
        event.preventDefault();
        event.stopPropagation();
        pin(candidate);
      }
    },
    true,
  );
  window.addEventListener("blur", () => {
    held = false;
    hideHover();
    candidate = null;
  });
  document.addEventListener("pointerleave", () => {
    hideHover();
    candidate = null;
  });
  window.addEventListener("resize", () => {
    hideHover();
    candidate = null;
  });
  document.addEventListener(
    "scroll",
    () => {
      hideHover();
      candidate = null;
    },
    true,
  );

  function updateFields() {
    if (FuxuanLocal.screen !== "game") return;
    for (const field of state().battlefields || []) {
      const zone = [
        ...document.querySelectorAll('[data-testid^="battlefield-zone:"]'),
      ].find((el) => el.dataset.testid === "battlefield-zone:" + field.id);
      if (!zone) continue;
      let button = zone.querySelector(".fx-field-inspect");
      if (!button) {
        button = document.createElement("button");
        button.className = "fx-field-inspect";
        button.type = "button";
        button.dataset.testid = "local-field-inspect:" + field.id;
        // This button is for reading, never a board selection/drop target.
        for (const name of [
          "pointerdown",
          "pointerup",
          "mousedown",
          "mouseup",
          "touchstart",
          "touchend",
        ])
          button.addEventListener(name, (e) => e.stopPropagation());
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          pin(fieldData.get(button));
        });
        zone.append(button);
      }
      const card = field.card || {
        name: "空白战场",
        description: "此战场没有额外效果。",
      };
      const label = (card.name || "空白战场") + " · 查看效果";
      if (button.textContent !== label) button.textContent = label;
      const context =
        field.controllerId === "player"
          ? "战场 · 你控制"
          : field.controllerId === "opponent"
            ? "战场 · 对手控制"
            : "战场 · 当前无人控制";
      fieldData.set(button, {
        card,
        src: imageFor(card),
        element: button,
        context,
      });
    }
    if (candidate && !candidate.element.isConnected) {
      hideHover();
      candidate = null;
    }
  }
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateFields();
    });
  }
  new MutationObserver(schedule).observe(
    document.getElementById("root") || document.body,
    { childList: true, subtree: true },
  );
  document.addEventListener("fuxuan:screen", () => {
    close();
    hideHover();
    schedule();
  });
  // Loaded asynchronously after bridge.js; App publishes screen when mounted.
  schedule();
})();
