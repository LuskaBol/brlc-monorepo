import type { ParsedSignature, ValidationError } from "./types.js";

function normalizeSelector(selector: string): string {
  // Remove 0x prefix if present
  let normalized = selector.startsWith("0x") ? selector.slice(2) : selector;
  normalized = normalized.toLowerCase();
  normalized = normalized.trim();
  return normalized;
}

export function validateSelector(
  parsedSig: ParsedSignature,
  csvSelector: string,
): ParsedSignature | ValidationError {
  const computed = normalizeSelector(parsedSig.selector);
  const expected = normalizeSelector(csvSelector);

  // For events: handle both 8-char (function-like) and 64-char (full topic) formats
  if (parsedSig.type === "event") {
    if (expected.length === 64) {
      if (computed === expected) {
        return parsedSig;
      }
    } else if (expected.length === 8) {
      if (computed.slice(0, 8) === expected) {
        return parsedSig;
      }
    }
  } else if (computed === expected) {
    // For functions and errors: compare 8-char selectors
    return parsedSig;
  }

  // Selector mismatch
  return {
    fileName: parsedSig.fileName,
    lineNumber: parsedSig.lineNumber,
    selector: csvSelector,
    abi: parsedSig.abi,
    error: `Selector mismatch: expected ${expected}, computed ${computed} for signature ${parsedSig.signature}`,
    errorType: "selector-mismatch",
  };
}
