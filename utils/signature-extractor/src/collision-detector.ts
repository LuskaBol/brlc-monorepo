import type { CollisionGroup, ParsedSignature } from "./types.js";

interface ParsedSignatureGroup {
  selector: string;
  signatures: ParsedSignature[];
}

export function detectCollisions(signatures: ParsedSignature[]): CollisionGroup[] {
  // This function happens after the deduplication step, so we can group by type and selector
  // ignoring the fileName and lineNumber
  const groupedSignatures = Map.groupBy(signatures, s => `${s.type}:${s.selector}`); // ES2024+
  const parsedSignatureGroups: ParsedSignatureGroup[] = groupedSignatures
    .entries().toArray().map(entry => ({
      selector: entry[1][0].selector,
      signatures: entry[1],
    }));
  const collisionGroups = parsedSignatureGroups.filter(group => group.signatures.length > 1).map(toCollisionGroup);

  return collisionGroups.sort((a, b) => a.selector.localeCompare(b.selector));
}

function toCollisionGroup(group: ParsedSignatureGroup): CollisionGroup {
  return {
    selector: group.selector,
    type: group.signatures[0].type,
    variants: group.signatures.map(parsedSignature => ({
      signature: parsedSignature.signature,
      sources: [{ fileName: parsedSignature.fileName, lineNumber: parsedSignature.lineNumber }],
    })),
  };
}
