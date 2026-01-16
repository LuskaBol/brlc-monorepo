import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { setUpFixture } from "@cloudwalk/brlc-test-utils";

describe("Contract 'MultiSigGuardianWalletFactory'", () => {
  const ADDRESS_ZERO = ethers.ZeroAddress;
  const REQUIRED_APPROVALS = 2;
  const REQUIRED_GUARDIAN_APPROVALS = 1;
  const DEFAULT_EXPIRATION_TIME = 3600 * 24 * 10;

  const EVENT_NAME_NEW_WALLET_DEPLOYED_BY_FACTORY = "NewWallet";

  // Base contract errors
  const ERROR_NAME_DUPLICATE_OWNER_ADDRESS = "DuplicateOwnerAddress";
  const ERROR_NAME_EMPTY_OWNERS_ARRAY = "EmptyOwnersArray";
  const ERROR_NAME_INVALID_REQUIRED_APPROVALS = "InvalidRequiredApprovals";
  const ERROR_NAME_ZERO_OWNER_ADDRESS = "ZeroOwnerAddress";

  // Guardian-specific errors
  const ERROR_NAME_GUARDIAN_ADDRESS_DUPLICATE = "MultiSigGuardianWallet_GuardianAddressDuplicate";
  const ERROR_NAME_GUARDIANS_ARRAY_EMPTY = "MultiSigGuardianWallet_GuardiansArrayEmpty";
  const ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID = "MultiSigGuardianWallet_RequiredGuardianApprovalsInvalid";
  const ERROR_NAME_GUARDIAN_NOT_IN_OWNERS = "MultiSigGuardianWallet_GuardianNotInOwners";

  let walletFactory: ContractFactory;
  let factoryContractFactory: ContractFactory;

  let owner1: HardhatEthersSigner;
  let owner2: HardhatEthersSigner;
  let owner3: HardhatEthersSigner;
  let owner4: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  let ownerAddresses: string[];
  let guardianAddresses: string[];

  before(async () => {
    [, owner1, owner2, owner3, owner4, user] = await ethers.getSigners();
    ownerAddresses = [owner1.address, owner2.address, owner3.address, owner4.address];
    guardianAddresses = [owner1.address, owner2.address];
    walletFactory = await ethers.getContractFactory("MultiSigGuardianWallet");
    factoryContractFactory = await ethers.getContractFactory("MultiSigGuardianWalletFactory");
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

      const tx = factory.deployNewWallet(
        ownerAddresses,
        REQUIRED_APPROVALS,
        guardianAddresses,
        REQUIRED_GUARDIAN_APPROVALS,
      );
      await expect(await tx).to.emit(factory, EVENT_NAME_NEW_WALLET_DEPLOYED_BY_FACTORY);

      const walletAddress = await factory.wallets(0);
      const wallet = await ethers.getContractAt("MultiSigGuardianWallet", walletAddress);

      // Check base wallet configuration
      expect(await wallet.owners()).to.deep.eq(ownerAddresses);
      expect(await wallet.requiredApprovals()).to.eq(REQUIRED_APPROVALS);
      expect(await wallet.transactionCount()).to.eq(0);
      expect(await wallet.cooldownTime()).to.eq(0);
      expect(await wallet.expirationTime()).to.eq(DEFAULT_EXPIRATION_TIME);

      // Check guardian configuration
      expect(await wallet.guardians()).to.deep.eq(guardianAddresses);
      expect(await wallet.requiredGuardianApprovals()).to.eq(REQUIRED_GUARDIAN_APPROVALS);
      expect(await wallet.isGuardian(owner1.address)).to.eq(true);
      expect(await wallet.isGuardian(owner2.address)).to.eq(true);
      expect(await wallet.isGuardian(owner3.address)).to.eq(false);
      expect(await wallet.isGuardian(owner4.address)).to.eq(false);
    });

    it("Is reverted if the input owner array is empty", async () => {
      const { factory } = await setUpFixture(deployFactory);

      await expect(
        factory.deployNewWallet([], REQUIRED_APPROVALS, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_EMPTY_OWNERS_ARRAY);
    });

    it("Is reverted if the input number of required approvals is zero", async () => {
      const { factory } = await setUpFixture(deployFactory);

      const requiredApprovals = 0;
      await expect(
        factory.deployNewWallet(ownerAddresses, requiredApprovals, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_INVALID_REQUIRED_APPROVALS);
    });

    it("Is reverted if the number of required approvals exceeds the length of the owner array", async () => {
      const { factory } = await setUpFixture(deployFactory);

      const requiredApprovals = ownerAddresses.length + 1;
      await expect(
        factory.deployNewWallet(ownerAddresses, requiredApprovals, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_INVALID_REQUIRED_APPROVALS);
    });

    it("Is reverted if one of the input owners is the zero address", async () => {
      const { factory } = await setUpFixture(deployFactory);
      const invalidOwnerAddresses = [ownerAddresses[0], ownerAddresses[1], ADDRESS_ZERO];
      const requiredApprovals = invalidOwnerAddresses.length - 1;

      await expect(
        factory.deployNewWallet(
          invalidOwnerAddresses,
          requiredApprovals,
          [ownerAddresses[0]],
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_ZERO_OWNER_ADDRESS);
    });

    it("Is reverted if there is a duplicate address in the input owner array", async () => {
      const { factory } = await setUpFixture(deployFactory);
      const invalidOwnerAddresses = [ownerAddresses[0], ownerAddresses[1], ownerAddresses[0]];
      const requiredApprovals = ownerAddresses.length - 1;

      await expect(
        factory.deployNewWallet(
          invalidOwnerAddresses,
          requiredApprovals,
          [ownerAddresses[0]],
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_DUPLICATE_OWNER_ADDRESS);
    });

    it("Is reverted if the input guardian array is empty", async () => {
      const { factory } = await setUpFixture(deployFactory);

      await expect(
        factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS, [], REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_GUARDIANS_ARRAY_EMPTY);
    });

    it("Is reverted if the input number of required guardian approvals is zero", async () => {
      const { factory } = await setUpFixture(deployFactory);

      const requiredGuardianApprovals = 0;
      await expect(
        factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS, guardianAddresses, requiredGuardianApprovals),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID);
    });

    it("Is reverted if required guardian approvals exceeds the guardian array length", async () => {
      const { factory } = await setUpFixture(deployFactory);

      const requiredGuardianApprovals = guardianAddresses.length + 1;
      await expect(
        factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS, guardianAddresses, requiredGuardianApprovals),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID);
    });

    it("Is reverted if a guardian is not in the owners list", async () => {
      const { factory } = await setUpFixture(deployFactory);
      const invalidGuardianAddresses = [owner1.address, user.address];

      await expect(
        factory.deployNewWallet(
          ownerAddresses,
          REQUIRED_APPROVALS,
          invalidGuardianAddresses,
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_GUARDIAN_NOT_IN_OWNERS);
    });

    it("Is reverted if there is a duplicate address in the input guardian array", async () => {
      const { factory } = await setUpFixture(deployFactory);
      const invalidGuardianAddresses = [owner1.address, owner1.address];

      await expect(
        factory.deployNewWallet(
          ownerAddresses,
          REQUIRED_APPROVALS,
          invalidGuardianAddresses,
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_GUARDIAN_ADDRESS_DUPLICATE);
    });
  });

  describe("Function 'walletsCount()'", async () => {
    it("Returns the amount of deployed wallets", async () => {
      const { factory } = await setUpFixture(deployFactory);

      expect(await factory.walletsCount()).to.eq(0);
      await factory.deployNewWallet(
        ownerAddresses,
        REQUIRED_APPROVALS,
        guardianAddresses,
        REQUIRED_GUARDIAN_APPROVALS,
      );
      expect(await factory.walletsCount()).to.eq(1);
      await factory.deployNewWallet(
        ownerAddresses,
        REQUIRED_APPROVALS,
        guardianAddresses,
        REQUIRED_GUARDIAN_APPROVALS,
      );
      expect(await factory.walletsCount()).to.eq(2);
    });
  });
});
