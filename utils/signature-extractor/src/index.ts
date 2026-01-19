import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CollisionGroup, CsvRow, ParsedSignature, ProcessingStats, ValidationError } from "./types.js";
import { parseCsvFile } from "./csv-parser.js";
import { processABI } from "./abi-processor.js";
import { validateSelector } from "./validator.js";
import { detectCollisions } from "./collision-detector.js";
import { writeCollisionReport, writeSignaturesFile, writeValidationReport } from "./output-writer.js";
import { logInfo, logStats } from "./logger.js";

interface ProcessingResult {
  signatures: ParsedSignature[];
  collisions: CollisionGroup[];
  errors: ValidationError[];
}

interface ProcessingContext {
  errors: ValidationError[];
  uniqueSignatures: Map<string, ParsedSignature>;
  stats: ProcessingStats;
}

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value?.trim() ? value.trim() : fallback;
}

function processRow(
  csvRow: CsvRow,
  ctx: ProcessingContext,
): void {
  const parsed = processABI(csvRow);
  if ("errorType" in parsed) {
    ctx.stats.invalidABIs++;
    ctx.errors.push(parsed);
    return;
  }
  ctx.stats.validABIs++;

  const validated = validateSelector(parsed, csvRow.selector);
  if ("errorType" in validated) {
    ctx.stats.selectorMismatches++;
    ctx.errors.push(validated);
    return;
  }
  ctx.stats.selectorMatches++;

  const key = `${validated.type}:${validated.signature}`;
  if (ctx.uniqueSignatures.has(key)) {
    ctx.stats.duplicatesRemoved++;
  } else {
    ctx.uniqueSignatures.set(key, validated);
  }
}

function processSingleFile(filePath: string, fileName: string, ctx: ProcessingContext): void {
  logInfo(`Processing ${fileName}...`);

  const { rows, errors: csvErrors } = parseCsvFile(filePath);
  ctx.stats.recordsPerFile.set(fileName, rows.length);
  ctx.stats.totalRecordsRead += rows.length;
  ctx.errors.push(...csvErrors);

  logInfo(`  ${rows.length} record(s), ${csvErrors.length} CSV error(s)`);

  for (let i = 0; i < rows.length; i++) {
    processRow(rows[i], ctx);

    if ((i + 1) % 10000 === 0) {
      logInfo(`  Processed ${i + 1}/${rows.length} records`);
    }
  }
}

function processFiles(
  inputDir: string,
  csvFiles: string[],
  stats: ProcessingStats,
): ProcessingResult {
  const ctx: ProcessingContext = {
    errors: [],
    uniqueSignatures: new Map(),
    stats,
  };

  for (const fileName of csvFiles) {
    processSingleFile(join(inputDir, fileName), fileName, ctx);
  }

  const signatures = Array.from(ctx.uniqueSignatures.values());
  signatures.sort((a, b) => a.selector.localeCompare(b.selector));
  stats.uniqueSignatures = signatures.length;

  const collisions = detectCollisions(signatures);
  stats.collisions = collisions.length;

  return { signatures, collisions, errors: ctx.errors };
}

function writeOutputs(
  outputDir: string,
  { signatures, collisions, errors }: ProcessingResult,
): void {
  logInfo("Writing output files...");

  const signaturesPath = join(outputDir, "zzz-databases.All.signatures");
  writeSignaturesFile(signatures, signaturesPath);
  logInfo(`  ${signaturesPath}`);

  const collisionsPath = join(outputDir, "signature-collisions.md");
  writeCollisionReport(collisions, collisionsPath);
  logInfo(`  ${collisionsPath}`);

  const validationPath = join(outputDir, "signature-verification.md");
  writeValidationReport(errors, validationPath);
  logInfo(`  ${validationPath}`);
}

function main() {
  const inputDir = env("INPUT_DIR", "./input");
  const outputDir = env("OUTPUT_DIR", "./output");

  logInfo("=== Signature Extraction Script ===");
  logInfo(`Input directory: ${inputDir}`);
  logInfo(`Output directory: ${outputDir}`);

  mkdirSync(outputDir, { recursive: true });

  const csvFiles = readdirSync(inputDir).filter(f => f.endsWith(".csv"));
  if (csvFiles.length === 0) {
    logInfo("No CSV files found.");
    return;
  }
  logInfo(`Found ${csvFiles.length} CSV file(s)`);

  const stats: ProcessingStats = {
    totalRecordsRead: 0,
    recordsPerFile: new Map(),
    validABIs: 0,
    invalidABIs: 0,
    selectorMatches: 0,
    selectorMismatches: 0,
    duplicatesRemoved: 0,
    uniqueSignatures: 0,
    collisions: 0,
  };

  const result = processFiles(inputDir, csvFiles, stats);
  writeOutputs(outputDir, result);

  logStats(stats);
  logInfo("Processing complete!");
}

main();
