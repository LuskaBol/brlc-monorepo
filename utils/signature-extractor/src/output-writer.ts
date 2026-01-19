import { writeFileSync } from "node:fs";
import type { CollisionGroup, ParsedSignature, ValidationError } from "./types.js";

export function writeSignaturesFile(signatures: ParsedSignature[], outputPath: string): void {
  const sortedBySelector = (sigs: ParsedSignature[]) =>
    [...sigs].sort((a, b) => a.selector.localeCompare(b.selector));

  const formatSection = (title: string, sigs: ParsedSignature[]) =>
    sigs.length > 0
      ? [`${title}:`, ...sigs.map(s => `${s.selector}: ${s.signature}`), ""]
      : [];

  const functions = sortedBySelector(signatures.filter(s => s.type === "function"));
  const errors = sortedBySelector(signatures.filter(s => s.type === "error"));
  const events = sortedBySelector(signatures.filter(s => s.type === "event"));

  const output = [
    ...formatSection("Function signatures", functions),
    ...formatSection("Error signatures", errors),
    ...formatSection("Event signatures", events),
  ].join("\n").trimEnd();

  writeFileSync(outputPath, output, "utf-8");
}

export function writeCollisionReport(collisions: CollisionGroup[], outputPath: string): void {
  const functionCollisions = collisions.filter(c => c.type === "function").length;
  const errorCollisions = collisions.filter(c => c.type === "error").length;
  const eventCollisions = collisions.filter(c => c.type === "event").length;

  const header = [
    "# Signature Collision Report",
    "",
    "## Summary",
    "",
    `- Total collisions: ${collisions.length}`,
    `- Function collisions: ${functionCollisions}`,
    `- Error collisions: ${errorCollisions}`,
    `- Event collisions: ${eventCollisions}`,
    "",
  ];

  if (collisions.length === 0) {
    const output = [...header, "No collisions detected."].join("\n");
    writeFileSync(outputPath, output, "utf-8");
    return;
  }

  const formatVariant = (variant: CollisionGroup["variants"][0], index: number) => [
    `**Variant ${index + 1}**: \`${variant.signature}\``,
    "- Sources:",
    ...variant.sources.map(s => `  - \`${s.fileName}:${s.lineNumber}\``),
    "",
  ];

  const formatCollision = (collision: CollisionGroup) => [
    `#### Selector: 0x${collision.selector}`,
    `**Collision count**: ${collision.variants.length} variants`,
    "",
    ...collision.variants.flatMap((variant, i) => formatVariant(variant, i)),
    "---",
    "",
  ];

  const formatTypeSection = (type: "function" | "error" | "event") => {
    const typeCollisions = collisions.filter(c => c.type === type);

    return typeCollisions.length > 0
      ? [
          `### ${type.charAt(0).toUpperCase() + type.slice(1)} Collisions`,
          "",
          ...typeCollisions.flatMap(formatCollision),
        ]
      : [];
  };

  const details = [
    "## Collision Details",
    "",
    ...formatTypeSection("function"),
    ...formatTypeSection("error"),
    ...formatTypeSection("event"),
  ];

  const output = [...header, ...details].join("\n");
  writeFileSync(outputPath, output, "utf-8");
}

export function writeValidationReport(errors: ValidationError[], outputPath: string): void {
  const invalidABIs = errors.filter(e => e.errorType === "invalid-abi");
  const selectorMismatches = errors.filter(e => e.errorType === "selector-mismatch");

  const header = [
    "# Signature Validation Report",
    "",
    "## Summary",
    "",
    `- Total validation errors: ${errors.length}`,
    `- Invalid ABI errors: ${invalidABIs.length}`,
    `- Selector mismatch errors: ${selectorMismatches.length}`,
    "",
  ];

  if (errors.length === 0) {
    const output = [...header, "No validation errors detected."].join("\n");
    writeFileSync(outputPath, output, "utf-8");
    return;
  }

  const formatTableRow = (err: ValidationError, maxLength: number) => {
    const errorMsg = err.error.replaceAll("|", String.raw`\|`).substring(0, maxLength);
    return `| ${err.fileName} | ${err.lineNumber} | 0x${err.selector} | ${errorMsg} |`;
  };

  const invalidABISection = invalidABIs.length > 0
    ? [
        "## Invalid ABI Entries",
        "",
        "| File | Line | Selector | Error |",
        "|------|------|----------|-------|",
        ...invalidABIs.map(err => formatTableRow(err, 100)),
        "",
      ]
    : [];

  const selectorMismatchSection = selectorMismatches.length > 0
    ? [
        "## Selector Mismatch Entries",
        "",
        "| File | Line | Expected | Error |",
        "|------|------|----------|-------|",
        ...selectorMismatches.map(err => formatTableRow(err, 150)),
        "",
      ]
    : [];

  const output = [...header, ...invalidABISection, ...selectorMismatchSection].join("\n");
  writeFileSync(outputPath, output, "utf-8");
}
