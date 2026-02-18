// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const collections = {
  __vec_new: () => [],
  __vec_push: (v, item) => {
    v.push(item);
    return v;
  },
  __vec_get: (v, idx) => v[idx],
  __vec_set: (v, idx, item) => {
    v[idx] = item;
    return v;
  },
  __vec_init: (v) => v.length,
  __vec_capacity: (v) => v.length,
  __vec_includes: (v, item) => v.includes(item),
  __vec_length: (v) => v.length,
  __map_new: () => new Map(),
  map_set: (m, k, v) => {
    m.set(k, v);
    return m;
  },
  map_get: (m, k) => m.get(k),
  __set_new: () => new Set(),
  set_add: (s, item) => {
    s.add(item);
    return s;
  },
  set_has: (s, item) => s.has(item),
};

const strings = {
  str_eq: (a, b) => a === b,
  str_length: (s) => s.length,
  str_concat: (a, b) => `${a}${b}`,
  str_index_of: (s, needle) => s.indexOf(needle),
  str_trim: (s) => s.trim(),
};

const io = {
  path_join: (a, b) => path.join(a, b).replaceAll("\\", "/"),
  path_dirname: (p) => path.dirname(p).replaceAll("\\", "/"),
  write_file: (filePath, contents) => {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
    return 0;
  },
  read_file: (filePath) => fs.readFileSync(filePath, "utf8"),
};

export function runMainFromJs(js, label) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    collections,
    strings,
    io,
  };
  vm.runInNewContext(`${js}\nmodule.exports = { main };`, sandbox);
  if (typeof sandbox.module.exports.main !== "function") {
    throw new Error(`${label}: generated JS does not export main()`);
  }
  return sandbox.module.exports.main();
}
