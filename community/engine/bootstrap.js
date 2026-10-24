globalThis.global = globalThis;
globalThis.process = { env: { NODE_ENV: "production" } };
globalThis.__ExpoImportMetaRegistry = {
  env: { NODE_ENV: "production", MODE: "production", DEV: false, PROD: true },
};
globalThis.console = {
  log: print,
  warn: print,
  error: print,
  info: print,
  debug: function () {},
  trace: function () {},
};
globalThis.performance = {
  now: function () {
    return Date.now();
  },
};
globalThis.__timers = new Map();
globalThis.__timerId = 0;
globalThis.setTimeout = function (fn, delay) {
  var args = Array.prototype.slice.call(arguments, 2);
  var id = ++__timerId;
  __timers.set(id, {
    fn: function () {
      fn.apply(undefined, args);
    },
    at: Date.now() + (delay || 0),
  });
  return id;
};
globalThis.clearTimeout = function (id) {
  __timers.delete(id);
};
globalThis.setImmediate = function (fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  return setTimeout(function () {
    fn.apply(undefined, args);
  }, 0);
};
globalThis.clearImmediate = clearTimeout;
globalThis.__intervals = new Set();
globalThis.setInterval = function (fn, delay) {
  var id;
  function next() {
    if (!__intervals.has(id)) return;
    fn();
    if (__intervals.has(id))
      __timers.set(id, { fn: next, at: Date.now() + Math.max(1, delay || 0) });
  }
  id = setTimeout(next, delay);
  __intervals.add(id);
  return id;
};
globalThis.clearInterval = function (id) {
  __intervals.delete(id);
  clearTimeout(id);
};
globalThis.queueMicrotask = function (fn) {
  Promise.resolve().then(fn);
};
globalThis.ErrorUtils = {
  reportFatalError: function (e) {
    throw e;
  },
};
