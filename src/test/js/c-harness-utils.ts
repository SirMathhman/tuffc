// @ts-nocheck
// Shared C test harness constants used by c-bootstrap-parity.ts and c-selfhost-progress.ts.

export const SELFHOST_EXTERN_ENTRY = `extern int64_t selfhost_entry(void);
extern void tuff_set_argv(int argc, char **argv);`;

export const COMPILE_OPTIONS_PARAMS_C = `    int64_t lintEnabled,
    int64_t maxEffectiveLines,
    int64_t borrowEnabled,
    int64_t target
);`;

export const SELFHOST_MAIN_BODY = `  tuff_set_argv(argc, argv);
  return (int)selfhost_entry();
}
`;
