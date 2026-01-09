import { HardhatNetworkHDAccountsUserConfig } from "hardhat/types";

/**
 * Default mnemonic for local development networks.
 * DO NOT use this mnemonic for any real funds.
 */
const DEFAULT_MNEMONIC = "test test test test test test test test test test test junk";

/**
 * Returns accounts config with mnemonic, falling back to default if not provided.
 * @param mnemonic - Optional mnemonic from environment
 */
export function mnemonicOrDefault(mnemonic?: string): HardhatNetworkHDAccountsUserConfig {
  return {
    mnemonic: mnemonic ?? DEFAULT_MNEMONIC,
  };
}

/**
 * Returns private key array if provided, undefined otherwise.
 * @param pk - Optional private key from environment
 */
export function pkOrEmpty(pk?: string): string[] | undefined {
  return pk ? [pk] : undefined;
}
