import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  checkEquality,
  connect,
  getAddress,
  proveTx,
  setUpFixture,
} from "@cloudwalk/brlc-test-utils";

interface Version {
  major: number;
  minor: number;
  patch: number;

  [key: string]: number; // Indexing signature to ensure that fields are iterated over in a key-value style
}

interface Tx {
  to: string;
  value: number;
  data: string;
  executed?: boolean;

  // Indexing signature to ensure that fields are iterated over in a key-value style
  [key: string]: number | string | boolean | undefined;
}

interface TestTx extends Tx {
  id: number;

  // Indexing signature to ensure that fields are iterated over in a key-value style
  [key: string]: number | string | boolean | undefined;
}

describe("MultiSigGuardianWallet contract", () => {
  const ADDRESS_ZERO = ethers.ZeroAddress;

  const REQUIRED_APPROVALS = 2;
  const REQUIRED_GUARDIAN_APPROVALS = 1;
  const ONE_DAY = 3600 * 24;
  const DEFAULT_EXPIRATION_TIME = ONE_DAY * 10;

  const ADDRESS_STUB1 = "0x0000000000000000000000000000000000000001";
  const TX_DATA_STUB1 = ethers.hexlify(ethers.toUtf8Bytes("Some data"));

  const EVENT_NAME_APPROVE = "Approve";
  const EVENT_NAME_CONFIGURE_OWNERS = "ConfigureOwners";
  const EVENT_NAME_CONFIGURE_GUARDIANS = "ConfigureGuardians";
  const EVENT_NAME_EXECUTE = "Execute";

  // Base multisig wallet errors
  const ERROR_NAME_OWNER_ADDRESS_DUPLICATE = "MultiSigWallet_OwnerAddressDuplicate";
  const ERROR_NAME_OWNERS_ARRAY_EMPTY = "MultiSigWallet_OwnersArrayEmpty";
  const ERROR_NAME_INTERNAL_TRANSACTION_FAILED = "MultiSigWallet_InternalTransactionFailed";
  const ERROR_NAME_REQUIRED_APPROVALS_INVALID = "MultiSigWallet_RequiredApprovalsInvalid";
  const ERROR_NAME_APPROVALS_INSUFFICIENT = "MultiSigWallet_ApprovalsInsufficient";
  const ERROR_NAME_CALLER_UNAUTHORIZED = "MultiSigWallet_CallerUnauthorized";
  const ERROR_NAME_OWNER_ADDRESS_ZERO = "MultiSigWallet_OwnerAddressZero";

  // Guardian-specific errors
  const ERROR_NAME_GUARDIAN_ADDRESS_DUPLICATE = "MultiSigGuardianWallet_GuardianAddressDuplicate";
  const ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID = "MultiSigGuardianWallet_RequiredGuardianApprovalsInvalid";
  const ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT = "MultiSigGuardianWallet_GuardianApprovalsInsufficient";
  const ERROR_NAME_GUARDIAN_NOT_IN_OWNERS = "MultiSigGuardianWallet_GuardianNotInOwners";

  const EXPECTED_VERSION: Version = {
    major: 1,
    minor: 2,
    patch: 0,
  };

  let walletFactory: ContractFactory;
  let walletUpgradeableFactory: ContractFactory;

  let owner1: HardhatEthersSigner;
  let owner2: HardhatEthersSigner;
  let owner3: HardhatEthersSigner;
  let owner4: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  let ownerAddresses: string[];
  let guardianAddresses: string[];

  before(async () => {
    [, owner1, owner2, owner3, owner4, user] = await ethers.getSigners();
    // 4 owners: owner1, owner2 are guardians; owner3, owner4 are regular owners
    ownerAddresses = [owner1.address, owner2.address, owner3.address, owner4.address];
    guardianAddresses = [owner1.address, owner2.address];
    walletFactory = await ethers.getContractFactory("MultiSigGuardianWallet");
    walletUpgradeableFactory = await ethers.getContractFactory("MultiSigGuardianWalletUpgradeable");
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

  function encodeConfigureOwnersFunctionData(ownerAddresses: string[], requiredApprovals: number): string {
    return walletUpgradeableFactory.interface.encodeFunctionData(
      "configureOwners",
      [ownerAddresses, requiredApprovals],
    );
  }

  function encodeConfigureGuardiansFunctionData(
    guardianAddresses: string[],
    requiredGuardianApprovals: number,
  ): string {
    return walletUpgradeableFactory.interface.encodeFunctionData(
      "configureGuardians",
      [guardianAddresses, requiredGuardianApprovals],
    );
  }

  async function deployWallet(): Promise<{ wallet: Contract }> {
    const wallet = await walletFactory.deploy(
      ownerAddresses,
      REQUIRED_APPROVALS,
      guardianAddresses,
      REQUIRED_GUARDIAN_APPROVALS,
    ) as Contract;
    await wallet.waitForDeployment();
    return {
      wallet,
    };
  }

  describe("Contract 'MultiSigGuardianWallet'", async () => {
    it("Constructor configures wallet as expected", async () => {
      const { wallet } = await setUpFixture(deployWallet);

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

    it("Deployment is reverted if the input owner array is empty", async () => {
      await expect(walletFactory.deploy([], REQUIRED_APPROVALS, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS))
        .to.be.revertedWithCustomError(walletFactory, ERROR_NAME_OWNERS_ARRAY_EMPTY);
    });

    it("Deployment is reverted if the input number of required approvals is zero", async () => {
      const requiredApprovals = 0;
      await expect(
        walletFactory.deploy(ownerAddresses, requiredApprovals, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_APPROVALS_INVALID);
    });

    it("Deployment is reverted if the number of required approvals exceeds the length of the owner array", async () => {
      const requiredApprovals = ownerAddresses.length + 1;
      await expect(
        walletFactory.deploy(ownerAddresses, requiredApprovals, guardianAddresses, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_APPROVALS_INVALID);
    });

    it("Deployment is reverted if one of the input owners is the zero address", async () => {
      const invalidOwnerAddresses = [ownerAddresses[0], ownerAddresses[1], ADDRESS_ZERO];
      const requiredApprovals = invalidOwnerAddresses.length - 1;
      await expect(
        walletFactory.deploy(
          invalidOwnerAddresses, requiredApprovals, [ownerAddresses[0]], REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_OWNER_ADDRESS_ZERO);
    });

    it("Deployment is reverted if there is a duplicate address in the input owner array", async () => {
      const invalidOwnerAddresses = [ownerAddresses[0], ownerAddresses[1], ownerAddresses[0]];
      const requiredApprovals = ownerAddresses.length - 1;
      await expect(
        walletFactory.deploy(
          invalidOwnerAddresses, requiredApprovals, [ownerAddresses[0]], REQUIRED_GUARDIAN_APPROVALS,
        ),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_OWNER_ADDRESS_DUPLICATE);
    });

    it("Deployment succeeds with empty guardian array and zero required (disabled guardians)", async () => {
      const noGuardianWallet = await walletFactory.deploy(
        ownerAddresses,
        REQUIRED_APPROVALS,
        [], // No guardians
        0, // Zero required
      ) as Contract;
      await noGuardianWallet.waitForDeployment();

      expect(await noGuardianWallet.guardians()).to.deep.eq([]);
      expect(await noGuardianWallet.requiredGuardianApprovals()).to.eq(0);
      await checkGuardianship(noGuardianWallet, {
        guardianAddresses: ownerAddresses,
        expectedGuardianStatus: false,
      });
    });

    it("Deployment is reverted if the input guardian array is empty but required is non-zero", async () => {
      await expect(walletFactory.deploy(ownerAddresses, REQUIRED_APPROVALS, [], REQUIRED_GUARDIAN_APPROVALS))
        .to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID);
    });

    it("Deployment is reverted if required guardian approvals is zero but guardians provided", async () => {
      const requiredGuardianApprovals = 0;
      await expect(
        walletFactory.deploy(ownerAddresses, REQUIRED_APPROVALS, guardianAddresses, requiredGuardianApprovals),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID);
    });

    it("Deployment is reverted if required guardian approvals exceeds the guardian array length", async () => {
      const requiredGuardianApprovals = guardianAddresses.length + 1;
      await expect(
        walletFactory.deploy(ownerAddresses, REQUIRED_APPROVALS, guardianAddresses, requiredGuardianApprovals),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID);
    });

    it("Deployment is reverted if a guardian is not in the owners list", async () => {
      const invalidGuardian = [owner1.address, user.address];
      await expect(
        walletFactory.deploy(ownerAddresses, REQUIRED_APPROVALS, invalidGuardian, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_GUARDIAN_NOT_IN_OWNERS);
    });

    it("Deployment is reverted if there is a duplicate address in the input guardian array", async () => {
      const invalidGuardian = [owner1.address, owner1.address];
      await expect(
        walletFactory.deploy(ownerAddresses, REQUIRED_APPROVALS, invalidGuardian, REQUIRED_GUARDIAN_APPROVALS),
      ).to.be.revertedWithCustomError(walletFactory, ERROR_NAME_GUARDIAN_ADDRESS_DUPLICATE);
    });
  });

  describe("Contract 'MultiSigGuardianWalletBase'", () => {
    describe("Function 'configureGuardians()'", () => {
      it("Updates list of guardians correctly", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const newGuardianAddresses = [owner2.address, owner3.address];
        const newRequiredGuardianApprovals = 2;
        const txData = encodeConfigureGuardiansFunctionData(
          newGuardianAddresses, newRequiredGuardianApprovals,
        );

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await expect(connect(wallet, owner2).approveAndExecute(0))
          .to.emit(wallet, EVENT_NAME_CONFIGURE_GUARDIANS)
          .withArgs(newGuardianAddresses, newRequiredGuardianApprovals);

        expect(await wallet.guardians()).to.deep.eq(newGuardianAddresses);
        expect(await wallet.requiredGuardianApprovals()).to.eq(newRequiredGuardianApprovals);

        await checkGuardianship(wallet, {
          guardianAddresses: newGuardianAddresses,
          expectedGuardianStatus: true,
        });
        await checkGuardianship(wallet, {
          guardianAddresses: [owner1.address, owner4.address],
          expectedGuardianStatus: false,
        });
      });

      it("Is reverted if the caller is not the multi sig wallet itself", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(wallet.configureGuardians(guardianAddresses, REQUIRED_GUARDIAN_APPROVALS))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_CALLER_UNAUTHORIZED);
      });

      it("Successfully disables guardians with empty array and zero required", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureGuardiansFunctionData([], 0);

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await expect(connect(wallet, owner2).approveAndExecute(0))
          .to.emit(wallet, EVENT_NAME_CONFIGURE_GUARDIANS)
          .withArgs([], 0);

        expect(await wallet.guardians()).to.deep.eq([]);
        expect(await wallet.requiredGuardianApprovals()).to.eq(0);
        await checkGuardianship(wallet, {
          guardianAddresses: guardianAddresses,
          expectedGuardianStatus: false,
        });
      });

      it("Is reverted if the input guardian array is empty but required is non-zero", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureGuardiansFunctionData([], REQUIRED_GUARDIAN_APPROVALS);

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await expect(connect(wallet, owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_INTERNAL_TRANSACTION_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID));
      });

      it("Is reverted if the input number of required guardian approvals is zero but guardians provided", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidGuardianApprovals = 0;
        const txData = encodeConfigureGuardiansFunctionData(guardianAddresses, invalidGuardianApprovals);

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await expect(connect(wallet, owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_INTERNAL_TRANSACTION_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID));
      });

      it("Is reverted if the number of required guardian approvals exceeds the guardian array", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidGuardianApprovals = guardianAddresses.length + 1;
        const txData = encodeConfigureGuardiansFunctionData(guardianAddresses, invalidGuardianApprovals);

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await expect(connect(wallet, owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_INTERNAL_TRANSACTION_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(ERROR_NAME_REQUIRED_GUARDIAN_APPROVALS_INVALID));
      });

      it("Is reverted if a guardian is not in the owners list", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidGuardianAddresses = [owner1.address, user.address];
        const txData = encodeConfigureGuardiansFunctionData(
          invalidGuardianAddresses, REQUIRED_GUARDIAN_APPROVALS,
        );

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await expect(connect(wallet, owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_INTERNAL_TRANSACTION_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(ERROR_NAME_GUARDIAN_NOT_IN_OWNERS));
      });

      it("Is reverted if there is a duplicate address in the input guardian array", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidGuardianAddresses = [owner1.address, owner1.address];
        const txData = encodeConfigureGuardiansFunctionData(
          invalidGuardianAddresses, REQUIRED_GUARDIAN_APPROVALS,
        );

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await expect(connect(wallet, owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_INTERNAL_TRANSACTION_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(ERROR_NAME_GUARDIAN_ADDRESS_DUPLICATE));
      });
    });

    describe("Function 'getGuardianApprovalCount()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB1,
        value: 0,
        data: TX_DATA_STUB1,
      };

      it("Returns correct count after guardian approves", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));

        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        await proveTx(connect(wallet, owner2).approve(tx.id));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(2);
      });

      it("Returns correct count when guardian approval count increments", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(connect(wallet, owner1).submit(tx.to, tx.value, tx.data));

        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);

        // owner1 is a guardian
        await proveTx(connect(wallet, owner1).approve(tx.id));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // owner2 is a guardian
        await proveTx(connect(wallet, owner2).approve(tx.id));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(2);
      });

      it("Does NOT increment when a non-guardian approves", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(connect(wallet, owner1).submit(tx.to, tx.value, tx.data));

        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);

        // owner3 is NOT a guardian
        await proveTx(connect(wallet, owner3).approve(tx.id));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);

        // owner4 is NOT a guardian
        await proveTx(connect(wallet, owner4).approve(tx.id));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
      });

      it("Decrements when a guardian revokes", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(connect(wallet, owner2).approve(tx.id));

        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(2);

        // owner1 is a guardian, revoke should decrement
        await proveTx(connect(wallet, owner1).revoke(tx.id));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // owner2 is a guardian, revoke should decrement
        await proveTx(connect(wallet, owner2).revoke(tx.id));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
      });

      it("Does NOT decrement when a non-guardian revokes", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(connect(wallet, owner3).approve(tx.id));

        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);
        expect(await wallet.getApprovalCount(tx.id)).to.eq(2);

        // owner3 is NOT a guardian, revoke should not affect guardian count
        await proveTx(connect(wallet, owner3).revoke(tx.id));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);
        expect(await wallet.getApprovalCount(tx.id)).to.eq(1);
      });

      it("Returns 0 for non-existent transaction", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // No transactions submitted yet
        expect(await wallet.getGuardianApprovalCount(0)).to.eq(0);
        expect(await wallet.getGuardianApprovalCount(999)).to.eq(0);
      });

      it("Reflects current guardians after guardian configuration change", async () => {
        // owner1, owner2 are guardians
        const { wallet } = await setUpFixture(deployWallet);

        // owner1 (guardian) approves tx #0
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // Now reconfigure guardian to remove owner1 from guardian (but keep owner2)
        const newGuardians = [owner2.address];
        const txData = encodeConfigureGuardiansFunctionData(newGuardians, 1);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await proveTx(connect(wallet, owner2).approveAndExecute(1));

        // owner1 is no longer a guardian
        expect(await wallet.isGuardian(owner1.address)).to.eq(false);
        expect(await wallet.isGuardian(owner2.address)).to.eq(true);

        // CRITICAL: The guardian approval count for tx #0 should NOW be 0
        // because owner1 is no longer a guardian (computed from current guardians)
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
      });

      it("Reflects current guardians after non-guardian becomes guardian", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // owner3 (non-guardian) approves
        await proveTx(connect(wallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);

        // Reconfigure guardian to ADD owner3 as guardian
        const newGuardians = [owner1.address, owner3.address];
        const txData = encodeConfigureGuardiansFunctionData(newGuardians, 1);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await proveTx(connect(wallet, owner2).approveAndExecute(1));

        // owner3 is now a guardian
        expect(await wallet.isGuardian(owner3.address)).to.eq(true);

        // Their approval NOW counts as a guardian approval (computed from current guardians)
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);
      });

      it("Reflects current guardians after revoke and guardian change", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // owner1 (guardian) approves
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // Reconfigure guardian to remove owner1 from guardians
        const newGuardians = [owner2.address];
        const txData = encodeConfigureGuardiansFunctionData(newGuardians, 1);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await proveTx(connect(wallet, owner2).approveAndExecute(1));

        // owner1 is no longer guardian - their approval doesn't count toward guardian anymore
        expect(await wallet.isGuardian(owner1.address)).to.eq(false);
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);

        // owner1 revokes their approval
        await proveTx(connect(wallet, owner1).revoke(tx.id));

        // Count remains 0 - owner1's approval never counted toward guardian after config change
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
      });

      it("Returns correct count in mixed guardian and non-guardian scenario", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(connect(wallet, owner1).submit(tx.to, tx.value, tx.data));

        // Initial state
        expect(await wallet.getApprovalCount(tx.id)).to.eq(0);
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);

        // owner1 (guardian) approves
        await proveTx(connect(wallet, owner1).approve(tx.id));
        expect(await wallet.getApprovalCount(tx.id)).to.eq(1);
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // owner3 (non-guardian) approves
        await proveTx(connect(wallet, owner3).approve(tx.id));
        expect(await wallet.getApprovalCount(tx.id)).to.eq(2);
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // owner4 (non-guardian) approves
        await proveTx(connect(wallet, owner4).approve(tx.id));
        expect(await wallet.getApprovalCount(tx.id)).to.eq(3);
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // owner3 (non-guardian) revokes
        await proveTx(connect(wallet, owner3).revoke(tx.id));
        expect(await wallet.getApprovalCount(tx.id)).to.eq(2);
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // owner1 (guardian) revokes
        await proveTx(connect(wallet, owner1).revoke(tx.id));
        expect(await wallet.getApprovalCount(tx.id)).to.eq(1);
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
      });
    });

    describe("Function 'guardians()'", () => {
      it("Returns correct array of guardians", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        expect(await wallet.guardians()).to.deep.eq(guardianAddresses);
      });
    });

    describe("Function 'isGuardian()'", () => {
      it("Returns correct status for guardians and non-guardians", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        expect(await wallet.isGuardian(owner1.address)).to.eq(true);
        expect(await wallet.isGuardian(owner2.address)).to.eq(true);
        expect(await wallet.isGuardian(owner3.address)).to.eq(false);
        expect(await wallet.isGuardian(owner4.address)).to.eq(false);
        expect(await wallet.isGuardian(user.address)).to.eq(false);
      });
    });

    describe("Function 'requiredGuardianApprovals()'", () => {
      it("Returns correct value", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        expect(await wallet.requiredGuardianApprovals()).to.eq(REQUIRED_GUARDIAN_APPROVALS);
      });
    });

    describe("Function 'execute()' with guardian requirements", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB1,
        value: 0,
        data: TX_DATA_STUB1,
      };

      it("Succeeds when both regular and guardian thresholds are met", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        // owner1 (guardian) approves
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        // owner3 (non-guardian) approves - total 2 approvals, 1 guardian approval
        await proveTx(connect(wallet, owner3).approve(tx.id));

        // Should succeed: 2 >= requiredApprovals(2), 1 >= requiredGuardianApprovals(1)
        await expect(connect(wallet, owner1).execute(tx.id))
          .to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);

        const actualTx = await wallet.getTransaction(tx.id);
        expect(actualTx.executed).to.eq(true);
      });

      it("Is reverted when regular threshold is met but guardian threshold is NOT met", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        // owner3 (non-guardian) submits and approves
        await proveTx(connect(wallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));
        // owner4 (non-guardian) approves - total 2 approvals, 0 guardian approvals
        await proveTx(connect(wallet, owner4).approve(tx.id));

        // Should fail: 2 >= requiredApprovals(2), but 0 < requiredGuardianApprovals(1)
        await expect(connect(wallet, owner3).execute(tx.id))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);
      });

      it("Is reverted when guardian threshold is met but regular threshold is NOT met", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        // owner1 (guardian) submits and approves - total 1 approval, 1 guardian approval
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));

        // Should fail: 1 < requiredApprovals(2), even though 1 >= requiredGuardianApprovals(1)
        await expect(connect(wallet, owner1).execute(tx.id))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_APPROVALS_INSUFFICIENT);
      });

      it("Is reverted when guardian approval from ex-guardian no longer counts", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // owner1 (guardian) approves tx #0
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));

        // Now reconfigure guardian to remove owner1 from guardian (but keep owner2)
        const newGuardians = [owner2.address];
        const txData = encodeConfigureGuardiansFunctionData(newGuardians, 1);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await proveTx(connect(wallet, owner2).approveAndExecute(1));

        // owner3 approves tx #0 - now 2 approvals, but still 0 guardian approvals
        await proveTx(connect(wallet, owner3).approve(tx.id));

        // Should fail: need guardian approval from current guardian (owner2)
        await expect(connect(wallet, owner1).execute(tx.id))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);

        // owner2 (current guardian) approves
        await proveTx(connect(wallet, owner2).approve(tx.id));

        // Now should succeed: 3 approvals >= 2 required, 1 guardian >= 1 required
        await expect(connect(wallet, owner1).execute(tx.id))
          .to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);
      });

      it("Works correctly when all owners are guardians", async () => {
        // Deploy with all owners as guardians
        const allGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          ownerAddresses, // All owners are guardians
          REQUIRED_APPROVALS, // Same threshold
        ) as Contract;
        await allGuardianWallet.waitForDeployment();

        await proveTx(connect(allGuardianWallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(connect(allGuardianWallet, owner2).approve(tx.id));

        // Both thresholds should be met
        await expect(connect(allGuardianWallet, owner1).execute(tx.id))
          .to.emit(allGuardianWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);
      });

      it("Works correctly when guardian threshold equals total guardians", async () => {
        // Deploy with required guardian = 2 (all guardians must approve)
        const strictGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          guardianAddresses,
          2, // Both guardians must approve
        ) as Contract;
        await strictGuardianWallet.waitForDeployment();

        // Only owner1 (guardian) approves
        await proveTx(connect(strictGuardianWallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(connect(strictGuardianWallet, owner3).approve(tx.id));

        // Should fail: 2 approvals but only 1 guardian approval, need 2
        await expect(connect(strictGuardianWallet, owner1).execute(tx.id))
          .to.be.revertedWithCustomError(strictGuardianWallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);

        // Now owner2 (guardian) also approves
        await proveTx(connect(strictGuardianWallet, owner2).approve(tx.id));

        // Should succeed: 3 approvals, 2 guardian approvals
        await expect(connect(strictGuardianWallet, owner1).execute(tx.id))
          .to.emit(strictGuardianWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);
      });

      it("Works correctly when all owners are guardians and all must approve (unanimous)", async () => {
        // Deploy with 4 owners, all are guardians, all must approve (4-of-4)
        const unanimousWallet = await walletFactory.deploy(
          ownerAddresses,
          4, // All 4 must approve
          ownerAddresses, // All owners are guardians
          4, // All 4 guardians must approve
        ) as Contract;
        await unanimousWallet.waitForDeployment();

        // 3 owners approve
        await proveTx(connect(unanimousWallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(connect(unanimousWallet, owner2).approve(tx.id));
        await proveTx(connect(unanimousWallet, owner3).approve(tx.id));

        // Should fail: 3 approvals but need 4
        await expect(connect(unanimousWallet, owner1).execute(tx.id))
          .to.be.revertedWithCustomError(unanimousWallet, ERROR_NAME_APPROVALS_INSUFFICIENT);

        // 4th owner approves
        await proveTx(connect(unanimousWallet, owner4).approve(tx.id));

        // Should succeed: 4 approvals, 4 guardian approvals
        await expect(connect(unanimousWallet, owner1).execute(tx.id))
          .to.emit(unanimousWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);
      });

      it("Works correctly with single guardian and single required guardian approval", async () => {
        // Deploy with single guardian
        const singleGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [owner1.address], // Only owner1 is guardian
          1,
        ) as Contract;
        await singleGuardianWallet.waitForDeployment();

        // owner3 and owner4 (non-guardian) approve
        await proveTx(connect(singleGuardianWallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(connect(singleGuardianWallet, owner4).approve(tx.id));

        // Should fail: owner1 hasn't approved
        await expect(connect(singleGuardianWallet, owner3).execute(tx.id))
          .to.be.revertedWithCustomError(singleGuardianWallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);

        // owner1 (guardian) approves
        await proveTx(connect(singleGuardianWallet, owner1).approve(tx.id));

        // Should succeed now
        await expect(connect(singleGuardianWallet, owner1).execute(tx.id))
          .to.emit(singleGuardianWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);
      });
    });

    describe("Function 'approveAndExecute()' with guardian requirements", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB1,
        value: 0,
        data: TX_DATA_STUB1,
      };

      it("Succeeds when both thresholds are met after approval", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        // owner1 (guardian) submits and approves - 1 approval, 1 guardian approval
        await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));

        // owner3 (non-guardian) approves and executes - 2 approvals, 1 guardian approval
        await expect(connect(wallet, owner3).approveAndExecute(tx.id))
          .to.emit(wallet, EVENT_NAME_APPROVE)
          .withArgs(owner3.address, tx.id)
          .and.to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner3.address, tx.id);
      });

      it("Is reverted when guardian threshold would not be met", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        // owner3 (non-guardian) submits and approves - 1 approval, 0 guardian approvals
        await proveTx(connect(wallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));

        // owner4 (non-guardian) tries to approve and execute - would be 2 approvals, 0 guardian approvals
        await expect(connect(wallet, owner4).approveAndExecute(tx.id))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);
      });

      it("Succeeds when guardian provides the final approval to meet guardian threshold", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        // owner3 (non-guardian) submits and approves - 1 approval, 0 guardian approvals
        await proveTx(connect(wallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));

        // owner1 (guardian) approves and executes - 2 approvals, 1 guardian approval
        await expect(connect(wallet, owner1).approveAndExecute(tx.id))
          .to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);
      });

      it("Succeeds when non-guardian becomes guardian and their existing approval now counts", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // owner3 (non-guardian) approves
        await proveTx(connect(wallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);

        // Reconfigure guardian to ADD owner3 as guardian
        const newGuardians = [owner1.address, owner3.address];
        const txData = encodeConfigureGuardiansFunctionData(newGuardians, 1);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await proveTx(connect(wallet, owner2).approveAndExecute(1));

        // owner3 is now a guardian, their approval NOW counts
        expect(await wallet.isGuardian(owner3.address)).to.eq(true);
        expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);

        // With owner4 approving, we now have 2 approvals and 1 guardian approval - can execute
        await proveTx(connect(wallet, owner4).approve(tx.id));
        await expect(connect(wallet, owner3).execute(tx.id))
          .to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner3.address, tx.id);
      });
    });

    describe("Function 'executeBatch()' with guardian requirements", () => {
      const txs: TestTx[] = [
        {
          id: 0,
          to: ADDRESS_STUB1,
          value: 0,
          data: TX_DATA_STUB1,
        },
        {
          id: 1,
          to: ADDRESS_STUB1,
          value: 0,
          data: TX_DATA_STUB1,
        },
      ];
      const txIds: number[] = txs.map(tx => tx.id);

      it("Succeeds when both thresholds are met for all transactions", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        for (const tx of txs) {
          await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
          await proveTx(connect(wallet, owner3).approve(tx.id));
        }

        const txResponse = connect(wallet, owner1).executeBatch(txIds);
        for (const tx of txs) {
          await expect(txResponse)
            .to.emit(wallet, EVENT_NAME_EXECUTE)
            .withArgs(owner1.address, tx.id);
        }
      });

      it("Is reverted if guardian threshold is not met for any transaction", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // First tx: guardian approves
        await proveTx(connect(wallet, owner1).submitAndApprove(txs[0].to, txs[0].value, txs[0].data));
        await proveTx(connect(wallet, owner3).approve(txs[0].id));

        // Second tx: only non-guardians approve
        await proveTx(connect(wallet, owner3).submitAndApprove(txs[1].to, txs[1].value, txs[1].data));
        await proveTx(connect(wallet, owner4).approve(txs[1].id));

        await expect(connect(wallet, owner1).executeBatch(txIds))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);
      });

      it("Works correctly in mixed batch operations with guardian and non-guardian", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Submit transactions
        for (const tx of txs) {
          await proveTx(connect(wallet, owner3).submit(tx.to, tx.value, tx.data));
        }

        // Initial state
        for (const tx of txs) {
          expect(await wallet.getApprovalCount(tx.id)).to.eq(0);
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
        }

        // owner1 (guardian) and owner3 (non-guardian) batch approve
        await proveTx(connect(wallet, owner1).approveBatch(txIds));
        await proveTx(connect(wallet, owner3).approveBatch(txIds));

        // Check counts: 2 approvals, 1 guardian approval
        for (const tx of txs) {
          expect(await wallet.getApprovalCount(tx.id)).to.eq(2);
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);
        }

        // Execute batch should succeed
        const txResponse = connect(wallet, owner1).executeBatch(txIds);
        for (const tx of txs) {
          await expect(txResponse)
            .to.emit(wallet, EVENT_NAME_EXECUTE)
            .withArgs(owner1.address, tx.id);
        }
      });
    });

    describe("Function 'approveAndExecuteBatch()' with guardian requirements", () => {
      const txs: TestTx[] = [
        {
          id: 0,
          to: ADDRESS_STUB1,
          value: 0,
          data: TX_DATA_STUB1,
        },
        {
          id: 1,
          to: ADDRESS_STUB1,
          value: 0,
          data: TX_DATA_STUB1,
        },
      ];
      const txIds: number[] = txs.map(tx => tx.id);

      it("Works correctly with guardian requirements", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        for (const tx of txs) {
          await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }

        // owner3 (non-guardian) approves and executes all
        const txResponse = connect(wallet, owner3).approveAndExecuteBatch(txIds);
        for (const tx of txs) {
          await expect(txResponse)
            .to.emit(wallet, EVENT_NAME_APPROVE)
            .withArgs(owner3.address, tx.id);
          await expect(txResponse)
            .to.emit(wallet, EVENT_NAME_EXECUTE)
            .withArgs(owner3.address, tx.id);
        }
      });

      it("Is reverted if guardian threshold is not met for any transaction", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Both txs submitted by non-guardian
        for (const tx of txs) {
          await proveTx(connect(wallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));
        }

        // owner4 (non-guardian) tries to approve and execute - 2 approvals but 0 guardian
        await expect(connect(wallet, owner4).approveAndExecuteBatch(txIds))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);
      });
    });

    describe("Function 'approveBatch()' with guardian requirements", () => {
      const txs: TestTx[] = [
        {
          id: 0,
          to: ADDRESS_STUB1,
          value: 0,
          data: TX_DATA_STUB1,
        },
        {
          id: 1,
          to: ADDRESS_STUB1,
          value: 0,
          data: TX_DATA_STUB1,
        },
      ];
      const txIds: number[] = txs.map(tx => tx.id);

      it("Increments guardian approval count correctly for each transaction", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Submit transactions
        for (const tx of txs) {
          await proveTx(connect(wallet, owner3).submit(tx.to, tx.value, tx.data));
        }

        // Initial guardian counts should be 0
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
        }

        // owner1 (guardian) batch approves
        await proveTx(connect(wallet, owner1).approveBatch(txIds));

        // Guardian counts should be 1
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);
        }

        // owner2 (guardian) batch approves
        await proveTx(connect(wallet, owner2).approveBatch(txIds));

        // Guardian counts should be 2
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(2);
        }
      });

      it("Does not increment guardian count for non-guardians", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Submit transactions
        for (const tx of txs) {
          await proveTx(connect(wallet, owner1).submit(tx.to, tx.value, tx.data));
        }

        // owner3 and owner4 (non-guardian) batch approve
        await proveTx(connect(wallet, owner3).approveBatch(txIds));
        await proveTx(connect(wallet, owner4).approveBatch(txIds));

        // Guardian counts should still be 0
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
        }
      });
    });

    describe("Function 'revokeBatch()' with guardian requirements", () => {
      const txs: TestTx[] = [
        {
          id: 0,
          to: ADDRESS_STUB1,
          value: 0,
          data: TX_DATA_STUB1,
        },
        {
          id: 1,
          to: ADDRESS_STUB1,
          value: 0,
          data: TX_DATA_STUB1,
        },
      ];
      const txIds: number[] = txs.map(tx => tx.id);

      it("Decrements guardian approval count correctly for each transaction", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Submit and approve with guardians
        for (const tx of txs) {
          await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
          await proveTx(connect(wallet, owner2).approve(tx.id));
        }

        // Guardian counts should be 2
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(2);
        }

        // owner1 (guardian) batch revokes
        await proveTx(connect(wallet, owner1).revokeBatch(txIds));

        // Guardian counts should be 1
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);
        }

        // owner2 (guardian) batch revokes
        await proveTx(connect(wallet, owner2).revokeBatch(txIds));

        // Guardian counts should be 0
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(0);
        }
      });

      it("Does not decrement guardian count for non-guardians", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Submit and approve with mixed owners
        for (const tx of txs) {
          await proveTx(connect(wallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));
          await proveTx(connect(wallet, owner3).approve(tx.id));
        }

        // Guardian counts should be 1 (only owner1 is guardian)
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);
        }

        // owner3 (non-guardian) batch revokes
        await proveTx(connect(wallet, owner3).revokeBatch(txIds));

        // Guardian counts should still be 1
        for (const tx of txs) {
          expect(await wallet.getGuardianApprovalCount(tx.id)).to.eq(1);
        }
      });
    });

    describe("Scenarios with guardian auto-cleanup", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB1,
        value: 0,
        data: TX_DATA_STUB1,
      };

      it("Guardians remain valid after configureOwners if they are still in the owners list", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        // Remove owner4, keep owner1, owner2, owner3
        const newOwnerAddresses = [owner1.address, owner2.address, owner3.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS);

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));
        await proveTx(connect(wallet, owner2).approveAndExecute(0));

        // Guardians (owner1, owner2) should still be valid
        expect(await wallet.isGuardian(owner1.address)).to.eq(true);
        expect(await wallet.isGuardian(owner2.address)).to.eq(true);
        expect(await wallet.requiredGuardianApprovals()).to.eq(REQUIRED_GUARDIAN_APPROVALS);
      });

      it("Guardian is disabled when all guardians are removed from owners", async () => {
        // Deploy with owner1 as the only guardian
        const singleGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [owner1.address],
          1,
        ) as Contract;
        await singleGuardianWallet.waitForDeployment();

        // Remove owner1 from owners
        const newOwnerAddresses = [owner2.address, owner3.address, owner4.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS);

        await proveTx(
          connect(singleGuardianWallet, owner1).submitAndApprove(getAddress(singleGuardianWallet), 0, txData),
        );

        // Execute and verify guardian is auto-cleared
        await expect(connect(singleGuardianWallet, owner2).approveAndExecute(0))
          .to.emit(singleGuardianWallet, EVENT_NAME_CONFIGURE_OWNERS)
          .withArgs(newOwnerAddresses, REQUIRED_APPROVALS)
          .and.to.emit(singleGuardianWallet, EVENT_NAME_CONFIGURE_GUARDIANS)
          .withArgs([], 0);

        // Verify guardian is disabled
        expect(await singleGuardianWallet.guardians()).to.deep.eq([]);
        expect(await singleGuardianWallet.requiredGuardianApprovals()).to.eq(0);
        expect(await singleGuardianWallet.isGuardian(owner1.address)).to.eq(false);
      });

      it("Required guardian approvals is reduced when guardians count drops below requirement", async () => {
        // Deploy with both owner1 and owner2 as guardians, requiring 2
        const strictGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [owner1.address, owner2.address],
          2, // Both must approve
        ) as Contract;
        await strictGuardianWallet.waitForDeployment();

        expect(await strictGuardianWallet.requiredGuardianApprovals()).to.eq(2);

        // Remove owner1 from owners (owner2 remains as only guardian)
        const newOwnerAddresses = [owner2.address, owner3.address, owner4.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS);

        await proveTx(
          connect(strictGuardianWallet, owner1).submitAndApprove(getAddress(strictGuardianWallet), 0, txData),
        );

        // Execute and verify guardian requirement is auto-reduced
        await expect(connect(strictGuardianWallet, owner2).approveAndExecute(0))
          .to.emit(strictGuardianWallet, EVENT_NAME_CONFIGURE_GUARDIANS)
          .withArgs([owner2.address], 1); // Reduced from 2 to 1

        // Verify guardian is adjusted
        expect(await strictGuardianWallet.guardians()).to.deep.eq([owner2.address]);
        expect(await strictGuardianWallet.requiredGuardianApprovals()).to.eq(1);
        expect(await strictGuardianWallet.isGuardian(owner1.address)).to.eq(false);
        expect(await strictGuardianWallet.isGuardian(owner2.address)).to.eq(true);
      });

      it("Pending transaction can execute after guardian is auto-disabled", async () => {
        // Deploy with owner1 as the only guardian
        const singleGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [owner1.address],
          1,
        ) as Contract;
        await singleGuardianWallet.waitForDeployment();

        // Submit a regular transaction (tx #0) - not approved by guardian
        await proveTx(connect(singleGuardianWallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(connect(singleGuardianWallet, owner4).approve(tx.id));

        // tx #0 has 2 approvals but 0 guardian approvals - cannot execute yet
        await expect(connect(singleGuardianWallet, owner3).execute(tx.id))
          .to.be.revertedWithCustomError(singleGuardianWallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);

        // Now remove owner1 from owners via tx #1
        const newOwnerAddresses = [owner2.address, owner3.address, owner4.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS);
        await proveTx(
          connect(singleGuardianWallet, owner1).submitAndApprove(getAddress(singleGuardianWallet), 0, txData),
        );
        await proveTx(connect(singleGuardianWallet, owner2).approveAndExecute(1));

        // Guardian is now disabled (requiredGuardianApprovals = 0)
        expect(await singleGuardianWallet.requiredGuardianApprovals()).to.eq(0);

        // tx #0 can now execute (0 >= 0 for guardian check)
        await expect(connect(singleGuardianWallet, owner3).execute(tx.id))
          .to.emit(singleGuardianWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner3.address, tx.id);
      });

      it("Prevents deadlock: wallet remains usable after removing only guardian", async () => {
        // This test verifies the deadlock scenario is prevented:
        // 1. Single guardian (A)
        // 2. Non-guardians (B, C) approve a transaction
        // 3. A is removed → guardian auto-disabled
        // 4. Wallet can still process transactions

        const singleGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [owner1.address], // Only owner1 is guardian
          1,
        ) as Contract;
        await singleGuardianWallet.waitForDeployment();

        // Remove owner1 via multisig
        const newOwnerAddresses = [owner2.address, owner3.address, owner4.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS);
        await proveTx(
          connect(singleGuardianWallet, owner1).submitAndApprove(getAddress(singleGuardianWallet), 0, txData),
        );
        await proveTx(connect(singleGuardianWallet, owner2).approveAndExecute(0));

        // Wallet should now be usable without guardian requirement
        await proveTx(connect(singleGuardianWallet, owner2).submitAndApprove(tx.to, tx.value, tx.data));

        // Execute with just 2 non-guardian approvals
        await expect(connect(singleGuardianWallet, owner3).approveAndExecute(1))
          .to.emit(singleGuardianWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner3.address, 1);
      });

      it("No cleanup occurs if non-guardian is removed", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Remove owner4 (non-guardian)
        const newOwnerAddresses = [owner1.address, owner2.address, owner3.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS);

        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, txData));

        // Should only emit ConfigureOwners, NOT ConfigureGuardians
        const txResponse = connect(wallet, owner2).approveAndExecute(0);
        await expect(txResponse)
          .to.emit(wallet, EVENT_NAME_CONFIGURE_OWNERS)
          .withArgs(newOwnerAddresses, REQUIRED_APPROVALS);

        // Guardian should remain unchanged
        expect(await wallet.guardians()).to.deep.eq(guardianAddresses);
        expect(await wallet.requiredGuardianApprovals()).to.eq(REQUIRED_GUARDIAN_APPROVALS);
      });

      it("Required guardian NOT reduced when remaining guardians still meet requirement", async () => {
        // Deploy with 3 guardians, requiring 2
        const threeGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [owner1.address, owner2.address, owner3.address], // 3 guardians
          2, // Only 2 required
        ) as Contract;
        await threeGuardianWallet.waitForDeployment();

        expect(await threeGuardianWallet.requiredGuardianApprovals()).to.eq(2);

        // Remove owner1 from owners entirely
        const newOwnerAddresses = [owner2.address, owner3.address, owner4.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS);

        await proveTx(
          connect(threeGuardianWallet, owner1).submitAndApprove(getAddress(threeGuardianWallet), 0, txData),
        );
        await proveTx(connect(threeGuardianWallet, owner2).approveAndExecute(0));

        // Guardians should be reduced to 2, but required should STAY at 2 (not reduced)
        expect(await threeGuardianWallet.guardians()).to.deep.eq([owner2.address, owner3.address]);
        expect(await threeGuardianWallet.requiredGuardianApprovals()).to.eq(2); // Still 2, not reduced!
      });

      it("Multiple guardians removed in single configureOwners call", async () => {
        // Deploy with 3 guardians
        const threeGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [owner1.address, owner2.address, owner3.address],
          2,
        ) as Contract;
        await threeGuardianWallet.waitForDeployment();

        // Remove owner1 and owner2 from owners (both are guardians)
        const newOwnerAddresses = [owner3.address, owner4.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS);

        await proveTx(
          connect(threeGuardianWallet, owner1).submitAndApprove(getAddress(threeGuardianWallet), 0, txData),
        );

        await expect(connect(threeGuardianWallet, owner2).approveAndExecute(0))
          .to.emit(threeGuardianWallet, EVENT_NAME_CONFIGURE_GUARDIANS)
          .withArgs([owner3.address], 1); // Only owner3 remains, required reduced to 1

        expect(await threeGuardianWallet.guardians()).to.deep.eq([owner3.address]);
        expect(await threeGuardianWallet.requiredGuardianApprovals()).to.eq(1);
        expect(await threeGuardianWallet.isGuardian(owner1.address)).to.eq(false);
        expect(await threeGuardianWallet.isGuardian(owner2.address)).to.eq(false);
        expect(await threeGuardianWallet.isGuardian(owner3.address)).to.eq(true);
      });
    });

    describe("Scenarios with zero guardians (disabled guardian requirement)", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB1,
        value: 0,
        data: TX_DATA_STUB1,
      };

      it("Wallet deployed with zero guardians allows execution without guardian approval", async () => {
        // Deploy wallet with no guardians
        const noGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [], // No guardians
          0, // Zero required
        ) as Contract;
        await noGuardianWallet.waitForDeployment();

        // Non-guardian owners can approve and execute
        await proveTx(connect(noGuardianWallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));
        await expect(connect(noGuardianWallet, owner4).approveAndExecute(tx.id))
          .to.emit(noGuardianWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner4.address, tx.id);
      });

      it("Guardians can be re-enabled after being disabled", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Step 1: Disable guardians
        const disableTxData = encodeConfigureGuardiansFunctionData([], 0);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, disableTxData));
        await proveTx(connect(wallet, owner2).approveAndExecute(0));

        expect(await wallet.guardians()).to.deep.eq([]);
        expect(await wallet.requiredGuardianApprovals()).to.eq(0);

        // Step 2: Re-enable guardians
        const newGuardians = [owner3.address, owner4.address];
        const enableTxData = encodeConfigureGuardiansFunctionData(newGuardians, 1);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, enableTxData));
        await proveTx(connect(wallet, owner2).approveAndExecute(1));

        expect(await wallet.guardians()).to.deep.eq(newGuardians);
        expect(await wallet.requiredGuardianApprovals()).to.eq(1);
        await checkGuardianship(wallet, {
          guardianAddresses: newGuardians,
          expectedGuardianStatus: true,
        });
      });

      it("After disabling guardians, execution succeeds without guardian approval", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Submit a transaction that only non-guardians approve
        await proveTx(connect(wallet, owner3).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(connect(wallet, owner4).approve(tx.id));

        // Should fail initially because guardian approval is required
        await expect(connect(wallet, owner3).execute(tx.id))
          .to.be.revertedWithCustomError(wallet, ERROR_NAME_GUARDIAN_APPROVALS_INSUFFICIENT);

        // Disable guardians via tx #1
        const disableTxData = encodeConfigureGuardiansFunctionData([], 0);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, disableTxData));
        await proveTx(connect(wallet, owner2).approveAndExecute(1));

        // Now tx #0 should execute (guardian requirement disabled)
        await expect(connect(wallet, owner3).execute(tx.id))
          .to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner3.address, tx.id);
      });

      it("getGuardianApprovalCount returns 0 when guardians are disabled", async () => {
        // Deploy with no guardians
        const noGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [],
          0,
        ) as Contract;
        await noGuardianWallet.waitForDeployment();

        await proveTx(connect(noGuardianWallet, owner1).submitAndApprove(tx.to, tx.value, tx.data));

        // Even though owner1 approved, guardian count is 0 (no guardians configured)
        expect(await noGuardianWallet.getGuardianApprovalCount(tx.id)).to.eq(0);
      });

      it("isGuardian returns false for all addresses when guardians are disabled", async () => {
        const noGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [],
          0,
        ) as Contract;
        await noGuardianWallet.waitForDeployment();

        for (const addr of ownerAddresses) {
          expect(await noGuardianWallet.isGuardian(addr)).to.eq(false);
        }
      });

      it("Batch operations work correctly with zero guardians", async () => {
        const noGuardianWallet = await walletFactory.deploy(
          ownerAddresses,
          REQUIRED_APPROVALS,
          [],
          0,
        ) as Contract;
        await noGuardianWallet.waitForDeployment();

        const txIds = [0, 1];

        // Submit multiple transactions
        await proveTx(connect(noGuardianWallet, owner3).submit(tx.to, tx.value, tx.data));
        await proveTx(connect(noGuardianWallet, owner3).submit(tx.to, tx.value, tx.data));

        // Batch approve
        await proveTx(connect(noGuardianWallet, owner3).approveBatch(txIds));
        await proveTx(connect(noGuardianWallet, owner4).approveBatch(txIds));

        // Batch execute should succeed without guardian approval
        const txResponse = connect(noGuardianWallet, owner3).executeBatch(txIds);
        await expect(txResponse)
          .to.emit(noGuardianWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner3.address, 0);
        await expect(txResponse)
          .to.emit(noGuardianWallet, EVENT_NAME_EXECUTE)
          .withArgs(owner3.address, 1);
      });

      it("Transition from guardians -> no guardians -> different guardians works correctly", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        // Initial state: owner1, owner2 are guardians
        expect(await wallet.guardians()).to.deep.eq(guardianAddresses);

        // Disable guardians
        const disableTxData = encodeConfigureGuardiansFunctionData([], 0);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, disableTxData));
        await proveTx(connect(wallet, owner2).approveAndExecute(0));

        expect(await wallet.guardians()).to.deep.eq([]);

        // Enable different guardians (owner3, owner4)
        const newGuardians = [owner3.address, owner4.address];
        const enableTxData = encodeConfigureGuardiansFunctionData(newGuardians, 2);
        await proveTx(connect(wallet, owner1).submitAndApprove(getAddress(wallet), 0, enableTxData));
        await proveTx(connect(wallet, owner2).approveAndExecute(1));

        expect(await wallet.guardians()).to.deep.eq(newGuardians);
        expect(await wallet.requiredGuardianApprovals()).to.eq(2);

        // Old guardians should not be guardians anymore
        expect(await wallet.isGuardian(owner1.address)).to.eq(false);
        expect(await wallet.isGuardian(owner2.address)).to.eq(false);

        // New guardians should be active
        expect(await wallet.isGuardian(owner3.address)).to.eq(true);
        expect(await wallet.isGuardian(owner4.address)).to.eq(true);
      });
    });
  });

  describe("Function '$__VERSION()'", () => {
    it("Returns expected values", async () => {
      const { wallet } = await setUpFixture(deployWallet);
      const version = await wallet.$__VERSION();
      checkEquality(version, EXPECTED_VERSION);
    });
  });
});
