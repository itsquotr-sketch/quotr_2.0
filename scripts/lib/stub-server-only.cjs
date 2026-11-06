/**
 * Lets a tsx script import server-only modules without a Next server runtime.
 * Does not change application code.
 */
const Module = require("module");
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return original.apply(this, arguments);
};
