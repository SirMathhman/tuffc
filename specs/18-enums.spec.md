# Spec 18: Simple Enums

## Summary

Simple integer-backed enums with qualified access syntax `EnumName::Variant`.

---

## Grammar

```
EnumDecl = "enum" NAME "{" VariantList "}"
VariantList = NAME ("," NAME)*  (trailing comma optional)
```

---

## Semantics

### Declaration

- `enum Colors { Red, Green }` declares a new named type `Colors` with variants `Red=0`, `Green=1` (auto-assigned from 0).
- Enum declarations can appear **anywhere a statement can appear**: top-level, inside function bodies, inside block expressions.
- Once declared, the enum is visible in all subsequent scopes (including nested functions and blocks that follow).
- Redeclaring the same enum name is an error: `duplicate enum 'Colors'`.
- Duplicate variant names within one enum are an error: `duplicate variant 'Red' in enum 'Colors'`.
- Enum names cannot shadow built-in types (`I32`, `Bool`, etc.) or existing type aliases.

### Type System

- `Colors` is a **distinct named type** — not assignable to or from `I32`, `Bool`, or other enums.
- Enum types are stored in `TuffType` as `{ kind: "Enum"; name: string }`.
- Two enum types are equal iff they have the same name.
- Enums **cannot** be used in:
  - Arithmetic operations (`+`, `-`, `*`, `/`) — error
  - Boolean contexts (`if`, `while`, `&&`, `||`, `!`) — error
  - Ordered comparisons (`<`, `<=`, `>`, `>=`) — error
  - Program final expression — error
- Enums **can** be used in:
  - Equality comparisons (`==`, `!=`) — both sides must be same enum type
  - `is` operator — `c is Colors` returns `Bool`
  - Pointer operations — `let p = &c;` is valid
  - `let` declarations with annotation: `let c: Colors = Colors::Red;`
  - Function parameter/return types

### Variant Access

- Syntax: `Colors::Red`
- Tokenized as: `NAME("Colors")`, `COLON_COLON`, `NAME("Red")`
- Emits JS integer literal: `0`, `1`, etc.
- Accessing unknown variant is a type error: `unknown variant 'Purple' in enum 'Colors'`

### Code Generation

- Enum declaration emits **no JavaScript** — purely compile-time.
- `Colors::Red` emits `0` (the integer index).
- The runtime representation is always a plain JS integer.

### `is` with Enums

- `c is Colors` checks whether `c`'s compile-time type is `Colors`. Returns `Bool`.
- `Colors::Red is I32` → `false` (enum type is not I32).

---

## Error Cases

| Input                                              | Error                                  |
| -------------------------------------------------- | -------------------------------------- |
| `enum Foo { A, A }`                                | duplicate variant 'A' in enum 'Foo'    |
| `enum Foo { A }; enum Foo { B }`                   | duplicate enum 'Foo'                   |
| `enum Foo { A }; Colors::Red`                      | unknown type or enum 'Colors'          |
| `enum Foo { A }; Foo::Nope`                        | unknown variant 'Nope' in enum 'Foo'   |
| `enum Foo { A }; Foo::A + 1`                       | enum cannot be used in arithmetic      |
| `enum Foo { A }; if (Foo::A) 1 else 0`             | enum in boolean context                |
| `enum Foo { A }; Foo::A` (as program result)       | enum type cannot be program exit value |
| `enum Foo { A }; enum Bar { B }; Foo::A == Bar::B` | cannot compare different enum types    |

---

## Implementation Notes

### New token

`COLON_COLON` — tokenized from `::`.

### New TuffType variant

```typescript
{
  kind: "Enum";
  name: string;
}
```

### New environment

`enumEnv: Map<string, { variants: string[] }>` — maps enum name to ordered variant list. Block-scoped (saved/restored in `withBlockScope`).

### `expectType` extension

After checking `typeAliasEnv`, check `enumEnv` — if the name is an enum, return `{ kind: "Enum", name }`.

### `parseAtom` extension

Detect `NAME COLON_COLON NAME` pattern: look up the enum, find variant index, emit integer, return `{ kind: "Enum", name }` type.

### Guard updates

- `assertNotPointerInBooleanContext` → also check `isEnumType`
- `assertNotPointer` → also check `isEnumType` for arithmetic operations
- `parseCmp` ordered comparisons → also block enum types
- `parseCmp` equality → both must be same enum, or neither enum
- `promoteTypes` → block enums
- Program final expression → block enums

### Pass 1 extension

`collectFunctionSignatures` must also handle `enum` declarations (to allow enum-typed function signatures in Pass 1).

### Pass 2 top-level loop

Must handle interleaved `fn`, `type`, and `enum` declarations.
