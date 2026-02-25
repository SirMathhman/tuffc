"use strict";

const __tuff_outer_for_doSomething = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function doSomething() {
  let __tuff_this = { this: __tuff_outer_for_doSomething };
  return 100;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.doSomething = doSomething;

