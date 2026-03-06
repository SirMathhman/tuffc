# Tuff Toolchain Agent Instructions

## Error Messages Must Be Descriptive

All error messages throughout the Tuff compiler must follow a four-part structure to help users quickly identify and fix problems.

### Required Structure

Every error message MUST include these four fields in an object:

1. **`value`** — What was wrong (e.g., the invalid type, token, identifier)
2. **`message`** — What happened (concise summary of the problem)
3. **`reason`** — Context explaining the constraint or rule violated
4. **`fix`** — Suggested solution or corrective action

Include optional `line` and `column` fields for location information.

### Examples

#### ✅ Good Error Messages

```typescript
// Invalid type name
{
  "value": "Int64",
  "message": "Unknown type \"Int64\", did you mean \"I64\"?",
  "reason": "Valid Tuff types are: U8, U16, U32, U64, USize, I8, I16, I32, I64, ISize, F32, F64, Bool, Void",
  "fix": "Replace \"Int64\" with one of the valid types listed above"
}

// Token parsing failure
{
  "value": "++",
  "message": "Unexpected token \"++\"",
  "reason": "Increment operators are not supported in Tuff",
  "fix": "Use binary addition: x + 1"
}

// Missing closing parenthesis
{
  "value": "print(x + y",
  "line": 5,
  "column": 12,
  "message": "Expected \")\" but reached end of line",
  "reason": "Function calls require balanced parentheses",
  "fix": "Add a closing \")\" at the end of the expression"
}
```

#### ❌ Poor Error Messages

```typescript
// Too vague (missing required fields)
{ "message": "Invalid type" }    // ✗ No value, reason, or fix

// Incomplete (only has value and message)
{ "value": "Int64", "message": "Unknown type" }    // ✗ Missing reason and fix

// Missing context
{ "value": "++", "message": "Not allowed" }    // ✗ Vague reason and fix
```

### Implementation Guidelines

- Use `Result<T, E>` type (from `./src/types`) to return errors instead of throwing exceptions
- Return error objects with all four required fields: `value`, `message`, `reason`, `fix`
- Format reason and fix strings to be human-readable
- Include `line` and `column` when available (especially for parser errors)
- Suggest corrections from nearby valid options (typo detection, etc.)
- For compound errors, prioritize the first/root cause and guide incrementally

### Code Pattern

```typescript
// In compile.ts or other modules
if (!VALID_TYPES.has(typeStr)) {
  return err({
    value: typeStr,
    message: `Unknown type "${typeStr}"`,
    reason: `Valid Tuff types are: ${Array.from(VALID_TYPES).join(", ")}`,
    fix: `Replace "${typeStr}" with one of the valid types listed above`,
  });
}
```

### When Creating Errors

Apply this pattern to:

- Type validation errors
- Token parsing failures
- Identifier resolution errors
- Operator mismatches
- Function/variable lookup failures
- Statement syntax violations

### When Encountering Existing Errors

**Important:** If you encounter an error message already written in the codebase—especially when running test cases and an error appears unexpectedly—that error **MUST adhere to this four-part standard**. Do not skip or ignore non-conforming error messages. Instead:

1. Identify the non-conforming error
2. Refactor it to include all four required fields: `value`, `message`, `reason`, `fix`
3. Update both the error source and any related test expectations
4. Run tests to validate the refactored error still works correctly

This ensures consistency across the entire codebase and helps catch bugs early when test failures reveal unexpected behavior.

---

**Related:** Check `test-output.txt` and test cases in `tests/execute.test.ts` to see expected behavior and error patterns.
