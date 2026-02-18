"use strict";

function fact(n) {
  if ((n <= 1)) {
  return 1;
}
  return (n * fact((n - 1)));
}

function main() {
  return fact(5);
}

