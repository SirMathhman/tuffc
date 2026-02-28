#pragma once
// camelCase → snake_case aliases for Tuff-compiled C output.
// These are needed because the Tuff source was renamed from snake_case
// to camelCase identifiers, but the C runtime ABI uses snake_case.

#define strLength str_length
#define strCharAt str_char_at
#define strSlice str_slice
#define strSliceWindow str_slice_window
#define strCopy str_copy
#define strMutSlice str_slice
#define strConcat str_concat
#define strEq str_eq
#define strFromCharCode str_from_char_code
#define strTrim str_trim
#define strReplaceAll str_replace_all
#define charCode char_code
#define parseInt parse_int
#define sbNew sb_new
#define sbAppend sb_append
#define sbAppendChar sb_append_char
#define sbBuild sb_build
#define mapSet map_set
#define mapGet map_get
#define mapHas map_has
#define mapDelete map_delete
#define setAdd set_add
#define setHas set_has
#define setDelete set_delete
#define readFile read_file
#define writeFile write_file
#define pathJoin path_join
#define pathDirname path_dirname
#define panicWithCode panic_with_code
#define panicWithCodeLoc panic_with_code_loc
#define getArgc get_argc
#define getArgv get_argv
#define profileMark profile_mark
#define mapGetOrDefault map_get_or_default
#define mapClear map_clear
#define setClear set_clear
