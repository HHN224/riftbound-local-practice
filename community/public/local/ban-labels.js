(function () {
  const root = document.getElementById("root");
  let scheduled = false;
  function update() {
    for (const card of root.querySelectorAll('[data-testid^="card:"]')) {
      const id = card.dataset.testid.slice(5);
      const banned =
        card.getAttribute("aria-label") !== "卡背" &&
        FuxuanLocal.deckRules.issues({ mainDeckCardIds: [id] }).length > 0;
      card.classList.toggle("fx-banned-card", banned);
    }
    for (const img of root.querySelectorAll('img[src*="/card-images/"]')) {
      if (
        img.closest(
          '[data-testid^="card:"],[data-testid^="battlefield-background:"],[data-testid^="base-legend-background:"],[data-testid="custom-playmat"]',
        )
      )
        continue;
      const file = decodeURIComponent(
        new URL(img.src).pathname.split("/").pop(),
      );
      img.parentElement.classList.toggle(
        "fx-banned-art",
        FuxuanLocal.deckRules.issues({ mainDeckCardIds: [file] }).length > 0,
      );
    }
  }
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }).observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-testid", "src", "aria-label"],
  });
  update();
})();
