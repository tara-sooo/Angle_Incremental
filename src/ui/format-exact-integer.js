import { runtime } from "../runtime/shared.js";

export function formatExactInteger(value, fallback = 0n) {
  const exact = runtime.parseExactInteger(value, fallback);
  return runtime.formatHeldUiLogNumber(runtime.log10ExactInteger(exact), exact.toString());
}
