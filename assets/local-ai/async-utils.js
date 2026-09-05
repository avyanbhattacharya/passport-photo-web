(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LocalAIAsync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function withTimeout(promise, timeoutMs, code) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(code);
        error.code = code;
        reject(error);
      }, timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  return Object.freeze({ withTimeout });
});
