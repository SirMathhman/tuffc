"use strict";

// extern fn legacy_payment_processor

function safe_process_payment(amount) {
  if ((amount <= 0)) {
  return 0;
}
  if ((amount > 1000000)) {
  return 0;
}
  return legacy_payment_processor(amount);
}

function main() { return safe_process_payment(500); }

