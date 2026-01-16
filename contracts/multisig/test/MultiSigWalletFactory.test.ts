import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { setUpFixture } from "@cloudwalk/brlc-test-utils";

describe("Contract 'MultiSigWalletFactory'", () => {
  const ADDRESS_ZERO = ethers.ZeroAddress;
  const REQUIRED_APPROVALS = 2;
  const DEFAULT_EXPIRATION_TIME = 3600 * 24 * 10;

  const EVENT_NAME_NEW_WALLET_DEPLOYED_BY_FACTORY = "NewWallet";

  const ERROR_NAME_OWNER_ADDRESS_DUPLICATE = "MultiSigWallet_OwnerAddressDuplicate";
  const ERROR_NAME_OWNERS_ARRAY_EMPTY = "MultiSigWallet_OwnersArrayEmpty";
  const ERROR_NAME_REQUIRED_APPROVALS_INVALID = "MultiSigWallet_RequiredApprovalsInvalid";
  const ERROR_NAME_OWNER_ADDRESS_ZERO = "MultiSigWallet_OwnerAddressZero";

  let walletFactory: ContractFactory;
  let factoryContractFactory: ContractFactory;

  let owner1: HardhatEthersSigner;
  let owner2: HardhatEthersSigner;
  let owner3: HardhatEthersSigner;

  let ownerAddresses: string[];

  before(async () => {
    [, owner1, owner2, owner3] = await ethers.getSigners();
    ownerAddresses = [owner1.address, owner2.address, owner3.address];
    walletFactory = await ethers.getContractFactory("MultiSigWallet");
    factoryContractFactory = await ethers.getContractFactory("MultiSigWalletFactory");
  });

  async function deployFactory(): Promise<{ factory: Contract }> {
    const factory = await factoryContractFactory.deploy() as Contract;
    await factory.waitForDeployment();
    return {
      factory,
    };
  }

  describe("Function 'deployNewWallet()'", () => {
    it("Creates new wallet instance with selected parameters", async () => {
      const { factory } = await setUpFixture(deployFactory);

      await expect(await factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS))
        .to.emit(factory, EVENT_NAME_NEW_WALLET_DEPLOYED_BY_FACTORY);

      const walletAddress = await factory.wallets(0);
      const wallet = await ethers.getContractAt("MultiSigWallet", walletAddress);
      expect(await wallet.owners()).to.deep.eq(ownerAddresses);
      expect(await wallet.requiredApprovals()).to.eq(REQUIRED_APPROVALS);
      expect(await wallet.transactionCount()).to.eq(0);
      expect(await wallet.cooldownTime()).to.eq(0);
      expect(await wallet.expirationTime()).to.eq(DEFAULT_EXPIRATION_TIME);
    });

    it("Is reverted if the input owner array is empty", async () => {
      const { factory } = await setUpFixture(deployFactory);

      await expect(factory.deployNewWallet([], REQUIRED_APPROVALS))
        .to.be.revertedWithCustomError(walletFactory, ERROR_NAME_OWNERS_ARRAY_EMPTY);
    });

    it("Is reverted if the input number of required approvals is zero", async () => {
      const { factory } = await setUpFixture(deployFactory);

      const requiredApprovals = 0;
      await expect(factory.deployNewWallet(ownerAddresses, requiredApprovals))
        .to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_APPROVALS_INVALID);
    });

    it("Is reverted if the number of required approvals exceeds the length of the owner array", async () => {
      const { factory } = await setUpFixture(deployFactory);

      const requiredApprovals = ownerAddresses.length + 1;
      await expect(factory.deployNewWallet(ownerAddresses, requiredApprovals))
        .to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_APPROVALS_INVALID);
    });

    it("Is reverted if one of the input owners is the zero address", async () => {
      const { factory } = await setUpFixture(deployFactory);
      const ownerAddressArray = [ownerAddresses[0], ownerAddresses[1], ADDRESS_ZERO];
      const requiredApprovals = ownerAddressArray.length - 1;

      await expect(factory.deployNewWallet(ownerAddressArray, requiredApprovals))
        .to.be.revertedWithCustomError(walletFactory, ERROR_NAME_OWNER_ADDRESS_ZERO);
    });

    it("Is reverted if there is a duplicate address in the input owner array", async () => {
      const { factory } = await setUpFixture(deployFactory);
      const ownerAddressArray = [ownerAddresses[0], ownerAddresses[1], ownerAddresses[0]];
      const requiredApprovals = ownerAddresses.length - 1;
      await expect(factory.deployNewWallet(ownerAddressArray, requiredApprovals))
        .to.be.revertedWithCustomError(walletFactory, ERROR_NAME_OWNER_ADDRESS_DUPLICATE);
    });
  });

  describe("Function 'walletsCount()'", async () => {
    it("Returns the amount of deployed wallets", async () => {
      const { factory } = await setUpFixture(deployFactory);

      expect(await factory.walletsCount()).to.eq(0);
      await factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS);
      expect(await factory.walletsCount()).to.eq(1);
    });
  });
});
