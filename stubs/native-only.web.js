// Stub for native-only modules on web — all exports are no-ops
module.exports = new Proxy({}, {
  get: () => () => ({}),
});
