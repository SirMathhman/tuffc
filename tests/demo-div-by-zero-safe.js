"use strict";

function safe_divide(a, b) {
  return (((b === 0)) ? (() => {
    return 0;
  })() : (() => {
    return (a / b);
  })());
}

function main() { return safe_divide(10, 2); }

