export interface ContractConfig {
  address: string;
  instanceNumber: number;
  name: string;
}

export function getContractLabel(contract: ContractConfig): string {
  return `"${contract.name} #${contract.instanceNumber}"`;
}

export type NetworkContracts = Record<string, ContractConfig[]>;

export const DEPLOYED_CONTRACTS: NetworkContracts = {
  cw_mainnet: [],
  cw_testnet: [
    { address: "0x78bd8e6acdef0ba105a27cb496828017091f1276", instanceNumber: 1, name: "LendingEngineV2" },
    { address: "0x11912796c6dc80a77bb313ab4d1a93f1112159c1", instanceNumber: 1, name: "LendingMarketV2" },
    { address: "0x26fc20fc59a7e0c532e45323e09fe352a131cc53", instanceNumber: 1, name: "CreditLineV2" },
    { address: "0x288951c98a5cc5ecec4416b885ff9a10e1298da6", instanceNumber: 2, name: "CreditLineV2" },
    { address: "0x313ab6f3804b6e9d8bfda67958cffd5106a181fc", instanceNumber: 3, name: "CreditLineV2" },
    { address: "0x7d0fc5d44796a15bdbc92118c93e77862b54ef46", instanceNumber: 4, name: "CreditLineV2" },
    { address: "0xd3517cbcf286b81ca1103d47e0ce5cff1917525f", instanceNumber: 5, name: "CreditLineV2" },
  ],
};
