import { ErrorFragment, EventFragment, Fragment, FunctionFragment } from "ethers";
import type { CsvRow, ParsedSignature, ValidationError } from "./types.js";

export function processABI(csvRow: CsvRow): ParsedSignature | ValidationError {
  try {
    const abiJson = JSON.parse(csvRow.abi);
    const fragment = Fragment.from(abiJson);

    if (fragment.type !== "function" && fragment.type !== "error" && fragment.type !== "event") {
      return {
        fileName: csvRow.fileName,
        lineNumber: csvRow.lineNumber,
        selector: csvRow.selector,
        abi: csvRow.abi,
        error: `Unsupported ABI fragment type: ${fragment.type}`,
        errorType: "invalid-abi",
      };
    }

    const signature = fragment.format("sighash");

    // Get selector (4 bytes) or topic (32 bytes) as ethers computes keccak256 internally
    let computedSelector: string;
    if (fragment.type === "event") {
      computedSelector = (fragment as EventFragment).topicHash.slice(2).toLowerCase();
    } else if (fragment.type === "function") {
      computedSelector = (fragment as FunctionFragment).selector.slice(2).toLowerCase();
    } else {
      computedSelector = (fragment as ErrorFragment).selector.slice(2).toLowerCase();
    }

    return {
      selector: computedSelector,
      signature,
      type: fragment.type,
      abi: csvRow.abi,
      fileName: csvRow.fileName,
      lineNumber: csvRow.lineNumber,
    };
  } catch (error: unknown) {
    // Either JSON parsing failed or ethers couldn't parse the ABI
    return {
      fileName: csvRow.fileName,
      lineNumber: csvRow.lineNumber,
      selector: csvRow.selector,
      abi: csvRow.abi,
      error: error instanceof Error ? error.message : String(error),
      errorType: "invalid-abi",
    };
  }
}
