import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { checkEquality, connect, getAddress, proveTx, setUpFixture } from "@cloudwalk/brlc-test-utils";

interface Version {
  major: number;
  minor: number;
  patch: number;

  [key: string]: number; // Indexing signature to ensure that fields are iterated over in a key-value style
}

describe("Contract 'MultiSigGuardianWalletUpgradeable'", () => {
  const ADDRESS_ZERO = ethers.ZeroAddress;
  const REQUIRED_APPROVALS = 2;
  const REQUIRED_GUARDIAN_APPROVALS = 1;
  const DEFAULT_EXPIRATION_TIME = 3600 * 24 * 10;

  const ERROR_MESSAGE_CONTRACT_IS_ALREADY_INITIALIZED = "Initializable: contract is already initialized";

  // Base multisig wallet errors
  const ERROR_NAME_OWNER_ADDRESS_DUPLICATE = "MultiSigWallet_OwnerAddressDuplicate";
  const ERROR_NAME_OWNERS_ARRAY_EMPTY = "MultiSigWallet_OwnersArrayEmpty";
  const ERROR_NAME_REQUIRED_APPROVALS_INVALID = "MultiSigWallet_RequiredApprovalsInvalid";
  const ERROR_NAME_CALLER_UNAUTHORIZED = "MultiSigWallet_CallerUnauthorized";
  const ERROR_NAME_OWNER_ADDRESS_ZERO = "MultiSigWallet_OwnerAddressZero";

  // Guardian-specific errors
  const ERROR_NAME_GUARDIAN_ADDRESS_DUPLICATE = "MultiSigGuardianWallet_GuardianAddressDuplicate";
  const ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID = "MultiSigGuardianWallet_RequiredGuardianApprovalsInvalid";
  const ERROR_NAME_GUARDIAN_NOT_IN_OWNERS = "MultiSigGuardianWallet_GuardianNotInOwners";

  const EXPECTED_VERSION: Version = {
    major: 1,
    minor: 2,
    patch: 0,
  };

  let walletUpgradeableFactory: ContractFactory;
  let walletFactory: ContractFactory;

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
    walletUpgradeableFactory = await ethers.getContractFactory("MultiSigGuardianWalletUpgradeable");
    walletFactory = await ethers.getContractFactory("MultiSigGuardianWallet");
  });

  async function checkOwnership(
    wallet: Contract,
    options: { ownerAddresses: string[]; expectedOwnershipStatus: boolean },
  ) {
    for (const address of options.ownerAddresses) {
      expect(await wallet.isOwner(address)).to.eq(
        options.expectedOwnershipStatus,
        `Wrong ownership status for address: ${address}`,
      );
    }
  }

  async function checkGuardianship(
    wallet: Contract,
    options: { guardianAddresses: string[]; expectedGuardianStatus: boolean },
  ) {
    for (const address of options.guardianAddresses) {
      expect(await wallet.isGuardian(address)).to.eq(
        options.expectedGuardianStatus,
        `Wrong guardian status for address: ${address}`,
      );
    }
  }

  async function deployWalletUpgradeable(): Promise<{ wallet: Contract }> {
    const wallet = await upgrades.deployProxy(
      walletUpgradeableFactory,
      [ownerAddresses, REQUIRED_APPROVALS, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS],
    ) as Contract;
    await wallet.waitForDeployment();

    return {
      wallet,
    };
  }

  async function deployWalletImplementation(): Promise<{
    walletImplementation: Contract;
  }> {
    const walletImplementation = await walletFactory.deploy(
      ownerAddresses,
      REQUIRED_APPROVALS,
      guardianAddresses,
      REQUIRED_GUARDIAN_APPROVALS,
    ) as Contract;
    await walletImplementation.waitForDeployment();

    return {
      walletImplementation,
    };
  }

  async function deployAllContracts(): Promise<{
    wallet: Contract;
    walletImplementation: Contract;
  }> {
    const { wallet } = await deployWalletUpgradeable();
    const { walletImplementation } = await deployWalletImplementation();

    return {
      wallet,
      walletImplementation,
    };
  }

  function encodeUpgradeFunctionData(newImplementationAddress: string) {
    const ABI = ["function upgradeTo(address newImplementation)"];
    const upgradeInterface = new ethers.Interface(ABI);
    return upgradeInterface.encodeFunctionData(
      "upgradeTo",
      [newImplementationAddress],
    );
  }

  describe("Function 'initialize()'", () => {
    it("Configures the contract as expected", async () => {
      const { wallet } = await setUpFixture(deployWalletUpgradeable);

      // Check base wallet configuration
      expect(await wallet.owners()).to.deep.eq(ownerAddresses);
      expect(await wallet.requiredApprovals()).to.eq(REQUIRED_APPROVALS);
      expect(await wallet.transactionCount()).to.eq(0);
      expect(await wallet.cooldownTime()).to.eq(0);
      expect(await wallet.expirationTime()).to.eq(DEFAULT_EXPIRATION_TIME);
      await checkOwnership(wallet, {
        ownerAddresses,
        expectedOwnershipStatus: true,
      });

      // Check guardian configuration
      expect(await wallet.guardians()).to.deep.eq(guardianAddresses);
      expect(await wallet.requiredGuardianApprovals()).to.eq(REQUIRED_GUARDIAN_APPROVALS);
      await checkGuardianship(wallet, {
        guardianAddresses,
        expectedGuardianStatus: true,
      });
      await checkGuardianship(wallet, {
        guardianAddresses: [owner3.address, owner4.address],
        expectedGuardianStatus: false,
      });
    });

    it("Is reverted if it is called a second time", async () => {
      const { wallet } = await setUpFixture(deployWalletUpgradeable);
      await expect(
        wallet.initialize(ownerAddresses, REQUIRED_APPROVALS, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWith(ERROR_MESSAGE_CONTRACT_IS_ALREADY_INITIALIZED);
    });

    it("Is reverted if the input owner array is empty", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      await expect(
        uninitializedWallet.initialize([], REQUIRED_APPROVALS, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_OWNERS_ARRAY_EMPTY);
    });

    it("Is reverted if the input number of required approvals is zero", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const requiredApprovals = 0;
      await expect(
        uninitializedWallet.initialize(
          ownerAddresses,
          requiredApprovals,
          guardianAddresses,
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_REQUIRED_APPROVALS_INVALID);
    });

    it("Is reverted if required approvals exceeds the length of the owner array", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const requiredApprovals = ownerAddresses.length + 1;
      await expect(
        uninitializedWallet.initialize(
          ownerAddresses,
          requiredApprovals,
          guardianAddresses,
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_REQUIRED_APPROVALS_INVALID);
    });

    it("Is reverted if one of the input owners is the zero address", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const invalidOwnerAddresses = [ownerAddresses[0], ownerAddresses[1], ADDRESS_ZERO];
      const requiredApprovals = invalidOwnerAddresses.length - 1;
      await expect(
        uninitializedWallet.initialize(
          invalidOwnerAddresses,
          requiredApprovals,
          [ownerAddresses[0]],
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_OWNER_ADDRESS_ZERO);
    });

    it("Is reverted if there is a duplicate address in the input owner array", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const invalidOwnerAddresses = [ownerAddresses[0], ownerAddresses[1], ownerAddresses[0]];
      const requiredApprovals = ownerAddresses.length - 1;
      await expect(
        uninitializedWallet.initialize(
          invalidOwnerAddresses,
          requiredApprovals,
          [ownerAddresses[0]],
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_OWNER_ADDRESS_DUPLICATE);
    });

    it("Succeeds with empty guardian array and zero required guardian approvals (disabled guardians)", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      await uninitializedWallet.initialize(ownerAddresses, REQUIRED_APPROVALS, [], 0);

      expect(await uninitializedWallet.guardians()).to.deep.eq([]);
      expect(await uninitializedWallet.requiredGuardianApprovals()).to.eq(0);
      await checkGuardianship(uninitializedWallet, {
        guardianAddresses: ownerAddresses,
        expectedGuardianStatus: false,
      });
    });

    it("Is reverted if the input guardian array is empty but required guardian approvals is non-zero", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      await expect(
        uninitializedWallet.initialize(ownerAddresses, REQUIRED_APPROVALS, [], REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID);
    });

    it("Is reverted if required guardian approvals is zero but guardians array is not empty", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const requiredGuardianApprovals = 0;
      await expect(
        uninitializedWallet.initialize(
          ownerAddresses,
          REQUIRED_APPROVALS,
          guardianAddresses,
          requiredGuardianApprovals,
        ),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID);
    });

    it("Is reverted if required guardian approvals exceeds the guardian array length", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const requiredGuardianApprovals = guardianAddresses.length + 1;
      await expect(
        uninitializedWallet.initialize(
          ownerAddresses,
          REQUIRED_APPROVALS,
          guardianAddresses,
          requiredGuardianApprovals,
        ),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID);
    });

    it("Is reverted if a guardian is not in the owners list", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const invalidGuardianAddresses = [owner1.address, user.address];
      await expect(
        uninitializedWallet.initialize(
          ownerAddresses,
          REQUIRED_APPROVALS,
          invalidGuardianAddresses,
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_GUARDIAN_NOT_IN_OWNERS);
    });

    it("Is reverted if there is a duplicate address in the input guardian array", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const invalidGuardianAddresses = [owner1.address, owner1.address];
      await expect(
        uninitializedWallet.initialize(
          ownerAddresses,
          REQUIRED_APPROVALS,
          invalidGuardianAddresses,
          REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(uninitializedWallet, ERROR_NAME_GUARDIAN_ADDRESS_DUPLICATE);
    });

    it("Is reverted for the contract implementation if it is called even for the first time", async () => {
      const wallet = await walletUpgradeableFactory.deploy() as Contract;
      await wallet.waitForDeployment();

      await expect(
        wallet.initialize(ownerAddresses, REQUIRED_APPROVALS, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWith(ERROR_MESSAGE_CONTRACT_IS_ALREADY_INITIALIZED);
    });
  });

  describe("Scenarios with contract upgrades", () => {
    it("Upgrade is executed as expected when it is called by the wallet itself", async () => {
      const { wallet } = await setUpFixture(deployAllContracts);

      const newImplementation = await walletUpgradeableFactory.deploy([]) as Contract;
      await newImplementation.waitForDeployment();

      const oldImplementationAddress: string = await upgrades.erc1967.getImplementationAddress(getAddress(wallet));
      expect(oldImplementationAddress).not.to.be.equal(getAddress(newImplementation));

      await proveTx(connect(wallet, owner1).submitAndApprove(
        getAddress(wallet), // to
        0, // value
        encodeUpgradeFunctionData(getAddress(newImplementation)), // data
      ));
      await proveTx(connect(wallet, owner2).approveAndExecute(0));

      const newImplementationAddress: string = await upgrades.erc1967.getImplementationAddress(getAddress(wallet));
      expect(newImplementationAddress).to.be.equal(getAddress(newImplementation));
    });

    it("Upgrade is reverted if caller is not a multisig", async () => {
      const { wallet } = await setUpFixture(deployAllContracts);

      await expect(wallet.upgradeTo(getAddress(wallet)))
        .to.be.revertedWithCustomError(wallet, ERROR_NAME_CALLER_UNAUTHORIZED);
    });
  });

  describe("Function '$__VERSION()'", () => {
    it("Returns expected values", async () => {
      const { wallet } = await setUpFixture(deployWalletUpgradeable);
      const version = await wallet.$__VERSION();
      checkEquality(version, EXPECTED_VERSION);
    });
  });
});
