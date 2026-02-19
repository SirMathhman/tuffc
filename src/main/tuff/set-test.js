"use strict";

// module import placeholder: { set_new, set_add, set_has, set_delete } = selfhost::runtime_lexer

function test_set_basic() {
  let __tuff_this = {  };
  let s = set_new(); __tuff_this.s = s;
  s = set_add(s, 42); __tuff_this.s = s;
  s = set_add(s, 100); __tuff_this.s = s;
  s = set_add(s, 7); __tuff_this.s = s;
  let has42 = set_has(s, 42); __tuff_this.has42 = has42;
  let has100 = set_has(s, 100); __tuff_this.has100 = has100;
  let has7 = set_has(s, 7); __tuff_this.has7 = has7;
  let has999 = set_has(s, 999); __tuff_this.has999 = has999;
  return (((has42 && has100) && has7) && (!has999));
}

function test_set_delete() {
  let __tuff_this = {  };
  let s = set_new(); __tuff_this.s = s;
  s = set_add(s, 1); __tuff_this.s = s;
  s = set_add(s, 2); __tuff_this.s = s;
  s = set_add(s, 3); __tuff_this.s = s;
  let had1 = set_has(s, 1); __tuff_this.had1 = had1;
  set_delete(s, 1);
  let lost1 = (!set_has(s, 1)); __tuff_this.lost1 = lost1;
  let kept2 = set_has(s, 2); __tuff_this.kept2 = kept2;
  return ((had1 && lost1) && kept2);
}

function main() {
  let __tuff_this = {  };
  let basic = test_set_basic(); __tuff_this.basic = basic;
  let delete = test_set_delete(); __tuff_this.delete = delete;
  return (((basic && delete)) ? 0 : 1);
}
