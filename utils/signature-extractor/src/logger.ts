import type { ProcessingStats } from "./types.js";

function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function logInfo(message: string): void {
  console.log(`[${getTimestamp()}] [INFO] ${message}`);
}

export function logProgress(current: number, total: number, context: string): void {
  console.log(`[${getTimestamp()}] [INFO] Processing: ${current}/${total} records (${context})`);
}

export function logStats(stats: ProcessingStats): void {
  console.log("\n" + "=".repeat(60));
  console.log("Processing Statistics");
  console.log("=".repeat(60));
  console.log(`Total records read: ${stats.totalRecordsRead}`);
  console.log("\nRecords per file:");
  for (const [fileName, count] of stats.recordsPerFile.entries()) {
    console.log(`  ${fileName}: ${count}`);
  }
  console.log(`\nValid ABIs: ${stats.validABIs}`);
  console.log(`Invalid ABIs: ${stats.invalidABIs}`);
  console.log(`Selector matches: ${stats.selectorMatches}`);
  console.log(`Selector mismatches: ${stats.selectorMismatches}`);
  console.log(`Duplicates removed: ${stats.duplicatesRemoved}`);
  console.log(`Unique signatures: ${stats.uniqueSignatures}`);
  console.log(`Collisions detected: ${stats.collisions}`);
  console.log("=".repeat(60) + "\n");
}
