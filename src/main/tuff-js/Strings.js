"use strict";

// extern fn str_length

// expect fn length

function length(__this_param) {
  let __tuff_this = undefined;
  return str_length((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

