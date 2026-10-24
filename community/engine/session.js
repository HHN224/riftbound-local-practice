var host = __r(4097).createLocalGameHost({ preGameCountdownTotalMs: 0 });
function emit(value) {
  print(JSON.stringify(value));
}
host.subscribeServerMessage(function (message) {
  emit({ kind: "event", message: message });
});
globalThis.__handleLine = function (line) {
  if (!line) return;
  var request = JSON.parse(line);
  try {
    if (request.event === "tick") {
      var now = Date.now();
      var due = Array.from(__timers.entries()).filter(function (e) {
        return e[1].at <= now;
      });
      due.slice(0, 100).forEach(function (e) {
        __timers.delete(e[0]);
        e[1].fn();
      });
      return;
    }
    var result;
    switch (request.event) {
      case "initGame":
        result = host.startVsAI(request.payload);
        break;
      case "clientMessage":
        result = host.sendClientMessage(request.payload);
        break;
      case "turnBannerComplete":
        result = host.completeTurnBanner(request.payload.turnNumber);
        break;
      case "initSandbox":
        result = host.startSandbox(request.payload);
        break;
      case "validateSandboxDraft":
        result = host.validateSandboxDraft(request.payload);
        break;
      case "reviewControl":
        result = host.reviewControl(request.payload);
        break;
      case "stopLocalSession":
      case "leaveMatch":
        host.stopSession();
        break;
      case "catalog":
        result = { defaultDeck: __r(4098).PRESET_DEFAULT_DECK };
        break;
      default:
        throw Error("Unsupported local event: " + request.event);
    }
    Promise.resolve(result).then(
      function (value) {
        emit({ kind: "reply", id: request.id, ok: true, result: value });
      },
      function (error) {
        emit({
          kind: "reply",
          id: request.id,
          ok: false,
          error: String(error.stack || error),
        });
      },
    );
  } catch (error) {
    emit({
      kind: "reply",
      id: request.id,
      ok: false,
      error: String(error.stack || error),
    });
  }
};
emit({ kind: "ready" });
