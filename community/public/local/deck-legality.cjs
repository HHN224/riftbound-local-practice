(function (root) {
  function key(id) {
    const m = /^([a-z]+)[·-](\d+)/i.exec(String(id || ""));
    return m ? m[1].toUpperCase() + ":" + Number(m[2]) : String(id);
  }
  function illegal(message) {
    const error = Error(message);
    error.code = "DECK_ILLEGAL";
    return error;
  }
  function create(policy, pool) {
    const banned = new Map(
      policy.cards.flatMap((card) => card.templateKeys.map((id) => [id, card])),
    );
    function issues(deck) {
      const ids = [
        deck?.legendCardId,
        deck?.heroCardId,
        ...[
          "secondaryLegendCardIds",
          "mainDeckCardIds",
          "runeCardIds",
          "battlefieldCardIds",
          "sideboardCardIds",
        ].flatMap((zone) => deck?.[zone] || []),
      ];
      return [...new Set(ids.map((id) => banned.get(key(id))).filter(Boolean))];
    }
    function error(deck) {
      const hits = issues(deck);
      return hits.length
        ? "标准构筑不可用：" +
            hits.map((c) => c.nameZh).join("、") +
            "（禁卡表 " +
            policy.effective +
            "）"
        : "";
    }
    function resolveMatch(payload, extra = []) {
      if (!payload?.deckSelection?.mainDeckCardIds)
        throw illegal("请选择完整卡组。");
      const problem = error(payload.deckSelection);
      if (problem) throw illegal("你的卡组" + problem);
      const legal = [...extra, ...pool.decks].filter(
        (deck) => !issues(deck).length,
      );
      const requested = payload.opponentDeckSelection;
      if (requested && !issues(requested).length)
        return { payload, notice: "" };
      let choices = legal;
      if (requested) {
        choices = legal.filter(
          (deck) => key(deck.legendCardId) === key(requested.legendCardId),
        );
        if (!choices.length)
          choices = legal.filter(
            (deck) =>
              pool.heroNames[deck.heroCardId] &&
              pool.heroNames[deck.heroCardId] ===
                pool.heroNames[requested.heroCardId],
          );
        if (!choices.length)
          throw illegal(
            "AI 卡组" +
              error(requested) +
              "；没有找到同英雄的合法替代，请重新选择对手卡组。",
          );
      }
      if (!choices.length) throw illegal("没有可用的合法 AI 卡组。");
      const replacement =
        choices[requested ? 0 : Math.floor(Math.random() * choices.length)];
      return {
        payload: { ...payload, opponentDeckSelection: replacement },
        notice: requested
          ? "AI 原卡组含禁卡，已换为同英雄合法卡组：" + replacement.name
          : "",
      };
    }
    return { key, issues, error, resolveMatch, policy, pool };
  }
  const api = { key, create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FuxuanDeckLegality = api;
})(globalThis);
