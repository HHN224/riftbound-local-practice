(function () {
  // These Metro IDs belong to the pinned web snapshot. Keep the captured files
  // intact; override only navigation, transport and asset locations here.
  document.title = "符玄战场 · 本地练牌（APK 1020）";
  class LocalTransport {
    constructor() {
      this.listeners = new Map();
      this.connected = true;
      this.networkConnected = true;
      this.runtimeStateExpected = false;
      this.io = { reconnection: function () {} };
      this.auth = {};
      this.sendBuffer = [];
      this.receiveBuffer = [];
      this.id = "local";
      this.queue = Promise.resolve();
      this.ready = this.open();
    }
    async open() {
      const response = await fetch("/local-api/session", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      this.session = data.id;
      this.events = new EventSource(
        "/local-api/events?session=" + encodeURIComponent(this.session),
      );
      this.events.onmessage = (e) =>
        this.deliver("serverMessage", JSON.parse(e.data));
      this.events.addEventListener("engineError", (e) => {
        this.connected = this.networkConnected = false;
        this.deliver("disconnect");
        alert(JSON.parse(e.data).error);
      });
      await new Promise((resolve, reject) => {
        this.events.onopen = resolve;
        this.events.onerror = () => reject(Error("本地引擎连接中断"));
      });
      this.deliver("connect");
    }
    on(name, fn) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(fn);
      return this;
    }
    off(name, fn) {
      this.listeners.get(name)?.delete(fn);
      return this;
    }
    once(name, fn) {
      const once = (...args) => {
        this.off(name, once);
        fn(...args);
      };
      return this.on(name, once);
    }
    deliver(name, ...args) {
      for (const fn of this.listeners.get(name) || []) fn(...args);
    }
    emit(event, payload, callback) {
      if (
        ![
          "initGame",
          "initSandbox",
          "validateSandboxDraft",
          "clientMessage",
          "turnBannerComplete",
          "reviewControl",
          "stopLocalSession",
          "leaveMatch",
          "catalog",
        ].includes(event)
      )
        return this;
      this.queue = this.queue
        .catch(() => {})
        .then(async () => {
          await this.ready;
          const response = await fetch(
            "/local-api/command?session=" + encodeURIComponent(this.session),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event, payload }),
            },
          );
          const reply = await response.json();
          if (!response.ok) throw Error(reply.error);
          callback?.(reply.result ?? { ok: true });
          return reply.result;
        });
      this.queue.catch((error) => {
        console.error(error);
        this.deliver("serverMessage", {
          type: "error",
          payload: { errors: [error.message] },
        });
      });
      return this.queue;
    }
    connect() {
      return this;
    }
    validateSandboxDraft(draft) {
      return this.emit("validateSandboxDraft", draft);
    }
    disconnect() {
      return this;
    }
    removeAllListeners() {
      this.listeners.clear();
    }
    dispose() {}
    abandonMatch() {}
    resetSession() {}
    disconnectAll() {}
    subscribeConnection(fn) {
      return () => {};
    }
  }
  const transport = new LocalTransport();
  globalThis.FuxuanLocal = { transport };
  for (const [tag, attribute, path] of [
    ["link", "href", "/local/selection-frames.css"],
    ["script", "src", "/local/selection-frames.js"],
  ]) {
    const element = document.createElement(tag);
    if (tag === "link") element.rel = "stylesheet";
    element[attribute] = path;
    document.head.append(element);
  }
  // Optional presentation layer: loading it never delays the original engine.
  const readabilityStyle = document.createElement("link");
  readabilityStyle.rel = "stylesheet";
  readabilityStyle.href = "/local/readability.css";
  document.head.append(readabilityStyle);
  const readabilityScript = document.createElement("script");
  readabilityScript.src = "/local/readability.js";
  document.head.append(readabilityScript);
  const personalStyle = document.createElement("link");
  personalStyle.rel = "stylesheet";
  personalStyle.href = "/local/personal-decks.css";
  document.head.append(personalStyle);
  const personalScript = document.createElement("script");
  personalScript.type = "module";
  personalScript.src = "/local/personal-decks.mjs";
  document.head.append(personalScript);
  const register = globalThis.__d;
  globalThis.__d = function (factory, id, deps) {
    if (id === 1043) {
      const original = factory;
      factory = function (...args) {
        original(...args);
        const exports = args[5];
        const typography = exports.resolveRuneSummaryTypography;
        exports.resolveRuneSummaryTypography = (scale) => {
          const result = typography(scale);
          for (const key of Object.keys(result)) {
            if (key.endsWith("FontSize"))
              result[key] = Math.max(14, result[key]);
          }
          return result;
        };
        // Real layout dimensions, so upstream measurement and click targets agree.
        exports.resolveMiniRuneMetrics = () => ({
          scale: 1.5,
          width: 32,
          height: 44,
          gap: 6,
          tappedWidth: 44,
          tappedHeight: 32,
          tappedImageLeft: 6,
          tappedImageTop: -6,
          stripHeight: 68,
        });
      };
    }
    if (id === 119)
      factory = function (g, r, i, a, m, e) {
        Object.assign(e, {
          SERVER_URL: "",
          COORDINATOR_SOCKET_PATH: "/disabled-online",
          CLIENT_RELEASE_ID: "local-apk-1020",
          CARD_IMAGE_BASE: location.origin,
          ENGINE_SERVER_URL: "",
        });
      };
    if (id === 842)
      factory = function (g, r, i, a, m, e) {
        e.COUNTDOWN_TOTAL_MS = 0;
        e.rnPlatform = {
          socket: transport,
          transport,
          storage: __r(111).storage,
          logger: {
            debug() {},
            info() {},
            warn: console.warn,
            error: console.error,
          },
          readHashFlag: () => false,
          countdownTotalMs: 0,
          createDefaultTurnStats: () => __r(178).createDefaultTurnStats(),
          getMatchRecordProvenance: () => ({
            appVersion: "local-apk-1020",
            clientPlatform: "web",
            deviceOS: "local",
          }),
          getMatchRecordUIDiagnostics: () => ({}),
          recordTransportAnomaly: console.warn,
        };
      };
    if (id === 844)
      factory = function (g, r, i, a, m, e) {
        Object.assign(e, {
          socket: transport,
          onlineConnection: transport,
          abandonConnectingMatch() {},
          disconnectForOfflineSession() {},
        });
      };
    if (id === 942)
      factory = function (g, r, i, a, m, e) {
        const front = (card) =>
          card.templateId
            ? "/card-images/" +
              encodeURIComponent(
                card.templateId.replace(/\//g, "-").replace(/\*/g, "s") +
                  ".webp",
              )
            : undefined;
        Object.assign(e, {
          cardFrontRemoteImageUrl: front,
          cardFrontImageUrl: front,
          resolveCardFrontImageSource: (card) => ({
            uri: front(card),
            origin: "bundled",
          }),
          cardBackImageUrl: (rune) =>
            "/cardbacks/" + (rune ? "rune-cardback.webp" : "main-cardback.png"),
          cardInfoImageUrl: (card) =>
            card.localImage
              ? "/card-images/" +
                encodeURIComponent(card.localImage.replace(/\.[^.]+$/, ".webp"))
              : front({ templateId: card.id }),
        });
      };
    if (id === 835)
      factory = function (g, r, i, a, m, e) {
        const React = __r(4),
          View = __r(70).default;
        const h = React.createElement;
        function App() {
          const [screen, setScreen] = React.useState("menu"),
            [editId, setEditId] = React.useState(undefined),
            [menuRevision, setMenuRevision] = React.useState(0),
            [sandbox, setSandbox] = React.useState(false);
          React.useEffect(() => {
            FuxuanLocal.refreshMenu = () =>
              setMenuRevision((value) => value + 1);
            FuxuanLocal.editPersonalDeck = (id) => {
              setEditId(id);
              setScreen("deckBuilder");
            };
            FuxuanLocal.screen = screen;
            document.dispatchEvent(new Event("fuxuan:screen"));
          }, [screen]);
          const back = async () => {
            await transport.emit("stopLocalSession");
            __r(841).useGameStore.getState().resetMatchUiState();
            setScreen("menu");
            setSandbox(false);
          };
          let content;
          if (screen === "game")
            content = h(__r(882).GameBoard, {
              onBackToMenu: back,
              onEscapeConnecting: back,
              multiplayerMode: false,
              sandboxMode: sandbox,
              previewMode: false,
            });
          else if (screen === "deckBuilder")
            content = h(__r(1148).DeckBuilder, {
              editDeckId: editId,
              onCancel: back,
              onComplete: back,
            });
          else if (screen === "sandbox")
            content = h(__r(1137).SandboxScreen, {
              onBackToMenu: back,
              onStart: async (draft) => {
                await __r(841).useGameStore.getState().initSandbox(draft);
                setSandbox(true);
                setScreen("game");
              },
            });
          else
            content = h(__r(1172).MainMenu, {
              key: menuRevision,
              onlineOnly: false,
              onGameStarted: () => {
                setSandbox(false);
                setScreen("game");
              },
              onOpenDeckBuilder: (id) => {
                setEditId(id);
                setScreen("deckBuilder");
              },
              onOpenSandbox: () => setScreen("sandbox"),
              onOpenLobby: () => alert("本地练牌版不连接在线房间。"),
              onOpenTutorial: () =>
                alert("教程暂未迁移，请使用人机训练或 Sandbox。"),
              onReplayArchive: () => alert("回放导入暂未迁移。"),
            });
          return h(
            View,
            { style: { flex: 1, backgroundColor: "#0a0a0a" } },
            content,
          );
        }
        e.__esModule = true;
        e.default = App;
      };
    return register(factory, id, deps);
  };
})();
