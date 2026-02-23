"use strict";

const __tuff_outer_for_fact = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function fact(n) {
  let __tuff_this = { n: n, this: __tuff_outer_for_fact };
  if ((n <= 1)) {
  return 1;
}
  return (n * fact((n - 1)));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.fact = fact;

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  return fact(5);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

