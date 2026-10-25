(function () {
  "use strict";
  // The captured BaseZone/Battlefield slot owns selection state, but Card's
  // inner surface owns rotation. Move only the decoration to that surface;
  // leave slot geometry, handlers, drag hit areas and selection badges intact.
  const root = document.getElementById("root");
  if (!root) return;
  const options = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  };
  let scheduled = false;
  const observer = new MutationObserver(schedule);
  function update() {
    observer.disconnect();
    try {
      for (const card of root.querySelectorAll('[data-testid^="card:"]')) {
        const surface = card.querySelector(
          '[data-testid^="card-motion:"] > div',
        );
        if (!surface) continue;
        let slot = card.parentElement;
        for (
          let depth = 0;
          slot && depth < 5;
          depth++, slot = slot.parentElement
        ) {
          const style = getComputedStyle(slot);
          if (
            style.borderTopWidth !== "2px" ||
            style.borderTopLeftRadius !== "6px"
          )
            continue;
          if (slot.querySelectorAll('[data-testid^="card:"]').length !== 1)
            break;
          // Active colors are inline theme overrides in the pinned components.
          // An absent override means the original transparent, unselected slot.
          const color = slot.style.borderColor;
          let frame = surface.querySelector(":scope > .fx-selection-frame");
          if (
            !color ||
            color === "transparent" ||
            color === "rgba(0, 0, 0, 0)"
          ) {
            frame?.remove();
            slot.classList.remove("fx-selection-slot");
          } else {
            if (!frame) {
              frame = document.createElement("span");
              frame.className = "fx-selection-frame";
              frame.setAttribute("aria-hidden", "true");
              surface.append(frame);
            }
            frame.style.setProperty("--fx-selection-color", color);
            slot.classList.add("fx-selection-slot");
          }
          break;
        }
      }
    } finally {
      observer.observe(root, options);
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }
  observer.observe(root, options);
  schedule();
})();
