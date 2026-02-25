"use strict";

// extern from string

// extern fn strlen

function length(__this_param) {
  let __tuff_this = undefined;
  return strlen((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

