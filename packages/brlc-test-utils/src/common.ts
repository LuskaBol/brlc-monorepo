import { expect } from "chai";
import { Result } from "ethers";
import { network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Sets up a test fixture that leverages Hardhat's snapshot feature
 * for faster test execution on hardhat network.
 */
export async function setUpFixture<T>(func: () => Promise<T>): Promise<T> {
  if (network.name === "hardhat") {
    return loadFixture(func);
  } else {
    return func();
  }
}

/**
 * Compares two objects and asserts that all properties in expectedObject
 * match the corresponding properties in actualObject.
 */
export function checkEquality<T extends Record<string, unknown>>(
  actualObject: T,
  expectedObject: T,
  index?: number,
  props: {
    ignoreObjects?: boolean;
  } = { ignoreObjects: false },
) {
  const indexString = index == null ? "" : ` with index: ${index}`;
  Object.keys(expectedObject).forEach((property) => {
    const value = actualObject[property];
    if (typeof value === "undefined" || typeof value === "function") {
      throw Error(`Property "${property}" is not found in the actual object` + indexString);
    }
    if (typeof expectedObject[property] === "object" && props.ignoreObjects) {
      return;
    }
    expect(value).to.deep.equal(
      expectedObject[property],
      `Mismatch in the "${property}" property between the actual object and expected one` + indexString,
    );
  });
}

/**
 * Helper to convert a contract result to a plain object.
 * Works with ethers Result objects.
 */
export function resultToObject<T extends Record<string, unknown> = Record<string, unknown>>(result: unknown): T {
  return (result as Result).toObject(true) as T;
}

/**
 * Returns the maximum uint value for a given number of bits.
 */
export function maxUintForBits(numberOfBits: number): bigint {
  return 2n ** BigInt(numberOfBits) - 1n;
}

/**
 * Creates a revert message for missing role errors (OpenZeppelin v4 style).
 */
export function createRevertMessageDueToMissingRole(address: string, role: string): string {
  return `AccessControl: account ${address.toLowerCase()} is missing role ${role.toLowerCase()}`;
}

/**
 * Rounds a value to the nearest multiple of the given accuracy.
 */
export function roundMath(value: bigint | number, accuracy: bigint | number): bigint {
  const accuracyBI = BigInt(accuracy);
  return ((BigInt(value) + accuracyBI / 2n) / accuracyBI) * accuracyBI;
}
