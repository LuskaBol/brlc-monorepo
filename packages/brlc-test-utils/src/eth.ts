import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers, network, upgrades } from "hardhat";
import {
  AddressLike,
  BaseContract,
  BigNumberish,
  BlockTag,
  Contract,
  ContractFactory,
  TransactionReceipt,
  TransactionResponse,
} from "ethers";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Waits for a transaction to be mined and returns the receipt.
 * Throws if the receipt is empty.
 */
export async function proveTx(
  txResponsePromise: Promise<TransactionResponse> | TransactionResponse,
): Promise<TransactionReceipt> {
  const txResponse = await txResponsePromise;
  const txReceipt = await txResponse.wait();
  if (!txReceipt) {
    throw new Error("The transaction receipt is empty");
  }
  return txReceipt as TransactionReceipt;
}

/**
 *
 * Not typesafe, but it's a common pattern in the codebase.
 * Connects a contract to a specific signer.
 */
export function connect(contract: BaseContract, signer: HardhatEthersSigner): Contract {
  return contract.connect(signer) as Contract;
}

/**
 * Gets the address from a contract instance in synchronous manner.
 */
export function getAddress(contract: Contract): string {
  const address = contract.target;
  if (typeof address !== "string" || address.length != 42 || !address.startsWith("0x")) {
    throw new Error("The '.target' field of the contract is not an address string");
  }
  return address;
}

/**
 * Gets the timestamp of a transaction.
 */
export async function getTxTimestamp(tx: Promise<TransactionResponse> | TransactionResponse): Promise<number> {
  const receipt = await proveTx(tx);
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  return Number(block?.timestamp ?? 0);
}

/**
 * Gets the timestamp of a specific block or some kind of transaction receipt.
 */

export async function getBlockTimestamp(
  arg: BlockTag | { blockHash: string },
): Promise<number> {
  if (typeof arg === "object" && "blockHash" in arg && arg.blockHash) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return (await ethers.provider.getBlock(arg.blockHash))!.timestamp;
  }
  const block = await ethers.provider.getBlock(arg as BlockTag);
  return block?.timestamp ?? 0;
}

/**
 * Gets the timestamp of the latest block.
 */
export async function getLatestBlockTimestamp(): Promise<number> {
  return getBlockTimestamp("latest");
}

/**
 * Increases the block timestamp to the target value.
 */
export async function increaseBlockTimestampTo(target: number | bigint) {
  if (network.name === "hardhat") {
    await time.increaseTo(target);
  } else if (network.name === "stratus") {
    if (typeof target === "bigint") {
      target = Number(target);
    }
    await ethers.provider.send("evm_setNextBlockTimestamp", [target]);
    await ethers.provider.send("evm_mine", []);
  } else {
    throw new Error(`Setting block timestamp for the current blockchain is not supported: ${network.name}`);
  }
}

/**
 * Increases the block timestamp by a given amount.
 */
export async function increaseBlockTimestamp(seconds: number) {
  const currentTimestamp = await getLatestBlockTimestamp();
  await increaseBlockTimestampTo(currentTimestamp + seconds);
}

/**
 * Gets the number of events matching a specific event name from a transaction.
 */
export async function getNumberOfEvents(
  tx: Promise<TransactionResponse>,
  contract: Contract,
  eventName: string,
): Promise<number> {
  const topic = contract.filters[eventName].fragment.topicHash;
  return (await proveTx(tx)).logs.filter(log => log.topics[0] == topic).length;
}

/**
 * Checks that a UUPS upgradeable contract can be upgraded properly.
 */
export async function checkContractUupsUpgrading(
  contract: Contract,
  contractFactory: ContractFactory,
  upgradeFunctionSignature = "upgradeToAndCall(address,bytes)",
) {
  const contractAddress = await contract.getAddress();
  const oldImplementationAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
  const newImplementation = await contractFactory.deploy();
  await newImplementation.waitForDeployment();
  const expectedNewImplementationAddress = await newImplementation.getAddress();

  if (upgradeFunctionSignature === "upgradeToAndCall(address,bytes)") {
    await proveTx(contract[upgradeFunctionSignature](expectedNewImplementationAddress, "0x"));
  } else {
    await proveTx(contract[upgradeFunctionSignature](expectedNewImplementationAddress));
  }

  const actualNewImplementationAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
  expect(actualNewImplementationAddress).to.eq(expectedNewImplementationAddress);
  expect(actualNewImplementationAddress).not.to.eq(oldImplementationAddress);
}

/**
 * Checks a token transfer path for correctness.
 * Verifies that Transfer events were emitted in the expected order.
 */
export async function checkTokenPath(
  tx: TransactionResponse | Promise<TransactionResponse>,
  token: Contract | BaseContract,
  chain: AddressLike[],
  amount: BigNumberish,
) {
  for (let i = 0; i < chain.length - 1; i++) {
    await expect(tx).to.emit(token, "Transfer").withArgs(chain[i], chain[i + 1], amount);
  }
}

/**
 * Deploys a contract and connects it to a specific signer.
 * Not typesafe, but it's a common pattern in the codebase.
 */
export async function deployAndConnectContract(
  contractFactory: ContractFactory,
  account: HardhatEthersSigner,
): Promise<Contract> {
  let contract = (await contractFactory.deploy()) as Contract;
  await contract.waitForDeployment();
  contract = connect(contract, account); // Explicitly specifying the initial account
  return contract;
}
