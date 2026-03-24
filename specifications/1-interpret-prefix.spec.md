# interpretTuff prefix parsing

## Goal

Interpret numeric Tuff input by reading the leading numeric portion and ignoring a trailing suffix.

## User stories

- As a caller, I want `interpretTuff("100U8")` to return `100` so that numeric literals with a suffix are handled predictably.
- As a caller, I want inputs without a leading numeric portion to continue returning `0` so that invalid input is rejected consistently.
