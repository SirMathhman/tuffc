// @ts-nocheck

export const CORE_STAGE_EXPORT_NAMES: [camel: string, snake: string][] = [
  ["compileSource", "compile_source"],
  ["compileFile", "compile_file"],
  ["compileSourceWithOptions", "compile_source_with_options"],
  ["compileFileWithOptions", "compile_file_with_options"],
  ["takeLintIssues", "take_lint_issues"],
  ["main", "main"],
];

export const CPD_EXPORT_NAMES: [camel: string, snake: string][] = [
  ["cpdLexInit", "cpd_lex_init"],
  ["cpdLexAll", "cpd_lex_all"],
  ["cpdTokKind", "cpd_tok_kind"],
  ["cpdTokValue", "cpd_tok_value"],
  ["cpdTokLine", "cpd_tok_line"],
  ["cpdTokCol", "cpd_tok_col"],
  ["cpdGetInternedStr", "cpd_get_interned_str"],
];

export function buildExportSnippet(
  pairs: [camel: string, snake: string][],
): string {
  return (
    `\nconst __exports = {};\n` +
    pairs
      .map(
        ([camel, snake]) =>
          `if (typeof ${camel} !== "undefined") { __exports.${camel} = ${camel}; __exports.${snake} = ${camel}; }`,
      )
      .join("\n") +
    `\nmodule.exports = __exports;`
  );
}