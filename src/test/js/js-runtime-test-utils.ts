// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as runtime from "../../main/js/runtime.ts";

const vecBindings = {
  __vec_push: runtime.vec_push,
  __vec_get: runtime.vec_get,
  __vec_set: runtime.vec_set,
  __vec_init: runtime.vec_init,
  __vec_capacity: runtime.vec_capacity,
  __vec_includes: runtime.vec_includes,
  __vec_length: runtime.vec_length,
};

const collections = {
  __vec_new: runtime.__vec_new,
  ...vecBindings,
  __map_new: runtime.__map_new,
  map_set: runtime.map_set,
  map_get: runtime.map_get,
  __set_new: runtime.__set_new,
  set_add: runtime.set_add,
  set_has: runtime.set_has,
};

const strings = {
  str_eq: runtime.str_eq,
  str_length: runtime.str_length,
  str_concat: runtime.str_concat,
  str_index_of: runtime.str_index_of,
  str_trim: runtime.str_trim,
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

const legacyIntrinsicAliases = {
  ...vecBindings,
  __map_set: runtime.map_set,
  __map_get: runtime.map_get,
  __set_add: runtime.set_add,
  __set_has: runtime.set_has,
};

export function runMainFromJs(js, label) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
    ...legacyIntrinsicAliases,
    path_join: io.path_join,
    path_dirname: io.path_dirname,
    write_file: io.write_file,
    read_file: io.read_file,
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
