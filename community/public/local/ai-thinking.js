(function () {
  "use strict";
  const indicator = document.createElement("div");
  indicator.className = "fx-ai-thinking";
  indicator.dataset.testid = "local-ai-thinking";
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-live", "polite");
  indicator.hidden = true;
  indicator.innerHTML =
    '<span class="fx-thinking-spinner" aria-hidden="true"></span><span>对手正在思考<small>正在计算出牌，请稍候</small></span>';
  document.body.append(indicator);
  let store,
    failed = false;
  function update() {
    const s = store?.getState();
    const thinking =
      s &&
      Object.entries(s.aiThinkingById || {}).some(
        ([id, active]) =>
          active && id !== s.realLocalPlayerId && id !== s.localPlayerId,
      );
    indicator.hidden = !(
      FuxuanLocal.screen === "game" &&
      !s?.winner &&
      FuxuanLocal.transport.connected &&
      !failed &&
      thinking
    );
  }
  function connect() {
    if (!store) {
      store = __r(841).useGameStore;
      store.subscribe(update);
      FuxuanLocal.transport.on("disconnect", update);
      FuxuanLocal.transport.on("serverMessage", (message) => {
        if (message.type === "error") failed = true;
        else if (message.type === "aiThinking" && message.payload.thinking)
          failed = false;
        update();
      });
    }
    if (FuxuanLocal.screen !== "game") failed = false;
    update();
  }
  document.addEventListener("fuxuan:screen", connect);
  if (FuxuanLocal.screen) connect();
})();
