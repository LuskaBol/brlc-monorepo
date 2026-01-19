import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { CsvRow, ValidationError } from "./types.js";
import { logProgress } from "./logger.js";

const FIELD_NAME_SELECTOR = "selector";
const FIELD_NAME_ABI = "abi";

export interface ParseCsvResult {
  rows: CsvRow[];
  errors: ValidationError[];
}

export function parseCsvFile(filePath: string): ParseCsvResult {
  const fileName = basename(filePath);
  const content = readFileSync(filePath, "utf-8");

  const defaultError: ValidationError = {
    fileName,
    lineNumber: 1,
    selector: "",
    abi: "",
    error: "",
    errorType: "invalid-csv",
  };

  // Split into lines, handling both \n and \r\n
  const lines = content.split(/\r?\n/);

  if (lines.length === 0 || (lines.length === 1 && !lines[0]?.trim())) {
    return {
      rows: [],
      errors: [{
        ...defaultError,
        error: `Empty CSV file: ${fileName}`,
      }],
    };
  }

  // Parse header row
  const headerRow = lines[0];
  const headers = headerRow.split("\t").map(h => h.trim().toLowerCase());

  // Find required column indexes
  const selectorIndex = headers.indexOf(FIELD_NAME_SELECTOR);
  const abiIndex = headers.indexOf(FIELD_NAME_ABI);

  if (selectorIndex === -1 || abiIndex === -1) {
    return {
      rows: [],
      errors: [{
        ...defaultError,
        error: `Missing required field titles (${FIELD_NAME_SELECTOR}/${FIELD_NAME_ABI}) in file "${fileName}"`,
      }],
    };
  }

  const rows: CsvRow[] = [];
  const errors: ValidationError[] = [];

  // Parse data rows (starting from line 2, since line 1 is header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    const columns = line.split("\t");

    // Extract selector and abi
    const selector = (columns[selectorIndex] || "").trim();
    const abi = (columns[abiIndex] || "").trim();

    // Validate required fields
    if (!selector || !abi) {
      errors.push(
        {
          ...defaultError,
          lineNumber: i + 1,
          selector,
          abi,
          error: `Missing required fields (${FIELD_NAME_SELECTOR}/${FIELD_NAME_ABI}) in file "${fileName}"`,
        },
      );
      continue;
    }

    rows.push({
      selector,
      abi,
      fileName,
      lineNumber: i + 1, // Line numbers start at 1, and add 1 because header is line 1
    });

    // Log progress every 10,000 records
    if (rows.length % 10000 === 0) {
      logProgress(rows.length, lines.length - 1, fileName);
    }
  }

  return { rows, errors };
}
