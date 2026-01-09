import { expect } from "chai";

export interface EventParameterCheckingOptions {
  showValuesInErrorMessage?: boolean;
  caseInsensitiveComparison?: boolean;
  convertToJson?: boolean;
}

interface Stringable {
  toString(): string;
}

/**
 * Creates a predicate function that checks if an event parameter matches the expected value.
 * Useful for chai-as-promised event assertions.
 */
export function checkEventParameter<T extends Stringable>(
  fieldName: string,
  expectedValue: T | string | undefined | null,
  options: EventParameterCheckingOptions = {},
): (value: T) => boolean {
  const f = function (value: T | string): boolean {
    let actualValue: string | T = value;
    let expected: T | string | undefined | null = expectedValue;

    if (options.convertToJson) {
      actualValue = JSON.stringify(value);
      expected = JSON.stringify(expectedValue);
    }
    let errorMessage = `The "${fieldName}" field of the event is wrong`;
    if (options.showValuesInErrorMessage) {
      errorMessage += ` (actual: ${actualValue} ; expected: ${expected})`;
    }
    if (options.caseInsensitiveComparison) {
      actualValue = actualValue.toString().toLowerCase();
      expected = expected?.toString()?.toLowerCase();
    }
    expect(actualValue).to.equal(expected, errorMessage);
    return true;
  };
  Object.defineProperty(f, "name", { value: `checkEventField_${fieldName}`, writable: false });
  return f;
}

/**
 * Alias for checkEventParameter for backward compatibility.
 */
export const checkEventField = checkEventParameter;

/**
 * Creates a predicate function that checks if an event parameter does NOT match a value.
 */
export function checkEventParameterNotEqual<T extends Stringable>(
  fieldName: string,
  notExpectedValue: T | string | undefined | null,
  options: EventParameterCheckingOptions = {},
): (value: T | string) => boolean {
  const f = function (value: T | string): boolean {
    let actualValue: string | T = value;
    let notExpected: T | string | undefined | null = notExpectedValue;

    if (options.convertToJson) {
      actualValue = JSON.stringify(value);
      notExpected = JSON.stringify(notExpectedValue);
    }
    let errorMessage =
      `The "${fieldName}" field of the event is wrong because it is equal ${notExpected} but should not`;
    if (options.showValuesInErrorMessage) {
      errorMessage += ` (actual: ${actualValue} ; not expected: ${notExpected})`;
    }
    if (options.caseInsensitiveComparison) {
      actualValue = actualValue.toString().toLowerCase();
      notExpected = notExpected?.toString()?.toLowerCase();
    }
    expect(actualValue).not.to.equal(notExpected, errorMessage);
    return true;
  };
  Object.defineProperty(f, "name", { value: `checkEventFieldNot_${fieldName}`, writable: false });
  return f;
}

/**
 * Alias for checkEventParameterNotEqual for backward compatibility.
 */
export const checkEventFieldNotEqual = checkEventParameterNotEqual;

// Re-export checkEquality from common for backward compatibility
export { checkEquality } from "./common";
