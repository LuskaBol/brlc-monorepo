export interface CsvRow {
  selector: string;
  abi: string;
  fileName: string;
  lineNumber: number;
}

export type SignatureType = "function" | "error" | "event";

export interface ParsedSignature {
  selector: string; // 4-byte selector or 32-byte topic hash
  signature: string;
  type: SignatureType;
  abi: string;
  fileName: string;
  lineNumber: number;
}

export type ValidationErrorType = "invalid-csv" | "invalid-abi" | "selector-mismatch";

export interface ValidationError {
  fileName: string;
  lineNumber: number;
  selector: string; // 4-byte selector or 32-byte topic hash
  abi: string;
  error: string;
  errorType: ValidationErrorType;
}

export interface CollisionGroup {
  selector: string; // 4-byte selector or 32-byte topic hash
  type: SignatureType;
  variants: {
    signature: string;
    sources: { fileName: string; lineNumber: number }[];
  }[];
}

export interface ProcessingStats {
  totalRecordsRead: number;
  recordsPerFile: Map<string, number>;
  validABIs: number;
  invalidABIs: number;
  selectorMatches: number;
  selectorMismatches: number;
  duplicatesRemoved: number;
  uniqueSignatures: number;
  collisions: number;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
