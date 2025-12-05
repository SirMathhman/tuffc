from __future__ import annotations

from dataclasses import dataclass

# Supported suffixes and their (bits, signed) properties
SUFFIX_MAP = {
    "U8": (8, False),
    "U16": (16, False),
    "U32": (32, False),
    "U64": (64, False),
    "I8": (8, True),
    "I16": (16, True),
    "I32": (32, True),
    "I64": (64, True),
}


@dataclass(frozen=True)
class TypedInt:
    bits: int
    signed: bool
    raw: int

    @staticmethod
    def from_value(value: int, bits: int, signed: bool) -> "TypedInt":
        mask = (1 << bits) - 1
        raw = value & mask
        return TypedInt(bits, signed, raw)

    @staticmethod
    def from_suffix_literal(literal: int, suffix: str) -> "TypedInt":
        if suffix not in SUFFIX_MAP:
            raise ValueError(f"unknown suffix: {suffix}")
        bits, signed = SUFFIX_MAP[suffix]
        return TypedInt.from_value(literal, bits, signed)

    def unsigned_value(self) -> int:
        return self.raw

    def signed_value(self) -> int:
        if not self.signed:
            return self.raw
        half = 1 << (self.bits - 1)
        if self.raw >= half:
            return self.raw - (1 << self.bits)
        return self.raw

    def suffix(self) -> str:
        for k, v in SUFFIX_MAP.items():
            if v == (self.bits, self.signed):
                return k
        raise ValueError("no suffix for this type")

    def _binary_result(self, other: "TypedInt", op) -> "TypedInt":
        # Coerce types: widen to max bits; prefer unsigned when unsigned width >= signed width
        bits = max(self.bits, other.bits)
        # determine signedness
        if self.signed == other.signed:
            signed = self.signed
        else:
            # if one is unsigned and has >= bits => unsigned
            if (not self.signed) and (self.bits >= other.bits):
                signed = False
            elif (not other.signed) and (other.bits >= self.bits):
                signed = False
            else:
                # otherwise use signed
                signed = True

        a = TypedInt.from_value(
            self.signed_value() if self.signed else self.unsigned_value(), bits, signed
        )
        b = TypedInt.from_value(
            other.signed_value() if other.signed else other.unsigned_value(),
            bits,
            signed,
        )

        res_raw = op(a.raw, b.raw) & ((1 << bits) - 1)
        return TypedInt(bits, signed, res_raw)

    def __add__(self, other: "TypedInt") -> "TypedInt":
        return self._binary_result(other, lambda x, y: x + y)

    def __sub__(self, other: "TypedInt") -> "TypedInt":
        return self._binary_result(other, lambda x, y: x - y)

    def __mul__(self, other: "TypedInt") -> "TypedInt":
        return self._binary_result(other, lambda x, y: x * y)

    def __floordiv__(self, other: "TypedInt") -> "TypedInt":
        # Division semantics: use integer division on signed view for signed types,
        # unsigned view for unsigned types. Then wrap into bits width.
        bits = max(self.bits, other.bits)
        # determine signedness same as other operations
        if self.signed == other.signed:
            signed = self.signed
        else:
            if (not self.signed) and (self.bits >= other.bits):
                signed = False
            elif (not other.signed) and (other.bits >= self.bits):
                signed = False
            else:
                signed = True

        a_val = a_signed_val = (
            self.signed_value() if self.signed else self.unsigned_value()
        )
        b_val = b_signed_val = (
            other.signed_value() if other.signed else other.unsigned_value()
        )

        # Avoid division by zero
        if b_val == 0:
            raise ZeroDivisionError("integer division by zero")

        if signed:
            res = int(a_val) // int(b_val)
        else:
            res = int(a_val) // int(b_val)

        return TypedInt.from_value(res, bits, signed)

    def __repr__(self) -> str:
        return f"TypedInt(bits={self.bits}, signed={self.signed}, raw={self.raw})"

    def format_with_suffix(self) -> str:
        suf = self.suffix()
        if self.signed:
            return f"{self.signed_value()}{suf}"
        return f"{self.unsigned_value()}{suf}"
