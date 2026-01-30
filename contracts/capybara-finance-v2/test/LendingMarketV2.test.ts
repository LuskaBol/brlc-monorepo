import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  checkContractUupsUpgrading,
  checkEquality,
  checkEventSequence,
  checkTokenPath,
  getAddress,
  getBlockTimestamp,
  getNumberOfEvents,
  getTxTimestamp,
  increaseBlockTimestampTo,
  maxUintForBits,
  proveTx,
  resultToObject,
  setUpFixture,
} from "@cloudwalk/brlc-test-utils";
import * as Contracts from "../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { ContractTransactionResponse } from "ethers";
import { EXPECTED_VERSION } from "../test-utils/specific";

enum LendingProgramStatus {
  Nonexistent = 0,
  Active = 1,
  Closed = 2,
}

enum SubLoanStatus {
  Nonexistent = 0,
  Ongoing = 1,
  Repaid = 2,
  Revoked = 3,
}

enum OperationStatus {
  Nonexistent = 0,
  Pending = 1,
  Applied = 2,
  Skipped = 3,
  Dismissed = 4,
  Revoked = 5,
}

enum OperationKind {
  Nonexistent = 0,
  Repayment = 1,
  Discount = 2,
  Revocation = 3,
  Freezing = 4,
  Unfreezing = 5,
  PrimaryRateSetting = 6,
  SecondaryRateSetting = 7,
  MoratoryRateSetting = 8,
  LateFeeRateSetting = 9,
  ClawbackFeeRateSetting = 10,
  ChargeExpensesRateSetting = 11,
  DurationSetting = 12,
  PrincipalDiscount = 13,
  PrimaryInterestDiscount = 14,
  SecondaryInterestDiscount = 15,
  MoratoryInterestDiscount = 16,
  LateFeeDiscount = 17,
  ClawbackFeeDiscount = 18,
  ChargeExpensesDiscount = 19,
}

interface Fixture {
  market: Contracts.LendingMarketV2Testable;
  engine: Contracts.LendingEngineV2;
  tokenMock: Contracts.ERC20TokenMock;
  creditLineV2Mock: Contracts.CreditLineV2Mock;
  liquidityPoolMock: Contracts.LiquidityPoolMock;
  programId: number;
}

interface LoanTakingRequest {
  borrower: string;
  programId: number;
  startTimestamp: number;
}

interface SubLoanTakingRequest {
  borrowedAmount: bigint;
  addonAmount: bigint;
  duration: number;
  primaryRate: number;
  secondaryRate: number;
  moratoryRate: number;
  lateFeeRate: number;
  clawbackFeeRate: number;
  chargeExpensesRate: number;
}

interface SubLoanInception {
  borrower: string;
  programId: number;
  startTimestamp: number;
  initialDuration: number;

  borrowedAmount: bigint;
  addonAmount: bigint;
  initialPrimaryRate: number;
  initialSecondaryRate: number;
  initialMoratoryRate: number;
  initialLateFeeRate: number;
  initialClawbackFeeRate: number;
  initialChargeExpensesRate: number;

  [key: string]: bigint | number | string; // Index signature
}

interface SubLoanMetadata {
  subLoanIndex: number;
  subLoanCount: number;
  updateIndex: number;
  pendingTimestamp: number;
  operationCount: number;
  earliestOperationId: number;
  recentOperationId: number;
  latestOperationId: number;

  [key: string]: number; // Index signature
}

interface SubLoanState {
  status: SubLoanStatus;
  duration: number;
  freezeTimestamp: number;
  trackedTimestamp: number;

  primaryRate: number;
  secondaryRate: number;
  moratoryRate: number;
  lateFeeRate: number;
  clawbackFeeRate: number;
  chargeExpensesRate: number;

  trackedPrincipal: bigint;
  repaidPrincipal: bigint;
  discountPrincipal: bigint;

  trackedPrimaryInterest: bigint;
  repaidPrimaryInterest: bigint;
  discountPrimaryInterest: bigint;

  trackedSecondaryInterest: bigint;
  repaidSecondaryInterest: bigint;
  discountSecondaryInterest: bigint;

  trackedMoratoryInterest: bigint;
  repaidMoratoryInterest: bigint;
  discountMoratoryInterest: bigint;

  trackedLateFee: bigint;
  repaidLateFee: bigint;
  discountLateFee: bigint;

  trackedClawbackFee: bigint;
  repaidClawbackFee: bigint;
  discountClawbackFee: bigint;

  trackedChargeExpenses: bigint;
  repaidChargeExpenses: bigint;
  discountChargeExpenses: bigint;

  [key: string]: bigint | number; // Index signature
}

interface SubLoan {
  id: bigint;
  indexInLoan: number;
  inception: SubLoanInception;
  metadata: SubLoanMetadata;
  state: SubLoanState;
}

interface Loan {
  subLoans: SubLoan[];
  totalBorrowedAmount: bigint;
  totalAddonAmount: bigint;
}

interface SubLoanPreview {
  day: number;
  daysSinceStart: number;
  id: bigint;
  firstSubLoanId: bigint;
  subLoanCount: number;
  operationCount: number;
  earliestOperationId: number;
  recentOperationId: number;
  latestOperationId: number;
  status: SubLoanStatus;

  programId: number;
  borrower: string;
  borrowedAmount: bigint;
  addonAmount: bigint;

  startTimestamp: number;
  freezeTimestamp: number;
  trackedTimestamp: number;
  pendingTimestamp: number;
  duration: number;

  primaryRate: number;
  secondaryRate: number;
  moratoryRate: number;
  lateFeeRate: number;
  clawbackFeeRate: number;
  chargeExpensesRate: number;

  trackedPrincipal: bigint;
  repaidPrincipal: bigint;
  discountPrincipal: bigint;

  trackedPrimaryInterest: bigint;
  repaidPrimaryInterest: bigint;
  discountPrimaryInterest: bigint;

  trackedSecondaryInterest: bigint;
  repaidSecondaryInterest: bigint;
  discountSecondaryInterest: bigint;

  trackedMoratoryInterest: bigint;
  repaidMoratoryInterest: bigint;
  discountMoratoryInterest: bigint;

  trackedLateFee: bigint;
  repaidLateFee: bigint;
  discountLateFee: bigint;

  trackedClawbackFee: bigint;
  repaidClawbackFee: bigint;
  discountClawbackFee: bigint;

  trackedChargeExpenses: bigint;
  repaidChargeExpenses: bigint;
  discountChargeExpenses: bigint;

  outstandingBalance: bigint;

  [key: string]: bigint | number | string;
}

interface LoanPreview {
  day: number;
  firstSubLoanId: bigint;
  subLoanCount: number;
  ongoingSubLoanCount: number;
  overdueSubLoanCount: number;
  repaidSubLoanCount: number;
  revokedSubLoanCount: number;
  programId: number;
  borrower: string;
  totalBorrowedAmount: bigint;
  totalAddonAmount: bigint;

  totalTrackedPrincipal: bigint;
  totalRepaidPrincipal: bigint;
  totalDiscountPrincipal: bigint;

  totalTrackedPrimaryInterest: bigint;
  totalRepaidPrimaryInterest: bigint;
  totalDiscountPrimaryInterest: bigint;

  totalTrackedSecondaryInterest: bigint;
  totalRepaidSecondaryInterest: bigint;
  totalDiscountSecondaryInterest: bigint;

  totalTrackedMoratoryInterest: bigint;
  totalRepaidMoratoryInterest: bigint;
  totalDiscountMoratoryInterest: bigint;

  totalTrackedLateFee: bigint;
  totalRepaidLateFee: bigint;
  totalDiscountLateFee: bigint;

  totalTrackedChargeExpenses: bigint;
  totalRepaidChargeExpenses: bigint;
  totalDiscountChargeExpenses: bigint;

  totalOutstandingBalance: bigint;

  [key: string]: bigint | number | string;
}

interface Operation {
  subLoanId: bigint;
  id: number;
  status: OperationStatus;
  kind: OperationKind;
  nextOperationId: number;
  prevOperationId: number;
  timestamp: number;
  value: bigint;
  account: string;

  [key: string]: bigint | number | string; // Index signature
}

interface OperationView {
  status: OperationStatus;
  kind: OperationKind;
  nextOperationId: number;
  prevOperationId: number;
  timestamp: number;
  value: bigint;
  account: string;

  [key: string]: bigint | number | string; // Index signature
}

interface OperationRequest {
  subLoanId: bigint;
  kind: OperationKind;
  timestamp: number;
  value: bigint;
  account: string;

  [key: string]: bigint | number | string; // Index signature
}

const ADDRESS_ZERO = ethers.ZeroAddress;
const INTEREST_RATE_FACTOR = 10 ** 9;
const ACCURACY_FACTOR = 10_000n;
const SUB_LOAN_COUNT_MAX = 180;
const OPERATION_COUNT_MAX = 10_000;
const DAY_BOUNDARY_OFFSET = -3 * 3600;
const DAY_IN_SECONDS = 86400;
const SUB_LOAN_AUTO_ID_START = 10_000_000n;
const TOKEN_DECIMALS = 6n;
const INITIAL_BALANCE = 1_000_000n * 10n ** TOKEN_DECIMALS;
const UP_TO_DUE_REMUNERATORY_RATE = (INTEREST_RATE_FACTOR / 1000); // 0.1%
const POST_DUE_REMUNERATORY_RATE = (INTEREST_RATE_FACTOR / 1000) * 2; // 0.2%
const MORATORY_RATE = (INTEREST_RATE_FACTOR / 1000) * 3; // 0.3%
const LATE_FEE_RATE = (INTEREST_RATE_FACTOR / 1000) * 4; // 0.4%
const CLAWBACK_FEE_RATE = (INTEREST_RATE_FACTOR / 1000) * 5; // 0.5%
const CHARGE_EXPENSES_RATE = (INTEREST_RATE_FACTOR / 1000) * 6; // 0.6%
const MAX_UINT8 = maxUintForBits(8);
const MAX_UINT16 = maxUintForBits(16);
const MAX_UINT16_NUMBER = Number(MAX_UINT16);
const MAX_UINT32 = maxUintForBits(32);
const MAX_UINT64 = maxUintForBits(64);
const TIMESTAMP_SPECIAL_VALUE_TRACKED = 1n;
const SUB_LOAN_DURATION = 30; // TODO: make it less
// const ACCOUNT_ID_BORROWER = maxUintForBits(16);

const MARKET_DEPLOYMENT_OPTIONS: DeployProxyOptions = { kind: "uups", unsafeAllow: ["delegatecall"] };

const OWNER_ROLE = ethers.id("OWNER_ROLE");
const GRANTOR_ROLE = ethers.id("GRANTOR_ROLE");
const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
const PAUSER_ROLE = ethers.id("PAUSER_ROLE");

// Events of the library contracts and mock contracts
const EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED = "AddressBookAccountAdded";
const EVENT_NAME_MOCK_LOAN_CLOSED = "MockLoanClosed";
const EVENT_NAME_MOCK_LOAN_OPENED = "MockLoanOpened";
const EVENT_NAME_MOCK_LIQUIDITY_IN = "MockLiquidityIn";
const EVENT_NAME_MOCK_LIQUIDITY_OUT = "MockLiquidityOut";
const EVENT_NAME_TRANSFER = "Transfer";

// Events of the contracts under test
const EVENT_NAME_PROGRAM_OPENED = "ProgramOpened";
const EVENT_NAME_PROGRAM_CLOSED = "ProgramClosed";
const EVENT_NAME_LOAN_TAKEN = "LoanTaken";
const EVENT_NAME_LOAN_REVOKED = "LoanRevoked";
const EVENT_NAME_SUB_LOAN_TAKEN = "SubLoanTaken";
const EVENT_NAME_SUB_LOAN_UPDATED = "SubLoanUpdated";
const EVENT_NAME_OPERATION_APPLIED = "OperationApplied";
const EVENT_NAME_OPERATION_PENDED = "OperationPended";
const EVENT_NAME_OPERATION_REVOKED = "OperationRevoked";
const EVENT_NAME_OPERATION_DISMISSED = "OperationDismissed";

// Errors of the library contracts
const ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT = "AccessControlUnauthorizedAccount";
const ERROR_NAME_ENFORCED_PAUSED = "EnforcedPause";
const ERROR_NAME_INVALID_INITIALIZATION = "InvalidInitialization";

// Errors of the contracts under test
const ERROR_NAME_BLOCK_TIMESTAMP_EXCESS = "LendingMarketV2_BlockTimestampExcess";
const ERROR_NAME_BORROWER_ADDRESS_ZERO = "LendingMarketV2_BorrowerAddressZero";
const ERROR_NAME_CALL_CONTEXT_UNAUTHORIZED = "LendingMarketV2_CallContextUnauthorized";
const ERROR_NAME_CREDIT_LINE_ADDRESS_INVALID = "LendingMarketV2_CreditLineAddressInvalid";
const ERROR_NAME_CREDIT_LINE_ADDRESS_ZERO = "LendingMarketV2_CreditLineAddressZero";
const ERROR_NAME_ENGINE_ADDRESS_ZERO = "LendingMarketV2_EngineAddressZero";
const ERROR_NAME_IMPLEMENTATION_ADDRESS_INVALID = "LendingMarketV2_ImplementationAddressInvalid";
const ERROR_NAME_LIQUIDITY_POOL_ADDRESS_INVALID = "LendingMarketV2_LiquidityPoolAddressInvalid";
const ERROR_NAME_LIQUIDITY_POOL_ADDRESS_ZERO = "LendingMarketV2_LiquidityPoolAddressZero";
const ERROR_NAME_LOAN_BORROWED_AMOUNT_INVALID = "LendingMarketV2_LoanBorrowedAmountInvalid";
const ERROR_NAME_LOAN_DURATIONS_INVALID = "LendingMarketV2_LoanDurationsInvalid";
const ERROR_NAME_LOAN_START_TIMESTAMP_INVALID = "LendingMarketV2_LoanStartTimestampInvalid";
const ERROR_NAME_OPERATION_ACCOUNT_NONZERO = "LendingMarketV2_OperationAccountNonzero";
const ERROR_NAME_OPERATION_APPLYING_TIMESTAMP_TOO_EARLY = "LendingMarketV2_OperationApplyingTimestampTooEarly";
const ERROR_NAME_OPERATION_DISMISSED_ALREADY = "LendingMarketV2_OperationDismissedAlready";
const ERROR_NAME_OPERATION_KIND_INVALID = "LendingMarketV2_OperationKindInvalid";
const ERROR_NAME_OPERATION_KIND_PROHIBITED_IN_FUTURE = "LendingMarketV2_OperationKindProhibitedInFuture";
const ERROR_NAME_OPERATION_KIND_UNACCEPTABLE = "LendingMarketV2_OperationKindUnacceptable";
const ERROR_NAME_OPERATION_NONEXISTENT = "LendingMarketV2_OperationNonexistent";
const ERROR_NAME_OPERATION_REVOKED_ALREADY = "LendingMarketV2_OperationRevokedAlready";
const ERROR_NAME_OPERATION_TIMESTAMP_EXCESS = "LendingMarketV2_OperationTimestampExcess";
const ERROR_NAME_OPERATION_TIMESTAMP_TOO_EARLY = "LendingMarketV2_OperationTimestampTooEarly";
const ERROR_NAME_OPERATION_VALUE_EXCESS = "LendingMarketV2_OperationValueExcess";
const ERROR_NAME_OPERATION_VALUE_NONZERO = "LendingMarketV2_OperationValueNonzero";
const ERROR_NAME_PROGRAM_STATUS_INCOMPATIBLE = "LendingMarketV2_ProgramStatusIncompatible";
const ERROR_NAME_SUB_LOAN_BORROWED_AMOUNT_INVALID = "LendingMarketV2_SubLoanBorrowedAmountInvalid";
const ERROR_NAME_SUB_LOAN_COUNT_ZERO = "LendingMarketV2_SubLoanCountZero";
const ERROR_NAME_SUB_LOAN_DISCOUNT_EXCESS = "LendingMarketV2_SubLoanDiscountExcess";
const ERROR_NAME_SUB_LOAN_DISCOUNT_PART_EXCESS = "LendingMarketV2_SubLoanDiscountPartExcess";
const ERROR_NAME_SUB_LOAN_DURATION_EXCESS = "LendingMarketV2_SubLoanDurationExcess";
const ERROR_NAME_SUB_LOAN_DURATION_INVALID = "LendingMarketV2_SubLoanDurationInvalid";
const ERROR_NAME_SUB_LOAN_EXISTENT_ALREADY = "LendingMarketV2_SubLoanExistentAlready";
const ERROR_NAME_SUB_LOAN_FROZEN_ALREADY = "LendingMarketV2_SubLoanFrozenAlready";
const ERROR_NAME_SUB_LOAN_NONEXISTENT = "LendingMarketV2_SubLoanNonexistent";
const ERROR_NAME_SUB_LOAN_NOT_FROZEN = "LendingMarketV2_SubLoanNotFrozen";
const ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS = "LendingMarketV2_SubLoanRateValueExcess";
const ERROR_NAME_SUB_LOAN_REPAYER_ADDRESS_ZERO = "LendingMarketV2_SubLoanRepayerAddressZero";
const ERROR_NAME_SUB_LOAN_REPAYMENT_EXCESS = "LendingMarketV2_SubLoanRepaymentExcess";
const ERROR_NAME_SUB_LOAN_REPAYMENT_OR_DISCOUNT_AMOUNT_UNROUNDED =
  "LendingMarketV2_SubLoanRepaymentOrDiscountAmountUnrounded";
const ERROR_NAME_SUB_LOAN_REPAYMENT_OR_DISCOUNT_AMOUNT_ZERO = "LendingMarketV2_SubLoanRepaymentOrDiscountAmountZero";
const ERROR_NAME_SUB_LOAN_REVOKED = "LendingMarketV2_SubLoanRevoked";
const ERROR_NAME_UNDERLYING_TOKEN_ADDRESS_ZERO = "LendingMarketV2_UnderlyingTokenAddressZero";

// Errors of the mock contracts
const ERROR_NAME_CREDIT_LINE_ON_AFTER_LOAN_CLOSED_REVERTED = "CreditLineV2Mock_OnAfterLoanClosedReverted";
const ERROR_NAME_CREDIT_LINE_ON_BEFORE_LOAN_OPENED_REVERTED = "CreditLineV2Mock_OnBeforeLoanOpenedReverted";
const ERROR_NAME_LIQUIDITY_POOL_ON_BEFORE_LIQUIDITY_IN_REVERTED = "LiquidityPoolMock_OnBeforeLiquidityInReverted";
const ERROR_NAME_LIQUIDITY_POOL_ON_BEFORE_LIQUIDITY_OUT_REVERTED = "LiquidityPoolMock_OnBeforeLiquidityOutReverted";

const defaultOperationRequest: OperationRequest = {
  subLoanId: 0n,
  kind: OperationKind.Revocation,
  timestamp: 0,
  value: 0n,
  account: ADDRESS_ZERO,
};

let lendingMarketFactory: Contracts.LendingMarketV2Testable__factory;
let lendingEngineFactory: Contracts.LendingEngineV2__factory;
let tokenMockFactory: Contracts.ERC20TokenMock__factory;
let creditLineV2MockFactory: Contracts.CreditLineV2Mock__factory;
let liquidityPoolMockFactory: Contracts.LiquidityPoolMock__factory;

let deployer: HardhatEthersSigner;
let pauser: HardhatEthersSigner;
let addonTreasury: HardhatEthersSigner;
let admin: HardhatEthersSigner;
let borrower: HardhatEthersSigner;
let repayer: HardhatEthersSigner;
let counterparty: HardhatEthersSigner;
let stranger: HardhatEthersSigner;

async function deployCreditLineV2Mock(): Promise<Contracts.CreditLineV2Mock> {
  const creditLineV2MockDeployment = await creditLineV2MockFactory.deploy();
  await creditLineV2MockDeployment.waitForDeployment();
  return creditLineV2MockDeployment.connect(deployer);
}

async function deployLiquidityPoolMock(): Promise<Contracts.LiquidityPoolMock> {
  const liquidityPoolMockDeployment = await liquidityPoolMockFactory.deploy();
  await liquidityPoolMockDeployment.waitForDeployment();
  return liquidityPoolMockDeployment.connect(deployer);
}

async function deployContracts(): Promise<Fixture> {
  const tokenMockDeployment = await tokenMockFactory.deploy();
  await tokenMockDeployment.waitForDeployment();
  const tokenMock = tokenMockDeployment.connect(deployer);

  const lendingEngineDeployment = await upgrades.deployProxy(
    lendingEngineFactory,
    [],
    { kind: "uups" },
  );
  await lendingEngineDeployment.waitForDeployment();
  const engine = lendingEngineDeployment.connect(deployer);

  const lendingMarketDeployment = await upgrades.deployProxy(
    lendingMarketFactory,
    [getAddress(tokenMock), getAddress(engine)],
    MARKET_DEPLOYMENT_OPTIONS,
  );
  await lendingMarketDeployment.waitForDeployment();
  const market = lendingMarketDeployment.connect(deployer);

  const creditLineV2Mock = await deployCreditLineV2Mock();
  const liquidityPoolMock = await deployLiquidityPoolMock();

  return { market, engine, tokenMock, creditLineV2Mock, liquidityPoolMock, programId: 0 };
}

async function configureLendingMarket(market: Contracts.LendingMarketV2Testable) {
  await proveTx(market.grantRole(GRANTOR_ROLE, deployer.address));
  await proveTx(market.grantRole(ADMIN_ROLE, admin.address));
  await proveTx(market.grantRole(PAUSER_ROLE, pauser.address));
}

async function deployAndConfigureContracts(): Promise<Fixture> {
  const fixture = await deployContracts();
  await configureLendingMarket(fixture.market);
  return fixture;
}

async function configureLoanTaking(fixture: Fixture) {
  const { market, tokenMock, creditLineV2Mock, liquidityPoolMock } = fixture;
  await proveTx(market.openProgram(creditLineV2Mock, liquidityPoolMock));
  fixture.programId = Number(await market.programCounter());
  await proveTx(liquidityPoolMock.setAddonTreasury(addonTreasury.address));
  await proveTx(tokenMock.mint(getAddress(liquidityPoolMock), INITIAL_BALANCE));
  await proveTx(tokenMock.mint(borrower.address, INITIAL_BALANCE));
  await proveTx(tokenMock.mint(repayer.address, INITIAL_BALANCE));
  await proveTx(tokenMock.mint(counterparty.address, INITIAL_BALANCE));
  await proveTx(tokenMock.mint(stranger.address, INITIAL_BALANCE));
  await proveTx(liquidityPoolMock.approveToken(getAddress(tokenMock), getAddress(market), ethers.MaxUint256));

  // For possible revocation and repayments
  await proveTx(tokenMock.connect(borrower).approve(getAddress(market), ethers.MaxUint256));
  await proveTx(tokenMock.connect(repayer).approve(getAddress(market), ethers.MaxUint256));
  await proveTx(tokenMock.connect(addonTreasury).approve(getAddress(market), ethers.MaxUint256));
}

async function deployAndConfigureContractsForLoanTaking(): Promise<Fixture> {
  const fixture = await deployAndConfigureContracts();
  await configureLoanTaking(fixture);
  return fixture;
}

function packAmountParts(onePartBitShift: bigint, ...parts: bigint[]): bigint {
  return parts.reduce((acc, part, index) => acc + ((part & MAX_UINT64) << (onePartBitShift * BigInt(index))), 0n);
}

function packRates(subLoan: SubLoan): bigint {
  return packAmountParts(
    32n,
    BigInt(subLoan.state.primaryRate),
    BigInt(subLoan.state.secondaryRate),
    BigInt(subLoan.state.moratoryRate),
    BigInt(subLoan.state.lateFeeRate),
    BigInt(subLoan.state.clawbackFeeRate),
    BigInt(subLoan.state.chargeExpensesRate),
  );
}

function packSubLoanParameters(subLoan: SubLoan): bigint {
  let daysSinceStart = dayIndex(subLoan.state.trackedTimestamp) - dayIndex(subLoan.inception.startTimestamp);
  if (daysSinceStart > MAX_UINT16_NUMBER) {
    daysSinceStart = MAX_UINT16_NUMBER;
  }
  return (
    ((BigInt(subLoan.state.status) & MAX_UINT8) << 0n) +
    ((0n & MAX_UINT8) << 8n) +
    ((BigInt(subLoan.state.duration) & MAX_UINT16) << 16n) +
    ((BigInt(subLoan.inception.startTimestamp) & MAX_UINT32) << 32n) +
    ((BigInt(subLoan.state.trackedTimestamp) & MAX_UINT32) << 64n) +
    ((BigInt(subLoan.state.freezeTimestamp) & MAX_UINT32) << 96n) +
    ((BigInt(subLoan.metadata.pendingTimestamp ?? 0) & MAX_UINT32) << 128n) +
    ((BigInt(subLoan.metadata.operationCount) & MAX_UINT16) << 160n) +
    ((BigInt(subLoan.metadata.earliestOperationId) & MAX_UINT16) << 176n) +
    ((BigInt(subLoan.metadata.recentOperationId) & MAX_UINT16) << 192n) +
    ((BigInt(subLoan.metadata.latestOperationId) & MAX_UINT16) << 208n) +
    ((BigInt(daysSinceStart) & MAX_UINT16) << 224n)
  );
}

function packSubLoanPrincipalParts(subLoan: SubLoan): bigint {
  return packAmountParts(
    64n,
    subLoan.state.trackedPrincipal,
    subLoan.state.repaidPrincipal,
    subLoan.state.discountPrincipal,
  );
}

function packSubLoanPrimaryInterestParts(subLoan: SubLoan): bigint {
  return packAmountParts(
    64n,
    subLoan.state.trackedPrimaryInterest,
    subLoan.state.repaidPrimaryInterest,
    subLoan.state.discountPrimaryInterest,
  );
}

function packSubLoanSecondaryInterestParts(subLoan: SubLoan): bigint {
  return packAmountParts(
    64n,
    subLoan.state.trackedSecondaryInterest,
    subLoan.state.repaidSecondaryInterest,
    subLoan.state.discountSecondaryInterest,
  );
}

function packSubLoanMoratoryInterestParts(subLoan: SubLoan): bigint {
  return packAmountParts(
    64n,
    subLoan.state.trackedMoratoryInterest,
    subLoan.state.repaidMoratoryInterest,
    subLoan.state.discountMoratoryInterest,
  );
}

function packSubLoanLateFeeParts(subLoan: SubLoan): bigint {
  return packAmountParts(
    64n,
    subLoan.state.trackedLateFee,
    subLoan.state.repaidLateFee,
    subLoan.state.discountLateFee,
  );
}

function packSubLoanClawbackFeeParts(subLoan: SubLoan): bigint {
  return packAmountParts(
    64n,
    subLoan.state.trackedClawbackFee,
    subLoan.state.repaidClawbackFee,
    subLoan.state.discountClawbackFee,
  );
}

function packSubLoanChargeExpensesParts(subLoan: SubLoan): bigint {
  return packAmountParts(
    64n,
    subLoan.state.trackedChargeExpenses,
    subLoan.state.repaidChargeExpenses,
    subLoan.state.discountChargeExpenses,
  );
}

function toBytes32(value: bigint): string {
  return ethers.toBeHex(value, 32);
}

function defineInitialSubLoan(
  firstSubLoanId: bigint,
  loanTakingRequest: LoanTakingRequest,
  subLoanTakingRequests: SubLoanTakingRequest[],
  subLoanIndex: number,
  startTimestamp: number,
): SubLoan {
  const id = firstSubLoanId + BigInt(subLoanIndex);
  const subLoanTakingRequest = subLoanTakingRequests[subLoanIndex];
  const inception: SubLoanInception = {
    borrowedAmount: subLoanTakingRequest.borrowedAmount,
    addonAmount: subLoanTakingRequest.addonAmount,
    initialPrimaryRate: subLoanTakingRequest.primaryRate,
    initialSecondaryRate: subLoanTakingRequest.secondaryRate,
    initialMoratoryRate: subLoanTakingRequest.moratoryRate,
    initialLateFeeRate: subLoanTakingRequest.lateFeeRate,
    initialClawbackFeeRate: subLoanTakingRequest.clawbackFeeRate,
    initialChargeExpensesRate: subLoanTakingRequest.chargeExpensesRate,

    initialDuration: subLoanTakingRequest.duration,
    startTimestamp: startTimestamp,
    programId: loanTakingRequest.programId,
    borrower: loanTakingRequest.borrower,
  };
  const metadata: SubLoanMetadata = {
    subLoanIndex: subLoanIndex,
    subLoanCount: subLoanTakingRequests.length,
    updateIndex: 0,
    pendingTimestamp: 0,
    operationCount: 0,
    earliestOperationId: 0,
    recentOperationId: 0,
    latestOperationId: 0,
  };
  const state: SubLoanState = {
    status: SubLoanStatus.Ongoing,
    duration: subLoanTakingRequest.duration,
    freezeTimestamp: 0,
    trackedTimestamp: startTimestamp,
    primaryRate: inception.initialPrimaryRate,
    secondaryRate: inception.initialSecondaryRate,
    moratoryRate: inception.initialMoratoryRate,
    lateFeeRate: inception.initialLateFeeRate,
    clawbackFeeRate: inception.initialClawbackFeeRate,
    chargeExpensesRate: inception.initialChargeExpensesRate,

    trackedPrincipal: inception.borrowedAmount + inception.addonAmount,
    repaidPrincipal: 0n,
    discountPrincipal: 0n,

    trackedPrimaryInterest: 0n,
    repaidPrimaryInterest: 0n,
    discountPrimaryInterest: 0n,

    trackedSecondaryInterest: 0n,
    repaidSecondaryInterest: 0n,
    discountSecondaryInterest: 0n,

    trackedMoratoryInterest: 0n,
    repaidMoratoryInterest: 0n,
    discountMoratoryInterest: 0n,

    trackedLateFee: 0n,
    repaidLateFee: 0n,
    discountLateFee: 0n,

    trackedClawbackFee: 0n,
    repaidClawbackFee: 0n,
    discountClawbackFee: 0n,

    trackedChargeExpenses: 0n,
    repaidChargeExpenses: 0n,
    discountChargeExpenses: 0n,
  };

  return { id, indexInLoan: subLoanIndex, inception, metadata, state };
}

function defineInitialLoan(
  loanTakingRequest: LoanTakingRequest,
  subLoanTakingRequests: SubLoanTakingRequest[],
  txTimestamp: number,
  firstSubLoanId: bigint,
): Loan {
  const loan: Loan = { subLoans: [], totalBorrowedAmount: 0n, totalAddonAmount: 0n };
  const startTimestamp = loanTakingRequest.startTimestamp === 0
    ? txTimestamp
    : loanTakingRequest.startTimestamp;
  for (let i = 0; i < subLoanTakingRequests.length; ++i) {
    loan.subLoans.push(
      defineInitialSubLoan(firstSubLoanId, loanTakingRequest, subLoanTakingRequests, i, startTimestamp),
    );
  }
  loan.totalBorrowedAmount = loan.subLoans.reduce(
    (sum, subLoan) => sum + subLoan.inception.borrowedAmount,
    0n,
  );
  loan.totalAddonAmount = loan.subLoans.reduce(
    (sum, subLoan) => sum + subLoan.inception.addonAmount,
    0n,
  );
  return loan;
}

function calculateOutstandingBalance(subLoan: SubLoan): bigint {
  return roundFinancially(
    subLoan.state.trackedPrincipal +
    subLoan.state.trackedPrimaryInterest +
    subLoan.state.trackedSecondaryInterest +
    subLoan.state.trackedMoratoryInterest +
    subLoan.state.trackedLateFee +
    subLoan.state.trackedClawbackFee +
    subLoan.state.trackedChargeExpenses,
  );
}

function defineExpectedSubLoanPreview(subLoan: SubLoan): SubLoanPreview {
  const firstSubLoanId = subLoan.id - BigInt(subLoan.metadata.subLoanIndex);
  const day = dayIndex(subLoan.state.trackedTimestamp);
  const startDay = dayIndex(subLoan.inception.startTimestamp);

  return {
    day,
    daysSinceStart: day >= startDay ? day - startDay : 0,
    id: subLoan.id,
    firstSubLoanId,
    subLoanCount: subLoan.metadata.subLoanCount,
    operationCount: subLoan.metadata.operationCount,
    earliestOperationId: subLoan.metadata.earliestOperationId,
    recentOperationId: subLoan.metadata.recentOperationId,
    latestOperationId: subLoan.metadata.latestOperationId,
    status: subLoan.state.status,

    programId: subLoan.inception.programId,
    borrower: subLoan.inception.borrower,
    borrowedAmount: subLoan.inception.borrowedAmount,
    addonAmount: subLoan.inception.addonAmount,

    startTimestamp: subLoan.inception.startTimestamp,
    freezeTimestamp: subLoan.state.freezeTimestamp,
    trackedTimestamp: subLoan.state.trackedTimestamp,
    pendingTimestamp: subLoan.metadata.pendingTimestamp,
    duration: subLoan.state.duration,

    primaryRate: subLoan.state.primaryRate,
    secondaryRate: subLoan.state.secondaryRate,
    moratoryRate: subLoan.state.moratoryRate,
    lateFeeRate: subLoan.state.lateFeeRate,
    clawbackFeeRate: subLoan.state.clawbackFeeRate,
    chargeExpensesRate: subLoan.state.chargeExpensesRate,

    trackedPrincipal: subLoan.state.trackedPrincipal,
    repaidPrincipal: subLoan.state.repaidPrincipal,
    discountPrincipal: subLoan.state.discountPrincipal,

    trackedPrimaryInterest: subLoan.state.trackedPrimaryInterest,
    repaidPrimaryInterest: subLoan.state.repaidPrimaryInterest,
    discountPrimaryInterest: subLoan.state.discountPrimaryInterest,

    trackedSecondaryInterest: subLoan.state.trackedSecondaryInterest,
    repaidSecondaryInterest: subLoan.state.repaidSecondaryInterest,
    discountSecondaryInterest: subLoan.state.discountSecondaryInterest,

    trackedMoratoryInterest: subLoan.state.trackedMoratoryInterest,
    repaidMoratoryInterest: subLoan.state.repaidMoratoryInterest,
    discountMoratoryInterest: subLoan.state.discountMoratoryInterest,

    trackedLateFee: subLoan.state.trackedLateFee,
    repaidLateFee: subLoan.state.repaidLateFee,
    discountLateFee: subLoan.state.discountLateFee,

    trackedClawbackFee: subLoan.state.trackedClawbackFee,
    repaidClawbackFee: subLoan.state.repaidClawbackFee,
    discountClawbackFee: subLoan.state.discountClawbackFee,

    trackedChargeExpenses: subLoan.state.trackedChargeExpenses,
    repaidChargeExpenses: subLoan.state.repaidChargeExpenses,
    discountChargeExpenses: subLoan.state.discountChargeExpenses,

    outstandingBalance: calculateOutstandingBalance(subLoan),
  };
}

function defineExpectedLoanPreview(loan: Loan): LoanPreview {
  const firstSubLoan = loan.subLoans[0];
  const firstSubLoanId = firstSubLoan.id - BigInt(firstSubLoan.metadata.subLoanIndex);
  const subLoanCount = firstSubLoan.metadata.subLoanCount;

  let ongoingSubLoanCount = 0;
  let overdueSubLoanCount = 0;
  let repaidSubLoanCount = 0;
  let revokedSubLoanCount = 0;

  let totalBorrowedAmount = 0n;
  let totalAddonAmount = 0n;

  let totalTrackedPrincipal = 0n;
  let totalRepaidPrincipal = 0n;
  let totalDiscountPrincipal = 0n;

  let totalTrackedPrimaryInterest = 0n;
  let totalRepaidPrimaryInterest = 0n;
  let totalDiscountPrimaryInterest = 0n;

  let totalTrackedSecondaryInterest = 0n;
  let totalRepaidSecondaryInterest = 0n;
  let totalDiscountSecondaryInterest = 0n;

  let totalTrackedMoratoryInterest = 0n;
  let totalRepaidMoratoryInterest = 0n;
  let totalDiscountMoratoryInterest = 0n;

  let totalTrackedLateFee = 0n;
  let totalRepaidLateFee = 0n;
  let totalDiscountLateFee = 0n;

  let totalTrackedChargeExpenses = 0n;
  let totalRepaidChargeExpenses = 0n;
  let totalDiscountChargeExpenses = 0n;

  let totalOutstandingBalance = 0n;

  for (const subLoan of loan.subLoans) {
    const preview = defineExpectedSubLoanPreview(subLoan);
    if (preview.status === SubLoanStatus.Ongoing) {
      ongoingSubLoanCount += 1;
      if (isOverdue(subLoan, subLoan.state.trackedTimestamp)) {
        overdueSubLoanCount += 1;
      }
    } else if (preview.status === SubLoanStatus.Repaid) {
      repaidSubLoanCount += 1;
    } else if (preview.status === SubLoanStatus.Revoked) {
      revokedSubLoanCount += 1;
    }

    totalBorrowedAmount += preview.borrowedAmount;
    totalAddonAmount += preview.addonAmount;

    totalTrackedPrincipal += preview.trackedPrincipal;
    totalRepaidPrincipal += preview.repaidPrincipal;
    totalDiscountPrincipal += preview.discountPrincipal;

    totalTrackedPrimaryInterest += preview.trackedPrimaryInterest;
    totalRepaidPrimaryInterest += preview.repaidPrimaryInterest;
    totalDiscountPrimaryInterest += preview.discountPrimaryInterest;

    totalTrackedSecondaryInterest += preview.trackedSecondaryInterest;
    totalRepaidSecondaryInterest += preview.repaidSecondaryInterest;
    totalDiscountSecondaryInterest += preview.discountSecondaryInterest;

    totalTrackedMoratoryInterest += preview.trackedMoratoryInterest;
    totalRepaidMoratoryInterest += preview.repaidMoratoryInterest;
    totalDiscountMoratoryInterest += preview.discountMoratoryInterest;

    totalTrackedLateFee += preview.trackedLateFee;
    totalRepaidLateFee += preview.repaidLateFee;
    totalDiscountLateFee += preview.discountLateFee;

    totalTrackedChargeExpenses += preview.trackedChargeExpenses;
    totalRepaidChargeExpenses += preview.repaidChargeExpenses;
    totalDiscountChargeExpenses += preview.discountChargeExpenses;

    totalOutstandingBalance += preview.outstandingBalance;
  }

  const lastSubLoan = loan.subLoans[loan.subLoans.length - 1];

  return {
    day: dayIndex(lastSubLoan.state.trackedTimestamp),
    firstSubLoanId,
    subLoanCount,
    ongoingSubLoanCount,
    overdueSubLoanCount,
    repaidSubLoanCount,
    revokedSubLoanCount,
    programId: lastSubLoan.inception.programId,
    borrower: lastSubLoan.inception.borrower,
    totalBorrowedAmount,
    totalAddonAmount,

    totalTrackedPrincipal,
    totalRepaidPrincipal,
    totalDiscountPrincipal,

    totalTrackedPrimaryInterest,
    totalRepaidPrimaryInterest,
    totalDiscountPrimaryInterest,

    totalTrackedSecondaryInterest,
    totalRepaidSecondaryInterest,
    totalDiscountSecondaryInterest,

    totalTrackedMoratoryInterest,
    totalRepaidMoratoryInterest,
    totalDiscountMoratoryInterest,

    totalTrackedLateFee,
    totalRepaidLateFee,
    totalDiscountLateFee,

    totalTrackedChargeExpenses,
    totalRepaidChargeExpenses,
    totalDiscountChargeExpenses,

    totalOutstandingBalance,
  };
}

async function checkSubLoanInContract(
  market: Contracts.LendingMarketV2Testable,
  expectedSubLoan: SubLoan,
) {
  const subLoanId = expectedSubLoan.id;
  const inception = await market.getSubLoanInception(subLoanId);
  const metadata = await market.getSubLoanMetadata(subLoanId);
  const state = await market.getSubLoanState(subLoanId);
  const preview = await market.getSubLoanPreview(
    subLoanId,
    TIMESTAMP_SPECIAL_VALUE_TRACKED,
  );
  checkEquality(
    resultToObject(inception),
    expectedSubLoan.inception,
    expectedSubLoan.indexInLoan,
  );
  checkEquality(
    resultToObject(metadata),
    expectedSubLoan.metadata,
    expectedSubLoan.indexInLoan,
  );
  checkEquality(
    resultToObject(state),
    expectedSubLoan.state,
    expectedSubLoan.indexInLoan,
  );
  checkEquality(
    resultToObject(preview),
    defineExpectedSubLoanPreview(expectedSubLoan),
    expectedSubLoan.indexInLoan,
  );
}

async function checkLoanInContract(
  market: Contracts.LendingMarketV2Testable,
  expectedLoan: Loan,
) {
  const subLoanCount = expectedLoan.subLoans.length;
  for (let i = 0; i < subLoanCount; ++i) {
    await checkSubLoanInContract(market, expectedLoan.subLoans[i]);
  }

  const firstSubLoan = expectedLoan.subLoans[0];
  const loanPreview = await market.getLoanPreview(
    firstSubLoan.id,
    TIMESTAMP_SPECIAL_VALUE_TRACKED,
  );
  checkEquality(
    resultToObject(loanPreview),
    defineExpectedLoanPreview(expectedLoan),
  );
}

function applySubLoanRevocation(subLoan: SubLoan, txTimestamp: number) {
  ++subLoan.metadata.updateIndex;
  ++subLoan.metadata.operationCount;
  ++subLoan.metadata.earliestOperationId;
  ++subLoan.metadata.recentOperationId;
  ++subLoan.metadata.latestOperationId;

  subLoan.state.status = SubLoanStatus.Revoked;
  subLoan.state.trackedPrincipal = 0n;
  subLoan.state.trackedPrimaryInterest = 0n;
  subLoan.state.trackedSecondaryInterest = 0n;
  subLoan.state.trackedMoratoryInterest = 0n;
  subLoan.state.trackedLateFee = 0n;
  subLoan.state.trackedTimestamp = txTimestamp;
}

// TODO: Rewrite this function using the operation logic
function applyLoanRevocation(loan: Loan, txTimestamp: number) {
  for (const subLoan of loan.subLoans) {
    applySubLoanRevocation(subLoan, txTimestamp);
  }
}

function createTypicalLoanTakingRequest(fixture: Fixture): LoanTakingRequest {
  return {
    borrower: borrower.address,
    programId: fixture.programId,
    startTimestamp: 0,
  };
}

function createTypicalSubLoanTakingRequests(
  subLoanCount: number,
): SubLoanTakingRequest[] {
  const oneTenthPercentRate = INTEREST_RATE_FACTOR / 1000;
  return Array.from({ length: subLoanCount }, (_, i) => ({
    borrowedAmount: 1000n * BigInt(i + 1) * 10n ** TOKEN_DECIMALS,
    addonAmount: 100n * BigInt(i + 1) * 10n ** TOKEN_DECIMALS,
    duration: SUB_LOAN_DURATION * (i + 1),
    primaryRate: UP_TO_DUE_REMUNERATORY_RATE + oneTenthPercentRate * (i + 1),
    secondaryRate: POST_DUE_REMUNERATORY_RATE + oneTenthPercentRate * (i + 1),
    moratoryRate: MORATORY_RATE + oneTenthPercentRate * (i + 1),
    lateFeeRate: LATE_FEE_RATE + oneTenthPercentRate * (i + 1),
    clawbackFeeRate: CLAWBACK_FEE_RATE + oneTenthPercentRate * (i + 1),
    chargeExpensesRate: CHARGE_EXPENSES_RATE + oneTenthPercentRate * (i + 1),
  }));
}

async function takeTypicalLoan(
  fixture: Fixture,
  props: {
    subLoanCount?: number;
    zeroAddonAmount?: boolean;
    daysAgo?: number;
  } = {},
): Promise<Loan> {
  const { subLoanCount = 3, zeroAddonAmount = false, daysAgo = 3 } = props;
  const loanTakingRequest = createTypicalLoanTakingRequest(fixture);
  loanTakingRequest.startTimestamp = await getBlockTimestamp("latest") - daysAgo * DAY_IN_SECONDS;
  const subLoanRequests = createTypicalSubLoanTakingRequests(subLoanCount);

  if (zeroAddonAmount) {
    for (const subLoanRequest of subLoanRequests) {
      subLoanRequest.addonAmount = 0n;
    }
  }
  const firstSubLoanId = await fixture.market.connect(admin).takeLoan.staticCall(loanTakingRequest, subLoanRequests);
  const takingTx = fixture.market.connect(admin).takeLoan(loanTakingRequest, subLoanRequests);
  const takingTxTimestamp = await getTxTimestamp(takingTx);
  return defineInitialLoan(loanTakingRequest, subLoanRequests, takingTxTimestamp, firstSubLoanId);
}

function createOperation(operationRequest: OperationRequest, operationId: number, txTimestamp: number): Operation {
  return {
    subLoanId: operationRequest.subLoanId,
    id: operationId,
    status: OperationStatus.Nonexistent,
    kind: operationRequest.kind,
    nextOperationId: 0,
    prevOperationId: 0,
    timestamp: operationRequest.timestamp === 0 ? txTimestamp : operationRequest.timestamp,
    value: operationRequest.value,
    account: operationRequest.account,
  };
}

// function orderOperations(operations: Operation[]): Operation[] {
//   const orderedOperations = [...operations].sort((a, b) => {
//     if (a.timestamp === b.timestamp) {
//       return a.id - b.id;
//     }
//     return a.timestamp - b.timestamp;
//   });
//   for (let i = 0; i < orderedOperations.length; ++i) {
//     if (i < orderedOperations.length - 1) {
//       orderedOperations[i].nextOperationId = orderedOperations[i + 1].id;
//     } else {
//       orderedOperations[i].nextOperationId = 0;
//     }
//     if (i > 0) {
//       orderedOperations[i].prevOperationId = orderedOperations[i - 1].id;
//     } else {
//       orderedOperations[i].prevOperationId = 0;
//     }
//   }
//   return orderedOperations;
// }

function getOperationView(operation: Operation): OperationView {
  return {
    status: operation.status,
    kind: operation.kind,
    nextOperationId: operation.nextOperationId,
    prevOperationId: operation.prevOperationId,
    timestamp: operation.timestamp,
    value: operation.value,
    account: operation.account,
  };
}

function dayIndex(timestamp: number): number {
  return Math.floor((timestamp + DAY_BOUNDARY_OFFSET) / DAY_IN_SECONDS);
}

// Returns the due day index of the sub-loan
function getDueDay(subLoan: SubLoan): number {
  const startDay = dayIndex(subLoan.inception.startTimestamp);
  return startDay + subLoan.state.duration;
}

// Calculates the timestamp of the last second of the due day
function getDueDayEndTimestamp(subLoan: SubLoan): number {
  return getDueDay(subLoan) * DAY_IN_SECONDS + (DAY_IN_SECONDS - 1) - DAY_BOUNDARY_OFFSET;
}

function isOverdue(subLoan: SubLoan, timestamp: number): boolean {
  return dayIndex(timestamp) > getDueDay(subLoan);
}

function calculateCompoundInterest(baseAmount: bigint, interestRate: number, days: number): bigint {
  const newBaseAmount = BigInt(
    Math.round(
      Number(baseAmount) * ((1 + interestRate / INTEREST_RATE_FACTOR) ** days),
    ),
  );
  return newBaseAmount - baseAmount;
}

function calculateSimpleInterest(baseAmount: bigint, interestRate: number, days: number): bigint {
  return BigInt(
    Math.round(
      (Number(baseAmount) * interestRate * days) / INTEREST_RATE_FACTOR,
    ),
  );
}

function accruePrimaryInterest(subLoan: SubLoan, timestamp: number) {
  const trackedBalance = subLoan.state.trackedPrincipal + subLoan.state.trackedPrimaryInterest;
  const days = dayIndex(timestamp) - dayIndex(subLoan.state.trackedTimestamp);
  subLoan.state.trackedPrimaryInterest += calculateCompoundInterest(trackedBalance, subLoan.state.primaryRate, days);
}

function accrueSecondaryInterest(subLoan: SubLoan, timestamp: number) {
  const legalPrincipal = subLoan.state.trackedPrincipal + subLoan.state.trackedPrimaryInterest;
  const baseAmount = legalPrincipal + subLoan.state.trackedSecondaryInterest;
  const days = dayIndex(timestamp) - dayIndex(subLoan.state.trackedTimestamp);
  subLoan.state.trackedSecondaryInterest += calculateCompoundInterest(baseAmount, subLoan.state.secondaryRate, days);
}

function accrueMoratoryInterest(subLoan: SubLoan, timestamp: number) {
  const legalPrincipal = subLoan.state.trackedPrincipal + subLoan.state.trackedPrimaryInterest;
  const days = dayIndex(timestamp) - dayIndex(subLoan.state.trackedTimestamp);
  subLoan.state.trackedMoratoryInterest += calculateSimpleInterest(legalPrincipal, subLoan.state.moratoryRate, days);
}

function imposeLateFee(subLoan: SubLoan) {
  const legalPrincipal = subLoan.state.trackedPrincipal + subLoan.state.trackedPrimaryInterest;
  subLoan.state.trackedLateFee += calculateSimpleInterest(legalPrincipal, subLoan.state.lateFeeRate, 1);
}

function imposeClawbackFee(subLoan: SubLoan) {
  const legalPrincipal = subLoan.state.trackedPrincipal + subLoan.state.trackedPrimaryInterest;
  const daysSinceStart = subLoan.state.duration; // duration equals dueDate - startDate in days
  subLoan.state.trackedClawbackFee += calculateCompoundInterest(
    legalPrincipal,
    subLoan.state.clawbackFeeRate,
    daysSinceStart,
  );
}

function imposeChargeExpenses(subLoan: SubLoan) {
  const legalPrincipal = subLoan.state.trackedPrincipal + subLoan.state.trackedPrimaryInterest;
  subLoan.state.trackedChargeExpenses += calculateSimpleInterest(legalPrincipal, subLoan.state.chargeExpensesRate, 1);
}

// Unified function to compute sub-loan state at a specific timestamp assuming no operations
// Handles both pre-due and post-due date scenarios
function advanceSubLoan(subLoan: SubLoan, timestamp: number) {
  const trackedTimestamp = subLoan.state.trackedTimestamp;

  if (timestamp <= trackedTimestamp) {
    throw new Error("Timestamp is not after tracked timestamp");
  }

  const day = dayIndex(timestamp);
  const trackedDay = dayIndex(trackedTimestamp);
  const dueDay = dayIndex(subLoan.inception.startTimestamp) + subLoan.state.duration;

  if (trackedDay <= dueDay && day <= dueDay) {
    // Case 1: Both tracked and target timestamps are at or before due date
    accruePrimaryInterest(subLoan, timestamp);
  } else if (trackedDay <= dueDay && day > dueDay) {
    // Case 2: Tracked timestamp is at or before due date, target is after due date

    const dueDayEndTimestamp = getDueDayEndTimestamp(subLoan);

    // First accrue primary interest up to the due date
    accruePrimaryInterest(subLoan, dueDayEndTimestamp);
    subLoan.state.trackedTimestamp = dueDayEndTimestamp;

    // Apply one-time fees at due date transition
    imposeLateFee(subLoan);
    imposeClawbackFee(subLoan);
    imposeChargeExpenses(subLoan);

    // Then accrue post-due date interests from due date to target
    accrueSecondaryInterest(subLoan, timestamp);
    accrueMoratoryInterest(subLoan, timestamp);
  } else if (trackedDay > dueDay && day > dueDay) {
    // Case 3: Both tracked and target timestamps are after due date
    accrueSecondaryInterest(subLoan, timestamp);
    accrueMoratoryInterest(subLoan, timestamp);
  }

  subLoan.state.trackedTimestamp = timestamp;
  return;
}

function roundFinancially(amount: bigint) {
  const roundedValue = ((amount + ACCURACY_FACTOR / 2n) / ACCURACY_FACTOR) * ACCURACY_FACTOR;
  if (roundedValue === 0n && amount !== 0n) {
    return ACCURACY_FACTOR;
  }
  return roundedValue;
}

function registerSingleOperationInMetadata(subLoan: SubLoan, operationId: number) {
  ++subLoan.metadata.updateIndex;
  ++subLoan.metadata.operationCount;
  // TODO: improve this logic
  subLoan.metadata.earliestOperationId = operationId;
  subLoan.metadata.recentOperationId = operationId;
  subLoan.metadata.latestOperationId = operationId;
}

// TODO: Here and below in similar function all parameters except `subLoan` can be replaced with `operation: Operation`
function applySubLoanRepayment(subLoan: SubLoan, timestamp: number, amount: bigint, operationId: number) {
  advanceSubLoan(subLoan, timestamp);

  if (isOverdue(subLoan, timestamp)) {
    throw new Error("The `applySubLoanRepayment` function does not support overdue sub-loans for now");
  }

  if (subLoan.state.trackedPrimaryInterest > amount) {
    subLoan.state.repaidPrimaryInterest += amount;
    subLoan.state.trackedPrimaryInterest -= amount;
    amount = 0n;
  } else {
    amount -= subLoan.state.trackedPrimaryInterest;
    subLoan.state.repaidPrimaryInterest += subLoan.state.trackedPrimaryInterest;
    subLoan.state.trackedPrimaryInterest = 0n;
  }

  if (subLoan.state.trackedPrincipal >= amount) {
    subLoan.state.repaidPrincipal += amount;
    subLoan.state.trackedPrincipal -= amount;
  } else {
    subLoan.state.repaidPrincipal += subLoan.state.trackedPrincipal;
    subLoan.state.trackedPrincipal = 0n;
  }

  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanDiscount(subLoan: SubLoan, timestamp: number, amount: bigint, operationId: number) {
  advanceSubLoan(subLoan, timestamp);

  if (subLoan.state.trackedPrimaryInterest >= amount) {
    subLoan.state.discountPrimaryInterest += amount;
    subLoan.state.trackedPrimaryInterest -= amount;
    amount = 0n;
  } else {
    amount -= subLoan.state.trackedPrimaryInterest;
    subLoan.state.discountPrimaryInterest += subLoan.state.trackedPrimaryInterest;
    subLoan.state.trackedPrimaryInterest = 0n;
  }

  if (subLoan.state.trackedPrincipal >= amount) {
    subLoan.state.trackedPrincipal -= amount;
    subLoan.state.discountPrincipal += amount;
  } else {
    subLoan.state.discountPrincipal += subLoan.state.trackedPrincipal;
    subLoan.state.trackedPrincipal = 0n;
  }

  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanDurationSetting(subLoan: SubLoan, timestamp: number, value: bigint, operationId: number) {
  advanceSubLoan(subLoan, timestamp);

  subLoan.state.duration = Number(value);
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanFreezing(subLoan: SubLoan, timestamp: number, operationId: number) {
  advanceSubLoan(subLoan, timestamp);

  subLoan.state.freezeTimestamp = timestamp;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanPrimaryRateSetting(
  subLoan: SubLoan,
  timestamp: number,
  value: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  subLoan.state.primaryRate = Number(value);
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanSecondaryRateSetting(
  subLoan: SubLoan,
  timestamp: number,
  value: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  subLoan.state.secondaryRate = Number(value);
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanMoratoryRateSetting(
  subLoan: SubLoan,
  timestamp: number,
  value: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  subLoan.state.moratoryRate = Number(value);
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanLateFeeRateSetting(
  subLoan: SubLoan,
  timestamp: number,
  value: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  subLoan.state.lateFeeRate = Number(value);
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanClawbackFeeRateSetting(
  subLoan: SubLoan,
  timestamp: number,
  value: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  subLoan.state.clawbackFeeRate = Number(value);
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanChargeExpensesRateSetting(
  subLoan: SubLoan,
  timestamp: number,
  value: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  subLoan.state.chargeExpensesRate = Number(value);
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanUnfreezing(
  subLoan: SubLoan,
  timestamp: number,
  value: bigint,
  operationId: number,
) {
  if (subLoan.state.freezeTimestamp === 0) {
    throw new Error("Cannot unfreeze: sub-loan is not frozen");
  }

  advanceSubLoan(subLoan, timestamp);

  // If value is 0, extend duration by the freeze period
  if (value === 0n) {
    const freezeDays = dayIndex(timestamp) - dayIndex(subLoan.state.freezeTimestamp);
    subLoan.state.duration += freezeDays;
  }

  subLoan.state.freezeTimestamp = 0;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanPrincipalDiscount(
  subLoan: SubLoan,
  timestamp: number,
  amount: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  if (amount > subLoan.state.trackedPrincipal) {
    throw new Error("Principal discount amount exceeds tracked principal");
  }

  subLoan.state.trackedPrincipal -= amount;
  subLoan.state.discountPrincipal += amount;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanPrimaryInterestDiscount(
  subLoan: SubLoan,
  timestamp: number,
  amount: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  if (amount > subLoan.state.trackedPrimaryInterest) {
    throw new Error("Primary interest discount amount exceeds tracked primary interest");
  }

  subLoan.state.trackedPrimaryInterest -= amount;
  subLoan.state.discountPrimaryInterest += amount;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanSecondaryInterestDiscount(
  subLoan: SubLoan,
  timestamp: number,
  amount: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  if (amount > subLoan.state.trackedSecondaryInterest) {
    throw new Error("Secondary interest discount amount exceeds tracked secondary interest");
  }

  subLoan.state.trackedSecondaryInterest -= amount;
  subLoan.state.discountSecondaryInterest += amount;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanMoratoryInterestDiscount(
  subLoan: SubLoan,
  timestamp: number,
  amount: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  if (amount > subLoan.state.trackedMoratoryInterest) {
    throw new Error("Moratory interest discount amount exceeds tracked moratory interest");
  }

  subLoan.state.trackedMoratoryInterest -= amount;
  subLoan.state.discountMoratoryInterest += amount;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanLateFeeDiscount(
  subLoan: SubLoan,
  timestamp: number,
  amount: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  if (amount > subLoan.state.trackedLateFee) {
    throw new Error("Late fee discount amount exceeds tracked late fee");
  }

  subLoan.state.trackedLateFee -= amount;
  subLoan.state.discountLateFee += amount;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanClawbackFeeDiscount(
  subLoan: SubLoan,
  timestamp: number,
  amount: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  if (amount > subLoan.state.trackedClawbackFee) {
    throw new Error("Clawback fee discount amount exceeds tracked clawback fee");
  }

  subLoan.state.trackedClawbackFee -= amount;
  subLoan.state.discountClawbackFee += amount;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function applySubLoanChargeExpensesDiscount(
  subLoan: SubLoan,
  timestamp: number,
  amount: bigint,
  operationId: number,
) {
  advanceSubLoan(subLoan, timestamp);

  if (amount > subLoan.state.trackedChargeExpenses) {
    throw new Error("Charge expenses discount amount exceeds tracked charge expenses");
  }

  subLoan.state.trackedChargeExpenses -= amount;
  subLoan.state.discountChargeExpenses += amount;
  subLoan.state.trackedTimestamp = timestamp;

  registerSingleOperationInMetadata(subLoan, operationId);
}

function resetSubLoanState(subLoan: SubLoan) {
  subLoan.state.status = SubLoanStatus.Ongoing;
  subLoan.state.duration = subLoan.inception.initialDuration;
  subLoan.state.freezeTimestamp = 0;
  subLoan.state.trackedTimestamp = subLoan.inception.startTimestamp;

  subLoan.state.primaryRate = subLoan.inception.initialPrimaryRate;
  subLoan.state.secondaryRate = subLoan.inception.initialSecondaryRate;
  subLoan.state.moratoryRate = subLoan.inception.initialMoratoryRate;
  subLoan.state.lateFeeRate = subLoan.inception.initialLateFeeRate;
  subLoan.state.clawbackFeeRate = subLoan.inception.initialClawbackFeeRate;
  subLoan.state.chargeExpensesRate = subLoan.inception.initialChargeExpensesRate;

  subLoan.state.trackedPrincipal = subLoan.inception.borrowedAmount + subLoan.inception.addonAmount;
  subLoan.state.repaidPrincipal = 0n;
  subLoan.state.discountPrincipal = 0n;

  subLoan.state.trackedPrimaryInterest = 0n;
  subLoan.state.repaidPrimaryInterest = 0n;
  subLoan.state.discountPrimaryInterest = 0n;

  subLoan.state.trackedSecondaryInterest = 0n;
  subLoan.state.repaidSecondaryInterest = 0n;
  subLoan.state.discountSecondaryInterest = 0n;

  subLoan.state.trackedMoratoryInterest = 0n;
  subLoan.state.repaidMoratoryInterest = 0n;
  subLoan.state.discountMoratoryInterest = 0n;

  subLoan.state.trackedLateFee = 0n;
  subLoan.state.repaidLateFee = 0n;
  subLoan.state.discountLateFee = 0n;

  subLoan.state.trackedClawbackFee = 0n;
  subLoan.state.repaidClawbackFee = 0n;
  subLoan.state.discountClawbackFee = 0n;

  subLoan.state.trackedChargeExpenses = 0n;
  subLoan.state.repaidChargeExpenses = 0n;
  subLoan.state.discountChargeExpenses = 0n;
}

async function expectNoCreditLineHookCalls(tx: Promise<ContractTransactionResponse>, fixture: Fixture) {
  const { creditLineV2Mock } = fixture;
  await expect(tx).not.to.emit(creditLineV2Mock, EVENT_NAME_MOCK_LOAN_CLOSED);
  await expect(tx).not.to.emit(creditLineV2Mock, EVENT_NAME_MOCK_LOAN_OPENED);
}

async function expectNoLiquidityPoolHookCalls(tx: Promise<ContractTransactionResponse>, fixture: Fixture) {
  const { liquidityPoolMock } = fixture;
  await expect(tx).not.to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN);
  await expect(tx).not.to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT);
}

async function expectNoHookCalls(tx: Promise<ContractTransactionResponse>, fixture: Fixture) {
  await expectNoLiquidityPoolHookCalls(tx, fixture);
  await expectNoCreditLineHookCalls(tx, fixture);
}

async function submitOperation(
  market: Contracts.LendingMarketV2,
  operationRequest: OperationRequest,
  props: { expectedOperationId?: number } = {},
): Promise<{
  tx: Promise<ContractTransactionResponse>;
  operation: Operation;
}> {
  const { expectedOperationId = 1 } = props;
  const currentBlockTimestamp = await getBlockTimestamp("latest");
  const tx = market.connect(admin).submitOperation(
    operationRequest.subLoanId,
    operationRequest.kind,
    operationRequest.timestamp,
    operationRequest.value,
    operationRequest.account,
  );
  const txTimestamp = await getTxTimestamp(tx);

  const operation = createOperation(operationRequest, expectedOperationId, txTimestamp);

  if (operationRequest.timestamp == 0 || operationRequest.timestamp <= currentBlockTimestamp) {
    operation.status = OperationStatus.Applied;
  } else {
    operation.status = OperationStatus.Pending;
  }

  return { tx, operation };
}

describe("Contract 'LendingMarketV2'", () => {
  // TODO: Shift the blockchain timestamp to the start of a Brazilian day to avoid day borders
  before(async () => {
    [deployer, addonTreasury, pauser, admin, borrower, repayer, counterparty, stranger] = await ethers.getSigners();

    lendingMarketFactory = (await ethers.getContractFactory("LendingMarketV2Testable")).connect(deployer);
    lendingEngineFactory = (await ethers.getContractFactory("LendingEngineV2")).connect(deployer);
    tokenMockFactory = (await ethers.getContractFactory("ERC20TokenMock")).connect(deployer);
    creditLineV2MockFactory = (await ethers.getContractFactory("CreditLineV2Mock")).connect(deployer);
    liquidityPoolMockFactory = (await ethers.getContractFactory("LiquidityPoolMock")).connect(deployer);
  });

  describe("Function 'initialize()'", () => {
    let market: Contracts.LendingMarketV2Testable;
    let engine: Contracts.LendingEngineV2;
    let tokenMock: Contracts.ERC20TokenMock;

    beforeEach(async () => {
      ({ market, engine, tokenMock } = await setUpFixture(deployContracts));
    });

    describe("Executes as expected when called properly and", () => {
      it("exposes correct role hashes", async () => {
        expect(await market.OWNER_ROLE()).to.equal(OWNER_ROLE);
        expect(await market.GRANTOR_ROLE()).to.equal(GRANTOR_ROLE);
        expect(await market.ADMIN_ROLE()).to.equal(ADMIN_ROLE);
        expect(await market.PAUSER_ROLE()).to.equal(PAUSER_ROLE);
      });

      it("sets correct role admins", async () => {
        expect(await market.getRoleAdmin(OWNER_ROLE)).to.equal(OWNER_ROLE);
        expect(await market.getRoleAdmin(GRANTOR_ROLE)).to.equal(OWNER_ROLE);
        expect(await market.getRoleAdmin(ADMIN_ROLE)).to.equal(GRANTOR_ROLE);
        expect(await market.getRoleAdmin(PAUSER_ROLE)).to.equal(GRANTOR_ROLE);
      });

      it("sets correct roles for the deployer", async () => {
        expect(await market.hasRole(OWNER_ROLE, deployer)).to.equal(true);
        expect(await market.hasRole(GRANTOR_ROLE, deployer)).to.equal(false);
        expect(await market.hasRole(ADMIN_ROLE, deployer)).to.equal(false);
        expect(await market.hasRole(PAUSER_ROLE, deployer)).to.equal(false);
      });

      it("does not pause the contract", async () => {
        expect(await market.paused()).to.equal(false);
      });

      it("sets correct underlying token address", async () => {
        expect(await market.underlyingToken()).to.equal(tokenMock);
      });

      it("sets correct engine address", async () => {
        expect(await market.engine()).to.equal(engine);
      });

      it("provides correct constants and initial storage variables", async () => {
        expect(await market.interestRateFactor()).to.equal(INTEREST_RATE_FACTOR);
        expect(await market.accuracyFactor()).to.equal(ACCURACY_FACTOR);
        expect(await market.subLoanCountMax()).to.equal(SUB_LOAN_COUNT_MAX);
        expect(await market.operationCountMax()).to.equal(OPERATION_COUNT_MAX);
        expect(await market.dayBoundaryOffset()).to.equal(DAY_BOUNDARY_OFFSET);
        expect(await market.subLoanAutoIdStart()).to.equal(SUB_LOAN_AUTO_ID_START);
        expect(await market.subLoanCounter()).to.equal(0);
        expect(await market.programCounter()).to.equal(0);
        expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
      });
    });

    describe("Is reverted if", () => {
      it("called a second time", async () => {
        await expect(market.initialize(engine, tokenMock))
          .to.be.revertedWithCustomError(market, ERROR_NAME_INVALID_INITIALIZATION);
      });

      it("the provided token address is zero", async () => {
        const wrongTokenAddress = (ADDRESS_ZERO);
        await expect(
          upgrades.deployProxy(
            lendingMarketFactory,
            [wrongTokenAddress, getAddress(engine)],
            MARKET_DEPLOYMENT_OPTIONS,
          ),
        ).to.be.revertedWithCustomError(market, ERROR_NAME_UNDERLYING_TOKEN_ADDRESS_ZERO);
      });

      it("the provided engine address is zero", async () => {
        const wrongEngineAddress = (ADDRESS_ZERO);
        await expect(
          upgrades.deployProxy(
            lendingMarketFactory,
            [getAddress(tokenMock), wrongEngineAddress],
            MARKET_DEPLOYMENT_OPTIONS,
          ),
        ).to.be.revertedWithCustomError(market, ERROR_NAME_ENGINE_ADDRESS_ZERO);
      });
    });
  });

  describe("Function '$__VERSION()'", () => {
    it("returns the expected version", async () => {
      const { market } = await setUpFixture(deployContracts);
      expect(await market.$__VERSION()).to.deep.equal([
        EXPECTED_VERSION.major,
        EXPECTED_VERSION.minor,
        EXPECTED_VERSION.patch,
      ]);
    });
  });

  describe("Function 'upgradeToAndCall()'", () => {
    it("executes as expected", async () => {
      const { market } = await setUpFixture(deployContracts);
      await checkContractUupsUpgrading(market, lendingMarketFactory);
    });

    it("is reverted if the caller does not have the owner role", async () => {
      const { market } = await setUpFixture(deployContracts);

      await expect(market.connect(admin).upgradeToAndCall(market, "0x"))
        .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
        .withArgs(admin.address, OWNER_ROLE);
      await expect(market.connect(stranger).upgradeToAndCall(market, "0x"))
        .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
        .withArgs(stranger.address, OWNER_ROLE);
    });

    it("is reverted if the provided implementation address is not a lending market V2 contract", async () => {
      const { market } = await setUpFixture(deployContracts);
      const mockContractFactory = await ethers.getContractFactory("UUPSExtUpgradeableMock");
      const mockContract = await mockContractFactory.deploy();
      await mockContract.waitForDeployment();

      await expect(market.upgradeToAndCall(mockContract, "0x"))
        .to.be.revertedWithCustomError(market, ERROR_NAME_IMPLEMENTATION_ADDRESS_INVALID);
    });
  });

  describe("Function 'openProgram()'", () => {
    let market: Contracts.LendingMarketV2Testable;
    let creditLineV2Mock: Contracts.CreditLineV2Mock;
    let liquidityPoolMock: Contracts.LiquidityPoolMock;

    beforeEach(async () => {
      ({ market, creditLineV2Mock, liquidityPoolMock } = await setUpFixture(deployAndConfigureContracts));
    });

    describe("Executes as expected in a typical case when called properly for the first time and", () => {
      let tx: Promise<ContractTransactionResponse>;

      // TODO: Consider replacement with `before()` here an in similar places
      beforeEach(async () => {
        tx = market.openProgram(creditLineV2Mock, liquidityPoolMock);
        await proveTx(tx);
      });

      it("opens a program with the correct parameters", async () => {
        const program = await market.getProgram(1);
        expect(program.status).to.equal(LendingProgramStatus.Active);
        expect(program.creditLine).to.equal(getAddress(creditLineV2Mock));
        expect(program.liquidityPool).to.equal(getAddress(liquidityPoolMock));
      });

      it("emits the expected event", async () => {
        await expect(tx)
          .to.emit(market, EVENT_NAME_PROGRAM_OPENED)
          .withArgs(1, getAddress(creditLineV2Mock), getAddress(liquidityPoolMock));
      });

      it("increments the program counter", async () => {
        expect(await market.programCounter()).to.equal(1);
      });
    });

    describe("Executes as expected when", () => {
      async function checkProgramOpening(
        props: {
          programId: number;
          tx: Promise<ContractTransactionResponse>;
          creditLineAddress: string;
          liquidityPoolAddress: string;
        },
      ) {
        const { programId, tx, creditLineAddress, liquidityPoolAddress } = props;
        const program = await market.getProgram(programId);
        expect(program.status).to.equal(LendingProgramStatus.Active);
        expect(program.creditLine).to.equal(creditLineAddress);
        expect(program.liquidityPool).to.equal(liquidityPoolAddress);

        await expect(tx)
          .to.emit(market, EVENT_NAME_PROGRAM_OPENED)
          .withArgs(programId, creditLineAddress, liquidityPoolAddress);
      }

      it("called several times for different credit lines and liquidity pools", async () => {
        const creditLineV2Mock2 = await deployCreditLineV2Mock();
        const liquidityPoolMock2 = await deployLiquidityPoolMock();
        const pairs: { creditLine: Contracts.CreditLineV2Mock; liquidityPool: Contracts.LiquidityPoolMock }[] = [
          { creditLine: creditLineV2Mock, liquidityPool: liquidityPoolMock },
          { creditLine: creditLineV2Mock, liquidityPool: liquidityPoolMock }, // Two times the same pair
          { creditLine: creditLineV2Mock2, liquidityPool: liquidityPoolMock2 },
          { creditLine: creditLineV2Mock, liquidityPool: liquidityPoolMock2 },
          { creditLine: creditLineV2Mock2, liquidityPool: liquidityPoolMock },
        ];

        for (let i = 0; i < pairs.length; ++i) {
          const programId = i + 1;
          const { creditLine, liquidityPool } = pairs[i];
          const tx = market.openProgram(creditLine, liquidityPool);
          const creditLineAddress = getAddress(creditLine);
          const liquidityPoolAddress = getAddress(liquidityPool);
          await proveTx(tx);
          expect(await market.programCounter()).to.equal(programId);
          await checkProgramOpening({ programId, tx, creditLineAddress, liquidityPoolAddress });
        }
      });
    });

    describe("Is reverted if", () => {
      it("the caller does not have the owner role", async () => {
        await expect(market.connect(admin).openProgram(creditLineV2Mock, liquidityPoolMock))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(admin.address, OWNER_ROLE);
        await expect(market.connect(stranger).openProgram(creditLineV2Mock, liquidityPoolMock))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(stranger.address, OWNER_ROLE);
      });

      it("the contract is paused", async () => {
        await proveTx(market.connect(pauser).pause());
        await expect(market.openProgram(creditLineV2Mock, liquidityPoolMock))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ENFORCED_PAUSED);
      });

      it("the credit line address is zero", async () => {
        const wrongCreditLineAddress = (ADDRESS_ZERO);

        await expect(market.openProgram(wrongCreditLineAddress, liquidityPoolMock))
          .to.be.revertedWithCustomError(market, ERROR_NAME_CREDIT_LINE_ADDRESS_ZERO);
      });

      it("the credit line address is not a contract", async () => {
        const wrongCreditLineAddress = stranger.address;

        await expect(market.openProgram(wrongCreditLineAddress, liquidityPoolMock))
          .to.be.revertedWithCustomError(market, ERROR_NAME_CREDIT_LINE_ADDRESS_INVALID);
      });

      it("the credit line address does not implement the expected proof function", async () => {
        const wrongCreditLine = (liquidityPoolMock);

        await expect(market.openProgram(wrongCreditLine, liquidityPoolMock))
          .to.be.revertedWithCustomError(market, ERROR_NAME_CREDIT_LINE_ADDRESS_INVALID);
      });

      it("the liquidity pool address is zero", async () => {
        const wrongLiquidityPoolAddress = (ADDRESS_ZERO);

        await expect(market.openProgram(creditLineV2Mock, wrongLiquidityPoolAddress))
          .to.be.revertedWithCustomError(market, ERROR_NAME_LIQUIDITY_POOL_ADDRESS_ZERO);
      });

      it("the liquidity pool address is not a contract", async () => {
        const wrongLiquidityPoolAddress = stranger.address;

        await expect(market.openProgram(creditLineV2Mock, wrongLiquidityPoolAddress))
          .to.be.revertedWithCustomError(market, ERROR_NAME_LIQUIDITY_POOL_ADDRESS_INVALID);
      });

      it("the liquidity pool address does not implement the expected proof function", async () => {
        const wrongLiquidityPool = (creditLineV2Mock);

        await expect(market.openProgram(creditLineV2Mock, wrongLiquidityPool))
          .to.be.revertedWithCustomError(market, ERROR_NAME_LIQUIDITY_POOL_ADDRESS_INVALID);
      });
    });
  });

  describe("Function 'closeProgram()'", () => {
    let market: Contracts.LendingMarketV2Testable;
    let creditLineV2Mock: Contracts.CreditLineV2Mock;
    let liquidityPoolMock: Contracts.LiquidityPoolMock;

    beforeEach(async () => {
      ({ market, creditLineV2Mock, liquidityPoolMock } = await setUpFixture(deployAndConfigureContracts));
    });

    describe("Executes as expected in a typical case when called properly for the first time and", () => {
      let tx: Promise<ContractTransactionResponse>;
      beforeEach(async () => {
        await proveTx(market.openProgram(creditLineV2Mock, liquidityPoolMock));
        tx = market.closeProgram(1);
        await proveTx(tx);
      });

      it("closes a program with the correct parameters", async () => {
        const program = await market.getProgram(1);
        expect(program.status).to.equal(LendingProgramStatus.Closed);
        expect(program.creditLine).to.equal(getAddress(creditLineV2Mock));
        expect(program.liquidityPool).to.equal(getAddress(liquidityPoolMock));
      });

      it("emits the expected event", async () => {
        await expect(tx)
          .to.emit(market, EVENT_NAME_PROGRAM_CLOSED)
          .withArgs(1);
      });

      it("does not change the program counter", async () => {
        expect(await market.programCounter()).to.equal(1);
      });
    });

    describe("Executes as expected when", () => {
      async function checkProgramClosing(
        props: {
          programId: number;
          tx: Promise<ContractTransactionResponse>;
          // TODO: Consider replacing with Addressable. The same for checkProgramOpening
          creditLineAddress: string;
          liquidityPoolAddress: string;
        },
      ) {
        const { programId, tx, creditLineAddress, liquidityPoolAddress } = props;
        const program = await market.getProgram(programId);
        expect(program.status).to.equal(LendingProgramStatus.Closed);
        expect(program.creditLine).to.equal(creditLineAddress);
        expect(program.liquidityPool).to.equal(liquidityPoolAddress);

        await expect(tx)
          .to.emit(market, EVENT_NAME_PROGRAM_CLOSED)
          .withArgs(programId);
      }

      it("called several times for different programs", async () => {
        const creditLineV2Mock2 = await deployCreditLineV2Mock();
        const liquidityPoolMock2 = await deployLiquidityPoolMock();
        const pairs: { creditLine: Contracts.CreditLineV2Mock; liquidityPool: Contracts.LiquidityPoolMock }[] = [
          { creditLine: creditLineV2Mock, liquidityPool: liquidityPoolMock },
          { creditLine: creditLineV2Mock2, liquidityPool: liquidityPoolMock2 },
          { creditLine: creditLineV2Mock, liquidityPool: liquidityPoolMock2 },
        ];

        // Open all programs first
        for (const { creditLine, liquidityPool } of pairs) {
          await proveTx(market.openProgram(creditLine, liquidityPool));
        }

        // Close all programs
        for (let i = pairs.length - 1; i >= 0; --i) {
          const programId = i + 1;
          const { creditLine, liquidityPool } = pairs[i];
          const creditLineAddress = getAddress(creditLine);
          const liquidityPoolAddress = getAddress(liquidityPool);
          const tx = market.closeProgram(programId);
          await proveTx(tx);
          await checkProgramClosing({ programId, tx, creditLineAddress, liquidityPoolAddress });
        }
      });
    });

    describe("Is reverted if", () => {
      it("the caller does not have the owner role", async () => {
        await expect(market.connect(admin).closeProgram(1))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(admin.address, OWNER_ROLE);
        await expect(market.connect(stranger).closeProgram(1))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(stranger.address, OWNER_ROLE);
      });

      it("the contract is paused", async () => {
        await proveTx(market.connect(pauser).pause());
        await expect(market.closeProgram(1))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ENFORCED_PAUSED);
      });

      it("the program does not exist", async () => {
        await expect(market.closeProgram(1))
          .to.be.revertedWithCustomError(market, ERROR_NAME_PROGRAM_STATUS_INCOMPATIBLE)
          .withArgs(LendingProgramStatus.Nonexistent);
      });

      it("the program is already closed", async () => {
        await proveTx(market.openProgram(creditLineV2Mock, liquidityPoolMock));
        await proveTx(market.closeProgram(1));

        await expect(market.closeProgram(1))
          .to.be.revertedWithCustomError(market, ERROR_NAME_PROGRAM_STATUS_INCOMPATIBLE)
          .withArgs(LendingProgramStatus.Closed);
      });
    });
  });

  describe("Function 'takeLoan()'", () => {
    const firstSubLoanId = (SUB_LOAN_AUTO_ID_START);

    let market: Contracts.LendingMarketV2Testable;
    let tokenMock: Contracts.ERC20TokenMock;
    let creditLineV2Mock: Contracts.CreditLineV2Mock;
    let liquidityPoolMock: Contracts.LiquidityPoolMock;
    let programId: number;

    let loanTakingRequest: LoanTakingRequest;
    let subLoanTakingRequests: SubLoanTakingRequest[];

    beforeEach(async () => {
      const fixture = await setUpFixture(deployAndConfigureContractsForLoanTaking);
      ({ market, tokenMock, creditLineV2Mock, liquidityPoolMock, programId } = fixture);

      loanTakingRequest = createTypicalLoanTakingRequest(fixture);
      subLoanTakingRequests = createTypicalSubLoanTakingRequests(3);
    });

    describe("Executes as expected when called properly with typical parameters for a loan of 3 sub-loans and", () => {
      let tx: Promise<ContractTransactionResponse>;
      let txTimestamp: number;
      let loan: Loan;

      beforeEach(async () => {
        tx = market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests);
        txTimestamp = await getTxTimestamp(tx);
        loan = defineInitialLoan(loanTakingRequest, subLoanTakingRequests, txTimestamp, firstSubLoanId);
      });

      it("creates a loan and sub-loans with the correct parameters", async () => {
        const expectedLoan = defineInitialLoan(loanTakingRequest, subLoanTakingRequests, txTimestamp, firstSubLoanId);
        await checkLoanInContract(market, expectedLoan);
      });

      it("emits the expected events", async () => {
        const numberOfSubLoanEvents = await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_TAKEN);
        const numberOfLoanEvents = await getNumberOfEvents(tx, market, EVENT_NAME_LOAN_TAKEN);

        expect(numberOfSubLoanEvents).to.equal(subLoanTakingRequests.length);
        expect(numberOfLoanEvents).to.equal(1);

        for (const subLoan of loan.subLoans) {
          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_TAKEN)
            .withArgs(
              subLoan.id,
              subLoan.inception.borrowedAmount,
              subLoan.inception.addonAmount,
              subLoan.inception.startTimestamp,
              subLoan.state.duration,
              toBytes32(packRates(subLoan)),
            );
        }

        await expect(tx)
          .to.emit(market, EVENT_NAME_LOAN_TAKEN)
          .withArgs(
            loan.subLoans[0].id,
            loan.subLoans[0].inception.borrower,
            programId,
            loan.totalBorrowedAmount,
            loan.totalAddonAmount,
            subLoanTakingRequests.length,
            getAddress(creditLineV2Mock),
            getAddress(liquidityPoolMock),
          );
      });

      it("changes the sub-loan auto ID counter as expected", async () => {
        expect(await market.subLoanAutoIdCounter()).to.equal(subLoanTakingRequests.length);
      });

      it("transfers tokens as expected", async () => {
        expect(tx).to.changeTokenBalances(
          tokenMock,
          [market, liquidityPoolMock, borrower, addonTreasury],
          [0, loan.totalBorrowedAmount + loan.totalBorrowedAmount, loan.totalBorrowedAmount, loan.totalAddonAmount],
        );
        await checkTokenPath(tx, tokenMock, [liquidityPoolMock, market, borrower], loan.totalBorrowedAmount);
        await checkTokenPath(tx, tokenMock, [liquidityPoolMock, market, addonTreasury], loan.totalAddonAmount);
      });

      it("calls the expected credit line function properly", async () => {
        expect(await getNumberOfEvents(tx, creditLineV2Mock, EVENT_NAME_MOCK_LOAN_OPENED)).to.equal(1);
        await checkEventSequence(tx, [
          [creditLineV2Mock, EVENT_NAME_MOCK_LOAN_OPENED],
          [tokenMock, EVENT_NAME_TRANSFER],
        ]);
        await expect(tx)
          .to.emit(creditLineV2Mock, EVENT_NAME_MOCK_LOAN_OPENED)
          .withArgs(
            loan.subLoans[0].id,
            loan.subLoans[0].inception.borrower,
            loan.totalBorrowedAmount,
          );
      });

      it("calls the expected liquidity pool function properly", async () => {
        expect(await getNumberOfEvents(tx, liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT)).to.equal(2);
        await checkEventSequence(tx, [
          [liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT],
          [tokenMock, EVENT_NAME_TRANSFER],
        ]);
        await expect(tx)
          .to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT)
          .withArgs(loan.totalBorrowedAmount);
        await expect(tx)
          .to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT)
          .withArgs(loan.totalAddonAmount);
      });
    });

    describe("Executes as expected when", () => {
      async function checkNewlyTakenLoan(
        tx: Promise<ContractTransactionResponse>,
        loanTakingRequest: LoanTakingRequest,
        subLoanTakingRequests: SubLoanTakingRequest[],
      ) {
        const txTimestamp = await getTxTimestamp(tx);
        const expectedLoan = defineInitialLoan(loanTakingRequest, subLoanTakingRequests, txTimestamp, firstSubLoanId);
        await checkLoanInContract(market, expectedLoan);
      }

      it("the start timestamp is in the past for a loan with 3 sub-loans", async () => {
        const latestBlockTimestamp = await getBlockTimestamp("latest");
        loanTakingRequest.startTimestamp = latestBlockTimestamp - 1000;
        const tx = market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests);
        await checkNewlyTakenLoan(tx, loanTakingRequest, subLoanTakingRequests);
      });

      it("the duration is for the first sub-loan in a loan with 3 sub-loans", async () => {
        subLoanTakingRequests[0].duration = 0;
        const tx = market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests);
        await checkNewlyTakenLoan(tx, loanTakingRequest, subLoanTakingRequests);
      });

      it("the duration is zero for the first sub-loan in a loan with 1 sub-loan", async () => {
        subLoanTakingRequests[0].duration = 0;
        const subLoanRequests = [subLoanTakingRequests[0]];
        const tx = market.connect(admin).takeLoan(loanTakingRequest, subLoanRequests);
        await checkNewlyTakenLoan(tx, loanTakingRequest, subLoanRequests);
      });

      it("the addon amount is zero for the second sub-loan in a loan with 3 sub-loans", async () => {
        subLoanTakingRequests[1].addonAmount = 0n;
        const tx = market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests);
        await checkNewlyTakenLoan(tx, loanTakingRequest, subLoanTakingRequests);
        const totalBorrowedAmount = subLoanTakingRequests.reduce(
          (sum, req) => sum + req.borrowedAmount,
          0n,
        );
        const totalAddonAmount = subLoanTakingRequests.reduce(
          (sum, req) => sum + req.addonAmount,
          0n,
        );
        expect(tx).to.changeTokenBalances(
          tokenMock,
          [market, liquidityPoolMock, borrower, addonTreasury],
          [0, totalBorrowedAmount + totalAddonAmount, totalBorrowedAmount, totalAddonAmount],
        );
      });

      it("the addon amount is zero for all sub-loans in a loan with 3 sub-loans", async () => {
        for (const subLoanTakingRequest of subLoanTakingRequests) {
          subLoanTakingRequest.addonAmount = 0n;
        }
        const tx = market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests);
        await checkNewlyTakenLoan(tx, loanTakingRequest, subLoanTakingRequests);
        const totalBorrowedAmount = subLoanTakingRequests.reduce(
          (sum, req) => sum + req.borrowedAmount,
          0n,
        );
        expect(tx).to.changeTokenBalances(
          tokenMock,
          [market, liquidityPoolMock, borrower, addonTreasury],
          [0, totalBorrowedAmount, totalBorrowedAmount, 0],
        );
      });

      // TODO: Add more tests for zero rates

      it("the clawback fee rate is zero for the second sub-loan in a loan with 3 sub-loans", async () => {
        subLoanTakingRequests[1].clawbackFeeRate = 0;
        const tx = market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests);
        await checkNewlyTakenLoan(tx, loanTakingRequest, subLoanTakingRequests);
      });

      it("the clawback fee rate is zero for all sub-loans in a loan with 3 sub-loans", async () => {
        for (const subLoanTakingRequest of subLoanTakingRequests) {
          subLoanTakingRequest.clawbackFeeRate = 0;
        }
        const tx = market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests);
        await checkNewlyTakenLoan(tx, loanTakingRequest, subLoanTakingRequests);
      });
    });

    describe("Is reverted if", () => {
      it("the caller does not have the admin role", async () => {
        await expect(market.connect(deployer).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(deployer.address, ADMIN_ROLE);
        await expect(market.connect(stranger).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(stranger.address, ADMIN_ROLE);
      });

      it("the contract is paused", async () => {
        await proveTx(market.connect(pauser).pause());

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ENFORCED_PAUSED);
      });

      it("the block timestamp is greater than the maximum allowed value", async () => {
        // Skip this test if the network is not Hardhat
        if (network.name !== "hardhat") {
          return;
        }
        await increaseBlockTimestampTo(Number(maxUintForBits(32)) + 1);

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_BLOCK_TIMESTAMP_EXCESS);
      });

      it("the sub-loan array is empty", async () => {
        await expect(market.connect(admin).takeLoan(loanTakingRequest, []))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_COUNT_ZERO);
      });

      it("the borrower address is zero", async () => {
        loanTakingRequest.borrower = (ADDRESS_ZERO);
        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_BORROWER_ADDRESS_ZERO);
      });

      it("the start timestamp is in the future", async () => {
        const latestBlockTimestamp = await getBlockTimestamp("latest");
        loanTakingRequest.startTimestamp = latestBlockTimestamp + 10000;

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_LOAN_START_TIMESTAMP_INVALID);
      });

      it("the start timestamp is 1 (reserved special value)", async () => {
        loanTakingRequest.startTimestamp = 1;

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_LOAN_START_TIMESTAMP_INVALID);
      });

      it("the total borrowed amount is zero", async () => {
        for (const subLoanTakingRequest of subLoanTakingRequests) {
          subLoanTakingRequest.borrowedAmount = 0n;
        }

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_LOAN_BORROWED_AMOUNT_INVALID);
      });

      it("one of the sub-loans has the zero borrowed amount", async () => {
        subLoanTakingRequests[1].borrowedAmount = 0n;
        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_BORROWED_AMOUNT_INVALID);
      });

      it("one of the sub-loans has the duration greater than the maximum allowed value", async () => {
        subLoanTakingRequests[1].duration = Number(maxUintForBits(16)) + 1;
        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DURATION_EXCESS);
      });

      it("one of the sub-loans has the primary rate greater than the max allowed value", async () => {
        subLoanTakingRequests[1].primaryRate = INTEREST_RATE_FACTOR + 1;
        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("one of the sub-loans has the secondary rate greater than the max allowed value", async () => {
        subLoanTakingRequests[1].secondaryRate = INTEREST_RATE_FACTOR + 1;
        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("one of the sub-loans has the moratory rate greater than the maximum allowed value", async () => {
        subLoanTakingRequests[1].moratoryRate = INTEREST_RATE_FACTOR + 1;
        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("one of the sub-loans has the late fee rate greater than the maximum allowed value", async () => {
        subLoanTakingRequests[1].lateFeeRate = INTEREST_RATE_FACTOR + 1;
        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("one of the sub-loans has the clawback fee rate greater than the maximum allowed value", async () => {
        subLoanTakingRequests[1].clawbackFeeRate = INTEREST_RATE_FACTOR + 1;
        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("the sub-loan durations are not in ascending order", async () => {
        subLoanTakingRequests[subLoanTakingRequests.length - 1].duration = subLoanTakingRequests[0].duration;

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_LOAN_DURATIONS_INVALID);
      });

      it("one of the sub-loans has the status 'Ongoing'", async () => {
        const subLoanId = firstSubLoanId + BigInt(subLoanTakingRequests.length - 1);
        await proveTx(market.mockSubLoanStatus(subLoanId, SubLoanStatus.Ongoing));

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_EXISTENT_ALREADY);
      });

      it("one of the sub-loans has the status 'Revoked'", async () => {
        const subLoanId = firstSubLoanId + BigInt(subLoanTakingRequests.length - 1);
        await proveTx(market.mockSubLoanStatus(subLoanId, SubLoanStatus.Revoked));

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_EXISTENT_ALREADY);
      });

      it("the credit line hook call is reverted", async () => {
        await proveTx(creditLineV2Mock.setRevertOnBeforeLoanOpened(true));

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(creditLineV2Mock, ERROR_NAME_CREDIT_LINE_ON_BEFORE_LOAN_OPENED_REVERTED);
      });

      it("the liquidity pool hook call is reverted", async () => {
        await proveTx(liquidityPoolMock.setRevertOnBeforeLiquidityOut(true));

        await expect(market.connect(admin).takeLoan(loanTakingRequest, subLoanTakingRequests))
          .to.be.revertedWithCustomError(liquidityPoolMock, ERROR_NAME_LIQUIDITY_POOL_ON_BEFORE_LIQUIDITY_OUT_REVERTED);
      });
    });
  });

  describe("Function 'revokeLoan()'", () => {
    let fixture: Fixture;
    let market: Contracts.LendingMarketV2Testable;
    let tokenMock: Contracts.ERC20TokenMock;
    let creditLineV2Mock: Contracts.CreditLineV2Mock;
    let liquidityPoolMock: Contracts.LiquidityPoolMock;

    beforeEach(async () => {
      fixture = await setUpFixture(deployAndConfigureContractsForLoanTaking);
      ({ market, tokenMock, creditLineV2Mock, liquidityPoolMock } = fixture);
    });

    describe("Executes as expected when called properly for a loan of 3 sub-loans just after it is taken and", () => {
      let loan: Loan;
      let tx: Promise<ContractTransactionResponse>;
      let txTimestamp: number;

      beforeEach(async () => {
        loan = await takeTypicalLoan(fixture, { subLoanCount: 3, zeroAddonAmount: false });
        tx = market.connect(admin).revokeLoan(loan.subLoans[0].id);
        txTimestamp = await getTxTimestamp(tx);
      });

      it("revokes all sub-loans with the correct status", async () => {
        applyLoanRevocation(loan, txTimestamp);
        await checkLoanInContract(market, loan);
      });

      it("registers the expected operations", async () => {
        const operationId = 1;

        for (const subLoan of loan.subLoans) {
          const actualOperationIds = await market.getSubLoanOperationIds(subLoan.id);
          expect(actualOperationIds).to.deep.equal([operationId]);

          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.Revocation,
          };

          const expectedOperation = createOperation(operationRequest, operationId, txTimestamp);
          expectedOperation.status = OperationStatus.Applied;

          const actualOperationView = await market.getSubLoanOperation(subLoan.id, operationId);
          checkEquality(resultToObject(actualOperationView), getOperationView(expectedOperation));
        }
      });

      it("emits the expected events", async () => {
        expect(await getNumberOfEvents(tx, market, EVENT_NAME_LOAN_REVOKED)).to.equal(1);
        expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(loan.subLoans.length);
        expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(loan.subLoans.length);

        for (const subLoan of loan.subLoans) {
          const expectedOperationId = 1;

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              subLoan.id,
              expectedOperationId,
              OperationKind.Revocation,
              txTimestamp,
              0, // value
              ADDRESS_ZERO, // account
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanRevocation(subLoan, txTimestamp);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        }

        await expect(tx)
          .to.emit(market, EVENT_NAME_LOAN_REVOKED)
          .withArgs(
            loan.subLoans[0].id, // firstSubLoanId
            loan.subLoans.length, // subLoanCount
            loan.totalBorrowedAmount, // revokedBorrowedAmount (positive: borrower owes pool)
            loan.totalAddonAmount, // revokedAddonAmount
          );
      });

      it("transfers tokens as expected", async () => {
        await expect(tx).to.changeTokenBalances(
          tokenMock,
          [market, liquidityPoolMock, borrower, addonTreasury],
          [0, loan.totalBorrowedAmount + loan.totalAddonAmount, -loan.totalBorrowedAmount, -loan.totalAddonAmount],
        );
        await checkTokenPath(tx, tokenMock, [borrower, market, liquidityPoolMock], loan.totalBorrowedAmount);
        await checkTokenPath(tx, tokenMock, [addonTreasury, market, liquidityPoolMock], loan.totalAddonAmount);
      });

      it("calls the expected credit line function properly", async () => {
        expect(await getNumberOfEvents(tx, creditLineV2Mock, EVENT_NAME_MOCK_LOAN_CLOSED)).to.equal(1);
        await checkEventSequence(tx, [
          [creditLineV2Mock, EVENT_NAME_MOCK_LOAN_CLOSED],
          [tokenMock, EVENT_NAME_TRANSFER],
        ]);
        await expect(tx)
          .to.emit(creditLineV2Mock, EVENT_NAME_MOCK_LOAN_CLOSED)
          .withArgs(
            loan.subLoans[0].id,
            loan.subLoans[0].inception.borrower,
            loan.totalBorrowedAmount,
          );
      });

      it("calls the expected liquidity pool function properly", async () => {
        expect(await getNumberOfEvents(tx, liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)).to.equal(2);
        await checkEventSequence(tx, [
          [liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN],
          [tokenMock, EVENT_NAME_TRANSFER],
        ]);
        await expect(tx)
          .to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)
          .withArgs(loan.totalBorrowedAmount);
        await expect(tx)
          .to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)
          .withArgs(loan.totalAddonAmount);
      });
    });

    describe("Executes as expected when", () => {
      it("called for the second sub-loan ID within the loan", async () => {
        const loan = await takeTypicalLoan(fixture, { subLoanCount: 3, zeroAddonAmount: false });
        const subLoanId = loan.subLoans[1].id;
        const tx = market.connect(admin).revokeLoan(subLoanId);
        applyLoanRevocation(loan, await getTxTimestamp(tx));
        await checkLoanInContract(market, loan);
      });

      it("called for the last sub-loan ID within the loan", async () => {
        const loan = await takeTypicalLoan(fixture, { subLoanCount: 3, zeroAddonAmount: false });
        const subLoanId = loan.subLoans[loan.subLoans.length - 1].id;
        const tx = market.connect(admin).revokeLoan(subLoanId);
        applyLoanRevocation(loan, await getTxTimestamp(tx));
        await checkLoanInContract(market, loan);
      });

      it("called for a loan with a single sub-loan", async () => {
        const loan = await takeTypicalLoan(fixture, { subLoanCount: 1, zeroAddonAmount: false });
        const revocationTx = market.connect(admin).revokeLoan(loan.subLoans[0].id);
        applyLoanRevocation(loan, await getTxTimestamp(revocationTx));
        await checkLoanInContract(market, loan);
        // TODO: check the number of events emitted
      });

      it("called for a loan with the zero addon amount for all sub-loans", async () => {
        const loan = await takeTypicalLoan(fixture, { subLoanCount: 3, zeroAddonAmount: true });
        const revocationTx = market.connect(admin).revokeLoan(loan.subLoans[0].id);
        applyLoanRevocation(loan, await getTxTimestamp(revocationTx));
        await checkLoanInContract(market, loan);

        await expect(revocationTx).to.changeTokenBalances(
          tokenMock,
          [market, liquidityPoolMock, borrower, addonTreasury],
          [0, loan.totalBorrowedAmount, -loan.totalBorrowedAmount, 0],
        );
      });
    });

    describe("Is reverted if", () => {
      let loan: Loan;
      let firstSubLoanId: bigint;

      beforeEach(async () => {
        loan = await takeTypicalLoan(fixture, { subLoanCount: 3, zeroAddonAmount: false });
        firstSubLoanId = loan.subLoans[0].id;
      });

      it("the caller does not have the admin role", async () => {
        await expect(market.connect(deployer).revokeLoan(firstSubLoanId))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(deployer.address, ADMIN_ROLE);
        await expect(market.connect(stranger).revokeLoan(firstSubLoanId))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(stranger.address, ADMIN_ROLE);
      });

      it("the contract is paused", async () => {
        await proveTx(market.connect(pauser).pause());

        await expect(market.connect(admin).revokeLoan(firstSubLoanId))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ENFORCED_PAUSED);
      });

      it("the block timestamp is greater than the maximum allowed value", async () => {
        // Skip this test if the network is not Hardhat
        if (network.name !== "hardhat") {
          return;
        }

        await increaseBlockTimestampTo(Number(maxUintForBits(32)) + 1);

        await expect(market.connect(admin).revokeLoan(firstSubLoanId))
          .to.be.revertedWithCustomError(market, ERROR_NAME_BLOCK_TIMESTAMP_EXCESS);
      });

      it("the sub-loan does not exist", async () => {
        const nonexistentSubLoanId = firstSubLoanId + BigInt(loan.subLoans.length);

        await expect(market.connect(admin).revokeLoan(nonexistentSubLoanId))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_NONEXISTENT);
      });

      it("the loan is already revoked", async () => {
        await proveTx(market.connect(admin).revokeLoan(firstSubLoanId));

        await expect(market.connect(admin).revokeLoan(firstSubLoanId))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_REVOKED);
      });

      it("the credit line hook call is reverted", async () => {
        await proveTx(creditLineV2Mock.setRevertOnAfterLoanClosed(true));

        await expect(market.connect(admin).revokeLoan(firstSubLoanId))
          .to.be.revertedWithCustomError(creditLineV2Mock, ERROR_NAME_CREDIT_LINE_ON_AFTER_LOAN_CLOSED_REVERTED);
      });

      it("the liquidity pool hook call is reverted", async () => {
        await proveTx(liquidityPoolMock.setRevertOnBeforeLiquidityIn(true));

        await expect(market.connect(admin).revokeLoan(firstSubLoanId))
          .to.be.revertedWithCustomError(liquidityPoolMock, ERROR_NAME_LIQUIDITY_POOL_ON_BEFORE_LIQUIDITY_IN_REVERTED);
      });

      // TODO: Check the case when there is a pending operation after the revocation
    });
  });

  // TODO: Consider a test case when submitting a new operation breaks something in the future.

  describe("Function 'submitOperation()'", () => {
    let fixture: Fixture;
    let market: Contracts.LendingMarketV2Testable;
    let tokenMock: Contracts.ERC20TokenMock;
    let liquidityPoolMock: Contracts.LiquidityPoolMock;
    let loan: Loan;
    let activeSubLoan: SubLoan; // Non-overdue sub-loan (index 1, duration 60 days)
    let overdueSubLoan: SubLoan; // Overdue sub-loan (index 0, duration 30 day, started 33 days ago)

    beforeEach(async () => {
      fixture = await setUpFixture(deployAndConfigureContractsForLoanTaking);
      ({ market, tokenMock, liquidityPoolMock } = fixture);
      // Take a loan with 3 sub-loans where the first one is overdue
      loan = await takeTypicalLoan(fixture, { subLoanCount: 3, daysAgo: SUB_LOAN_DURATION + 3 });
      overdueSubLoan = loan.subLoans[0]; // Duration 30 day, started 33 days ago = 2 days overdue
      activeSubLoan = loan.subLoans[1]; // Duration 60 days, started 33 days ago = not overdue
    });

    describe("Executes as expected when called properly in simple cases for", () => {
      describe("A repayment operation from the repayer at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            subLoanId: subLoan.id,
            kind: OperationKind.Repayment,
            timestamp: 0,
            value: (subLoan.inception.borrowedAmount / 10n),
            account: repayer.address,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanRepayment(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("registers a new address in the address book as expected", async () => {
          const accountId = (1);
          expect(await market.getAccountAddressBookRecordCount()).to.equal(1);
          expect(await market.getAccountInAddressBook(accountId)).to.equal(repayer.address);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED)).to.equal(1);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              repayer.address,
            );

          expect(tx).to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED).withArgs(repayer.address, 1);

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanRepayment(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("transfers tokens as expected", async () => {
          await expect(tx).to.changeTokenBalances(
            tokenMock,
            [market, liquidityPoolMock, borrower, repayer, addonTreasury],
            [0, operation.value, 0, -operation.value, 0],
          );
          await checkTokenPath(tx, tokenMock, [repayer, market, liquidityPoolMock], operation.value);
        });

        it("calls the expected liquidity pool function properly", async () => {
          expect(await getNumberOfEvents(tx, liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)).to.equal(1);
          expect(tx).not.to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT);
          await checkEventSequence(tx, [
            [liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN],
            [tokenMock, EVENT_NAME_TRANSFER],
          ]);
          await expect(tx)
            .to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)
            .withArgs(operation.value);
        });

        it("does not call the credit line hook functions", async () => {
          await expectNoCreditLineHookCalls(tx, fixture);
        });
      });

      describe("A repayment operation from the borrower in the past, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest = {
            subLoanId: subLoan.id,
            kind: OperationKind.Repayment,
            timestamp: subLoan.inception.startTimestamp + 24 * 3600, // One day after the sub-loan start
            value: (subLoan.inception.borrowedAmount / 10n),
            account: borrower.address,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanRepayment(
            subLoan,
            operation.timestamp,
            operation.value,
            operation.id,
          );
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              borrower.address,
            );

          const updateIndex = subLoan.metadata.updateIndex;

          // Calculate the expected state at the operation timestamp
          applySubLoanRepayment(
            subLoan,
            operation.timestamp,
            operation.value,
            operation.id,
          );

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("transfers tokens as expected", async () => {
          await expect(tx).to.changeTokenBalances(
            tokenMock,
            [market, liquidityPoolMock, borrower, repayer, addonTreasury],
            [0, operation.value, -operation.value, 0, 0],
          );
          await checkTokenPath(tx, tokenMock, [borrower, market, liquidityPoolMock], operation.value);
        });

        it("calls the expected liquidity pool function properly", async () => {
          expect(await getNumberOfEvents(tx, liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)).to.equal(1);
          expect(tx).not.to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT);
          await checkEventSequence(tx, [
            [liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN],
            [tokenMock, EVENT_NAME_TRANSFER],
          ]);
          await expect(tx)
            .to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)
            .withArgs(operation.value);
        });

        it("does not call the credit line hook functions", async () => {
          await expectNoCreditLineHookCalls(tx, fixture);
        });
      });

      describe("A discount operation at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            subLoanId: subLoan.id,
            kind: OperationKind.Discount,
            timestamp: 0,
            value: (subLoan.inception.borrowedAmount / 10n),
            account: ADDRESS_ZERO,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanDiscount(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              ADDRESS_ZERO,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanDiscount(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A freezing operation at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.Freezing,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanFreezing(subLoan, operation.timestamp, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanFreezing(subLoan, operation.timestamp, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A freezing operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.Freezing,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          subLoan.metadata.pendingTimestamp = operation.timestamp;
          subLoan.metadata.operationCount += 1;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A unfreezing operation at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let tx: Promise<ContractTransactionResponse>;
        let freezingOp: Operation;
        let unfreezingOp: Operation;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          // First freeze the sub-loan
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.Freezing,
          };
          ({ operation: freezingOp } = await submitOperation(market, operationRequest));
          applySubLoanFreezing(subLoan, freezingOp.timestamp, freezingOp.id);

          // Then submit unfreezing operation
          operationRequest.kind = OperationKind.Unfreezing;
          operationRequest.value = 1n; // Do not change the duration by freeze period for simplicity
          ({ tx, operation: unfreezingOp } = await submitOperation(market, operationRequest));
          unfreezingOp.id = 2; // ID 1 is taken by the freezing operation
          unfreezingOp.prevOperationId = freezingOp.id;
        });

        it("registers the expected operations", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(unfreezingOp.subLoanId);
          expect(actualOperationIds).to.deep.equal([1, unfreezingOp.id]);

          const actualOperationView = await market.getSubLoanOperation(unfreezingOp.subLoanId, unfreezingOp.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(unfreezingOp));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan state as expected (clears freeze timestamp)", async () => {
          applySubLoanUnfreezing(subLoan, unfreezingOp.timestamp, 0n, unfreezingOp.id);
          subLoan.metadata.earliestOperationId = 1; // Fix the earliestOperationId - it should remain 1 (from freezing)
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events (OperationApplied, SubLoanUpdated)", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              subLoan.id,
              unfreezingOp.id,
              unfreezingOp.kind,
              unfreezingOp.timestamp,
              unfreezingOp.value,
              ADDRESS_ZERO,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanUnfreezing(subLoan, unfreezingOp.timestamp, unfreezingOp.value, unfreezingOp.id);
          subLoan.metadata.earliestOperationId = 1; // Remain 1 from freezing

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A unfreezing operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let freezingOp: Operation;
        let unfreezingOp: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");

          // First freeze the sub-loan in the future
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.Freezing,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow,
          };
          ({ operation: freezingOp } = await submitOperation(market, operationRequest));

          // Then submit unfreezing operation in the future
          operationRequest.kind = OperationKind.Unfreezing;
          operationRequest.value = 0n; // Change the duration by freeze period
          ({ tx, operation: unfreezingOp } = await submitOperation(market, operationRequest));
          unfreezingOp.id = 2; // ID 1 is taken by the freezing operation
          unfreezingOp.prevOperationId = freezingOp.id;
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(unfreezingOp.subLoanId);
          expect(actualOperationIds).to.deep.equal([freezingOp.id, unfreezingOp.id]);

          const actualOperationView = await market.getSubLoanOperation(unfreezingOp.subLoanId, unfreezingOp.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(unfreezingOp));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          subLoan.metadata.pendingTimestamp = freezingOp.timestamp;
          subLoan.metadata.operationCount += 2;
          subLoan.metadata.earliestOperationId = freezingOp.id;
          subLoan.metadata.latestOperationId = unfreezingOp.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              unfreezingOp.subLoanId,
              unfreezingOp.id,
              unfreezingOp.kind,
              unfreezingOp.timestamp,
              unfreezingOp.value,
              unfreezingOp.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A primary rate setting op at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.PrimaryRateSetting,
            value: BigInt(subLoan.state.primaryRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanPrimaryRateSetting(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanPrimaryRateSetting(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A primary rate setting operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.PrimaryRateSetting,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
            value: BigInt(subLoan.state.primaryRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          subLoan.metadata.pendingTimestamp = operation.timestamp;
          subLoan.metadata.operationCount += 1;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A secondary rate setting op at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.SecondaryRateSetting,
            value: BigInt(subLoan.state.secondaryRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanSecondaryRateSetting(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanSecondaryRateSetting(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A secondary rate setting operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.SecondaryRateSetting,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
            value: BigInt(subLoan.state.secondaryRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          subLoan.metadata.pendingTimestamp = operation.timestamp;
          subLoan.metadata.operationCount += 1;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A moratory rate setting operation at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.MoratoryRateSetting,
            value: BigInt(subLoan.state.moratoryRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanMoratoryRateSetting(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanMoratoryRateSetting(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A moratory rate setting operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.MoratoryRateSetting,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
            value: BigInt(subLoan.state.moratoryRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          subLoan.metadata.pendingTimestamp = operation.timestamp;
          subLoan.metadata.operationCount += 1;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A late fee rate setting operation at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.LateFeeRateSetting,
            value: BigInt(subLoan.state.lateFeeRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanLateFeeRateSetting(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanLateFeeRateSetting(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A late fee rate setting operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.LateFeeRateSetting,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
            value: BigInt(subLoan.state.lateFeeRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          subLoan.metadata.pendingTimestamp = operation.timestamp;
          subLoan.metadata.operationCount += 1;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A clawback fee rate setting operation at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.ClawbackFeeRateSetting,
            value: BigInt(subLoan.state.clawbackFeeRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanClawbackFeeRateSetting(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanClawbackFeeRateSetting(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A clawback fee rate setting operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.ClawbackFeeRateSetting,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
            value: BigInt(subLoan.state.clawbackFeeRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          subLoan.metadata.pendingTimestamp = operation.timestamp;
          subLoan.metadata.operationCount += 1;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A charge expenses rate setting operation at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.ChargeExpensesRateSetting,
            value: BigInt(subLoan.state.chargeExpensesRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan charge expenses rate as expected", async () => {
          applySubLoanChargeExpensesRateSetting(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events (OperationApplied, SubLoanUpdated)", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanChargeExpensesRateSetting(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A charge expenses rate setting operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.ChargeExpensesRateSetting,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
            value: BigInt(subLoan.state.chargeExpensesRate + INTEREST_RATE_FACTOR / 100),
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("does not change the sub-loan state immediately", async () => {
          subLoan.metadata.pendingTimestamp = operation.timestamp;
          subLoan.metadata.operationCount += 1;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected event (OperationPended)", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A duration setting operation at the current block, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const operationRequest = {
            subLoanId: subLoan.id,
            kind: OperationKind.DurationSetting,
            timestamp: 0,
            value: BigInt(subLoan.inception.initialDuration + 10),
            account: ADDRESS_ZERO,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanDurationSetting(subLoan, operation.timestamp, operation.value, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanDurationSetting(subLoan, operation.timestamp, operation.value, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );

          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_PENDED);
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A duration setting operation in the future, and does the following:", () => {
        let subLoan: SubLoan;
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = activeSubLoan;
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest = {
            subLoanId: subLoan.id,
            kind: OperationKind.DurationSetting,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
            value: BigInt(subLoan.inception.initialDuration + 10),
            account: ADDRESS_ZERO,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          subLoan.metadata.pendingTimestamp = operation.timestamp;
          subLoan.metadata.operationCount += 1;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;

          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_PENDED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          await expect(tx).not.to.emit(market, EVENT_NAME_OPERATION_APPLIED);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_PENDED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfers tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      describe("A principal discount operation at the current block on an overdue sub-loan", () => {
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;
        let discountAmount: bigint;
        let subLoan: SubLoan;

        beforeEach(async () => {
          subLoan = overdueSubLoan;
          discountAmount = 1n; // Unrounded value
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.PrincipalDiscount,
            value: discountAmount,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanPrincipalDiscount(subLoan, operation.timestamp, discountAmount, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanPrincipalDiscount(subLoan, operation.timestamp, discountAmount, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      // NOTE: PrincipalDiscount operations in the future are prohibited (OperationKindProhibitedInFuture)

      describe("A primary interest discount operation at the current block on an overdue sub-loan", () => {
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;
        let discountAmount: bigint;
        let subLoan: SubLoan;

        beforeEach(async () => {
          subLoan = overdueSubLoan;
          discountAmount = 1n; // Unrounded value
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.PrimaryInterestDiscount,
            value: discountAmount,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanPrimaryInterestDiscount(subLoan, operation.timestamp, discountAmount, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanPrimaryInterestDiscount(subLoan, operation.timestamp, discountAmount, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      // NOTE: PrimaryInterestDiscount operations in the future are prohibited (OperationKindProhibitedInFuture)

      describe("A secondary interest discount operation at the current block on an overdue sub-loan", () => {
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;
        let discountAmount: bigint;
        let subLoan: SubLoan;

        beforeEach(async () => {
          subLoan = overdueSubLoan;
          discountAmount = 1n; // Unrounded value
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.SecondaryInterestDiscount,
            value: discountAmount,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanSecondaryInterestDiscount(subLoan, operation.timestamp, discountAmount, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanSecondaryInterestDiscount(subLoan, operation.timestamp, discountAmount, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      // NOTE: SecondaryInterestDiscount operations in the future are prohibited (OperationKindProhibitedInFuture)

      describe("A moratory interest discount operation at the current block on an overdue sub-loan", () => {
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;
        let discountAmount: bigint;
        let subLoan: SubLoan;

        beforeEach(async () => {
          subLoan = overdueSubLoan;
          discountAmount = 1n; // Unrounded value
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.MoratoryInterestDiscount,
            value: discountAmount,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanMoratoryInterestDiscount(subLoan, operation.timestamp, discountAmount, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanMoratoryInterestDiscount(subLoan, operation.timestamp, discountAmount, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      // NOTE: MoratoryInterestDiscount operations in the future are prohibited (OperationKindProhibitedInFuture)

      describe("A late fee discount operation at the current block on an overdue sub-loan", () => {
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;
        let discountAmount: bigint;
        let subLoan: SubLoan;

        beforeEach(async () => {
          subLoan = overdueSubLoan;
          discountAmount = 1n; // Unrounded value
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.LateFeeDiscount,
            value: discountAmount,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanLateFeeDiscount(subLoan, operation.timestamp, discountAmount, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanLateFeeDiscount(subLoan, operation.timestamp, discountAmount, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      // NOTE: LateFeeDiscount operations in the future are prohibited (OperationKindProhibitedInFuture)

      describe("A clawback fee discount operation at the current block on an overdue sub-loan", () => {
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;
        let discountAmount: bigint;
        let subLoan: SubLoan;

        beforeEach(async () => {
          subLoan = overdueSubLoan;
          discountAmount = 1n; // Unrounded value
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.ClawbackFeeDiscount,
            value: discountAmount,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanClawbackFeeDiscount(subLoan, operation.timestamp, discountAmount, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanClawbackFeeDiscount(subLoan, operation.timestamp, discountAmount, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      // NOTE: ClawbackFeeDiscount operations in the future are prohibited (OperationKindProhibitedInFuture)

      describe("A charge expenses discount operation at the current block on an overdue sub-loan", () => {
        let operation: Operation;
        let tx: Promise<ContractTransactionResponse>;
        let discountAmount: bigint;
        let subLoan: SubLoan;

        beforeEach(async () => {
          subLoan = overdueSubLoan;
          discountAmount = 1n; // Unrounded value
          const operationRequest: OperationRequest = {
            ...defaultOperationRequest,
            subLoanId: subLoan.id,
            kind: OperationKind.ChargeExpensesDiscount,
            value: discountAmount,
          };
          ({ tx, operation } = await submitOperation(market, operationRequest));
        });

        it("registers the expected operation", async () => {
          const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
          expect(actualOperationIds).to.deep.equal([operation.id]);

          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("does not register a new address in the address book", async () => {
          expect(await market.getAccountAddressBookRecordCount()).to.equal(0);
        });

        it("changes the sub-loan as expected", async () => {
          applySubLoanChargeExpensesDiscount(subLoan, operation.timestamp, discountAmount, operation.id);
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED);
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );

          const updateIndex = subLoan.metadata.updateIndex;
          applySubLoanChargeExpensesDiscount(subLoan, operation.timestamp, discountAmount, operation.id);

          await expect(tx)
            .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
            .withArgs(
              subLoan.id,
              updateIndex,
              toBytes32(packSubLoanParameters(subLoan)),
              toBytes32(packRates(subLoan)),
              toBytes32(packSubLoanPrincipalParts(subLoan)),
              toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
              toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
              toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
              toBytes32(packSubLoanLateFeeParts(subLoan)),
              toBytes32(packSubLoanClawbackFeeParts(subLoan)),
              toBytes32(packSubLoanChargeExpensesParts(subLoan)),
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });

      // NOTE: ChargeExpensesDiscount operations in the future are prohibited (OperationKindProhibitedInFuture)
    });

    describe("Is reverted if", () => {
      let subLoan: SubLoan;
      let repaymentOperationRequest: OperationRequest;

      beforeEach(async () => {
        subLoan = overdueSubLoan;
        repaymentOperationRequest = {
          subLoanId: subLoan.id,
          kind: OperationKind.Repayment,
          timestamp: 0,
          value: (subLoan.inception.borrowedAmount / 10n),
          account: repayer.address,
        };
      });

      it("the caller does not have the admin role", async () => {
        const { subLoanId, kind, timestamp, value, account } = repaymentOperationRequest;
        await expect(market.connect(deployer).submitOperation(subLoanId, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(deployer.address, ADMIN_ROLE);
        await expect(market.connect(stranger).submitOperation(subLoanId, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(stranger.address, ADMIN_ROLE);
      });

      it("the contract is paused", async () => {
        await proveTx(market.connect(pauser).pause());

        const { subLoanId, kind, timestamp, value, account } = repaymentOperationRequest;
        await expect(market.connect(admin).submitOperation(subLoanId, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ENFORCED_PAUSED);
      });

      it("the block timestamp is greater than the maximum allowed value", async () => {
        // Skip this test if the network is not Hardhat
        if (network.name !== "hardhat") {
          return;
        }

        await increaseBlockTimestampTo(Number(maxUintForBits(32)) + 1);

        const { subLoanId, kind, timestamp, value, account } = repaymentOperationRequest;
        await expect(market.connect(admin).submitOperation(subLoanId, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_BLOCK_TIMESTAMP_EXCESS);
      });

      it("the sub-loan does not exist", async () => {
        const wrongSubLoanId = subLoan.id + 100n;
        const { kind, timestamp, value, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(wrongSubLoanId, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_NONEXISTENT);
      });

      it("the operation kinds is zero", async () => {
        const kind = OperationKind.Nonexistent;
        const { timestamp, value, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_KIND_INVALID);
      });

      it("the operation kinds is greater than allowed", async () => {
        const kind = OperationKind.ChargeExpensesDiscount + 1;
        const { timestamp, value, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_KIND_INVALID);
      });

      it("the operation is revocation", async () => {
        const kind = OperationKind.Revocation;
        const { timestamp, value, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_KIND_UNACCEPTABLE);
      });

      it("the operation timestamp is earlier than the sub-loan start timestamp", async () => {
        const timestamp = subLoan.inception.startTimestamp - 1;
        const { kind, value, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_TIMESTAMP_TOO_EARLY);
      });

      it("the operation timestamp is greater than uint32 max value", async () => {
        const timestamp = Number(maxUintForBits(32) + 1n);
        const { kind, value, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_TIMESTAMP_EXCESS);
      });

      it("the sub-loan is revoked", async () => {
        await proveTx(market.connect(admin).revokeLoan(subLoan.id));

        const { kind, value, timestamp, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_REVOKED);
      });

      it("the liquidity pool hook call is reverted", async () => {
        await proveTx(liquidityPoolMock.setRevertOnBeforeLiquidityIn(true));

        const { kind, timestamp, value, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(liquidityPoolMock, ERROR_NAME_LIQUIDITY_POOL_ON_BEFORE_LIQUIDITY_IN_REVERTED);
      });

      it("the repayment amount is zero", async () => {
        const value = 0n;
        const { kind, timestamp, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_REPAYMENT_OR_DISCOUNT_AMOUNT_ZERO);
      });

      it("the repayment amount is not financially rounded", async () => {
        const value = ACCURACY_FACTOR + 1n;
        const { kind, timestamp, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_REPAYMENT_OR_DISCOUNT_AMOUNT_UNROUNDED);
      });

      it("the repayment amount exceeds the tracked balance", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        advanceSubLoan(subLoan, currentBlockTimestamp);
        const roundedTrackedBalance = calculateOutstandingBalance(subLoan);

        const value = roundedTrackedBalance + ACCURACY_FACTOR;
        const { kind, timestamp, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_REPAYMENT_EXCESS);
      });

      it("the repayment account address is zero", async () => {
        const account = (ADDRESS_ZERO);
        const { kind, timestamp, value } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_REPAYER_ADDRESS_ZERO);
      });

      it("the repayment operation is scheduled in the future", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        const timestamp = currentBlockTimestamp + 24 * 3600; // Tomorrow
        const { kind, value, account } = repaymentOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_KIND_PROHIBITED_IN_FUTURE);
      });

      it("the general discount amount is zero", async () => {
        const kind = OperationKind.Discount;
        const value = 0n;
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_REPAYMENT_OR_DISCOUNT_AMOUNT_ZERO);
      });

      it("the general discount amount is not financially rounded", async () => {
        const kind = OperationKind.Discount;
        const value = ACCURACY_FACTOR + 1n;
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_REPAYMENT_OR_DISCOUNT_AMOUNT_UNROUNDED);
      });

      it("the general discount amount exceeds the tracked balance", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        advanceSubLoan(subLoan, currentBlockTimestamp);
        const roundedTrackedBalance = calculateOutstandingBalance(subLoan);

        const kind = OperationKind.Discount;
        const value = roundedTrackedBalance + ACCURACY_FACTOR; // Exceeds tracked balance
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DISCOUNT_EXCESS);
      });

      it("the general discount operation is scheduled in the future", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        const kind = OperationKind.Discount;
        const value = ACCURACY_FACTOR;
        const timestamp = currentBlockTimestamp + 24 * 3600; // Tomorrow
        const account = (ADDRESS_ZERO);

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_KIND_PROHIBITED_IN_FUTURE);
      });

      it("the freezing operation is applied to an already frozen sub-loan", async () => {
        const kind = OperationKind.Freezing;
        const { timestamp, value, account } = defaultOperationRequest;

        await proveTx(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account));

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_FROZEN_ALREADY);
      });

      it("the freezing operation has non-zero value", async () => {
        const kind = OperationKind.Freezing;
        const wrongValue = 1n;
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_VALUE_NONZERO);
      });

      it("the unfreezing operation is applied to a non-frozen sub-loan", async () => {
        const kind = OperationKind.Unfreezing;
        const { timestamp, value, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_NOT_FROZEN);
      });

      it("the unfreezing operation has value greater than 1", async () => {
        // First freeze the sub-loan
        {
          const kind = OperationKind.Freezing;
          const { timestamp, value, account } = defaultOperationRequest;
          await proveTx(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account));
        }

        // Try to unfreeze with value > 1
        {
          const kind = OperationKind.Unfreezing;
          const wrongValue = 2n; // Value > 1 is not allowed for unfreezing
          const { timestamp, account } = defaultOperationRequest;

          await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongValue, account))
            .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_VALUE_EXCESS);
        }
      });

      it("the primary rate value exceeds the maximum allowed one", async () => {
        const kind = OperationKind.PrimaryRateSetting;
        const wrongRateValue = BigInt(INTEREST_RATE_FACTOR + 1);
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongRateValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("the secondary rate value exceeds the maximum allowed one", async () => {
        const kind = OperationKind.SecondaryRateSetting;
        const wrongRateValue = BigInt(INTEREST_RATE_FACTOR + 1);
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongRateValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("the moratory rate value exceeds the maximum allowed one", async () => {
        const kind = OperationKind.MoratoryRateSetting;
        const wrongRateValue = BigInt(INTEREST_RATE_FACTOR + 1);
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongRateValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("the late fee rate value exceeds the maximum allowed one", async () => {
        const kind = OperationKind.LateFeeRateSetting;
        const wrongRateValue = BigInt(INTEREST_RATE_FACTOR + 1);
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongRateValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("the clawback fee rate value exceeds the maximum allowed one", async () => {
        const kind = OperationKind.ClawbackFeeRateSetting;
        const wrongRateValue = BigInt(INTEREST_RATE_FACTOR + 1);
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongRateValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("the charge expenses rate value exceeds the maximum allowed one", async () => {
        const kind = OperationKind.ChargeExpensesRateSetting;
        const wrongRateValue = BigInt(INTEREST_RATE_FACTOR + 1);
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongRateValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_RATE_VALUE_EXCESS);
      });

      it("the duration setting value is zero", async () => {
        const kind = OperationKind.DurationSetting;
        const wrongDurationValue = 0n;
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDurationValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DURATION_INVALID);
      });

      it("the duration setting value exceeds the allowed maximum one", async () => {
        const kind = OperationKind.DurationSetting;
        const wrongDurationValue = BigInt(maxUintForBits(16) + 1n);
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDurationValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DURATION_INVALID);
      });

      it("the principal discount amount exceeds tracked principal one", async () => {
        const kind = OperationKind.PrincipalDiscount;
        const wrongDiscountValue = subLoan.state.trackedPrincipal + 1n; // Exceeds tracked principal
        const { timestamp, account } = defaultOperationRequest;

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDiscountValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DISCOUNT_PART_EXCESS);
      });

      it("the principal discount operation is scheduled in the future", async () => {
        const kind = OperationKind.PrincipalDiscount;
        const timestamp = await getBlockTimestamp("latest") + 24 * 3600; // Tomorrow
        const value = 1n;
        const account = (ADDRESS_ZERO);

        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_KIND_PROHIBITED_IN_FUTURE);
      });

      it("the primary interest discount amount exceeds tracked primary interest one", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        advanceSubLoan(subLoan, currentBlockTimestamp);

        const kind = OperationKind.PrimaryInterestDiscount;
        const wrongDiscountValue = subLoan.state.trackedPrimaryInterest + 1n; // Exceeds tracked primary interest
        const { timestamp, account } = defaultOperationRequest;
        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDiscountValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DISCOUNT_PART_EXCESS);
      });

      it("the secondary interest discount amount exceeds tracked secondary interest", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        advanceSubLoan(subLoan, currentBlockTimestamp);

        const kind = OperationKind.SecondaryInterestDiscount;
        const wrongDiscountValue = subLoan.state.trackedSecondaryInterest + 1n; // Exceeds tracked secondary interest
        const { timestamp, account } = defaultOperationRequest;
        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDiscountValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DISCOUNT_PART_EXCESS);
      });

      it("the moratory interest discount amount exceeds tracked moratory interest", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        advanceSubLoan(subLoan, currentBlockTimestamp);

        const kind = OperationKind.MoratoryInterestDiscount;
        const wrongDiscountValue = subLoan.state.trackedMoratoryInterest + 1n; // Exceeds tracked moratory interest
        const { timestamp, account } = defaultOperationRequest;
        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDiscountValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DISCOUNT_PART_EXCESS);
      });

      it("the late fee discount amount exceeds tracked late fee", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        advanceSubLoan(subLoan, currentBlockTimestamp);

        const kind = OperationKind.LateFeeDiscount;
        const wrongDiscountValue = subLoan.state.trackedLateFee + 1n; // Exceeds tracked late fee
        const { timestamp, account } = defaultOperationRequest;
        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDiscountValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DISCOUNT_PART_EXCESS);
      });

      it("the clawback fee discount amount exceeds tracked clawback fee", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        advanceSubLoan(subLoan, currentBlockTimestamp);

        const kind = OperationKind.ClawbackFeeDiscount;
        const wrongDiscountValue = subLoan.state.trackedClawbackFee + 1n; // Exceeds tracked clawback fee
        const { timestamp, account } = defaultOperationRequest;
        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDiscountValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DISCOUNT_PART_EXCESS);
      });

      it("the charge expenses discount amount exceeds tracked charge expenses", async () => {
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        advanceSubLoan(subLoan, currentBlockTimestamp);

        const kind = OperationKind.ChargeExpensesDiscount;
        const wrongDiscountValue = subLoan.state.trackedChargeExpenses + 1n; // Exceeds tracked charge expenses
        const { timestamp, account } = defaultOperationRequest;
        await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, wrongDiscountValue, account))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_DISCOUNT_PART_EXCESS);
      });

      it("the non-repayment operation has non-zero account", async () => {
        const timestamp = await getBlockTimestamp("latest");
        const account = repayer.address;
        const kindValues = Object.values(OperationKind).filter(
          v => typeof v === "number",
        );
        for (const kind of kindValues) {
          let value = 0n; // Should be suitable for most interested operation kind
          switch (kind) {
            case OperationKind.Repayment:
            case OperationKind.Nonexistent:
            case OperationKind.Revocation:
              continue;
            case OperationKind.DurationSetting:
              value = BigInt(subLoan.inception.initialDuration + 1);
              break;
          }
          // Use try-catch to add the kind to the error message
          try {
            await expect(market.connect(admin).submitOperation(subLoan.id, kind, timestamp, value, account))
              .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_ACCOUNT_NONZERO);
          } catch (error) {
            throw new Error(`Failed for kind: ${OperationKind[kind]} (${kind}). ${error}`);
          }
        }
      });
    });
  });

  // TODO: Consider a test case when voiding an operation breaks something in the future.

  describe("Function 'voidOperation()'", () => {
    let fixture: Fixture;
    let market: Contracts.LendingMarketV2Testable;
    let tokenMock: Contracts.ERC20TokenMock;
    let liquidityPoolMock: Contracts.LiquidityPoolMock;
    let loan: Loan;

    beforeEach(async () => {
      fixture = await setUpFixture(deployAndConfigureContractsForLoanTaking);
      ({ market, tokenMock, liquidityPoolMock } = fixture);
      loan = await takeTypicalLoan(fixture, { subLoanCount: 3 });
    });

    describe("Executes as expected when called properly in simple cases for", () => {
      describe("A repayment operation in the past", () => {
        let operation: Operation;
        let subLoan: SubLoan;
        let tx: Promise<ContractTransactionResponse>;
        let txTimestamp: number;
        let counterpartyAddress: string;

        beforeEach(async () => {
          subLoan = loan.subLoans[1];
          const operationRequest: OperationRequest = {
            subLoanId: subLoan.id,
            kind: OperationKind.Repayment,
            timestamp: 0, // Current block
            value: loan.subLoans[1].inception.borrowedAmount / 10n,
            account: repayer.address,
          };
          ({ operation } = await submitOperation(market, operationRequest));
        });

        for (const hasCounterparty of [true, false]) {
          describe(`${hasCounterparty ? "With a" : "With no"} counterparty, and does the following`, () => {
            beforeEach(async () => {
              counterpartyAddress = hasCounterparty ? counterparty.address : ADDRESS_ZERO;
              tx = market.connect(admin).voidOperation(operation.subLoanId, operation.id, counterpartyAddress);
              txTimestamp = await getTxTimestamp(tx);
            });

            it("changes the operation status as expected", async () => {
              const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
              operation.status = OperationStatus.Revoked;
              checkEquality(resultToObject(actualOperationView), getOperationView(operation));
            });

            it("changes the sub-loan as expected", async () => {
              applySubLoanRepayment(subLoan, operation.timestamp, operation.value, operation.id);
              resetSubLoanState(subLoan);
              subLoan.metadata.updateIndex += 1;
              await checkSubLoanInContract(market, subLoan);
            });

            it("emits the expected events", async () => {
              expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_REVOKED)).to.equal(1);
              expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

              await expect(tx)
                .to.emit(market, EVENT_NAME_OPERATION_REVOKED)
                .withArgs(
                  operation.subLoanId,
                  operation.id,
                  operation.kind,
                  operation.timestamp,
                  operation.value,
                  repayer.address,
                  counterpartyAddress,
                );

              applySubLoanRepayment(subLoan, txTimestamp, operation.value, operation.id);
              resetSubLoanState(subLoan);

              await expect(tx)
                .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
                .withArgs(
                  subLoan.id,
                  subLoan.metadata.updateIndex,
                  toBytes32(packSubLoanParameters(subLoan)),
                  toBytes32(packRates(subLoan)),
                  toBytes32(packSubLoanPrincipalParts(subLoan)),
                  toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
                  toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
                  toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
                  toBytes32(packSubLoanLateFeeParts(subLoan)),
                  toBytes32(packSubLoanClawbackFeeParts(subLoan)),
                  toBytes32(packSubLoanChargeExpensesParts(subLoan)),
                );
            });

            if (hasCounterparty) {
              it("transfers tokens as expected", async () => {
                await expect(tx).to.changeTokenBalances(
                  tokenMock,
                  [market, liquidityPoolMock, borrower, repayer, counterparty, addonTreasury],
                  [0, -operation.value, 0, 0, operation.value, 0],
                );
                await checkTokenPath(tx, tokenMock, [liquidityPoolMock, market, counterparty], operation.value);
              });

              it("calls the expected liquidity pool function properly", async () => {
                await expect(tx).not.to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN);
                expect(await getNumberOfEvents(tx, liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT)).to.equal(1);
                await checkEventSequence(tx, [
                  [liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT],
                  [tokenMock, EVENT_NAME_TRANSFER],
                ]);
                await expect(tx)
                  .to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT)
                  .withArgs(operation.value);
              });
            } else {
              it("does not transfer tokens", async () => {
                await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
              });

              it("does not call the liquidity pool hook functions", async () => {
                await expectNoLiquidityPoolHookCalls(tx, fixture);
              });
            }

            it("does not call the credit line hook functions", async () => {
              await expectNoCreditLineHookCalls(tx, fixture);
            });
          });
        }
      });

      describe("A secondary rate setting operation in the future, and does the following", () => {
        let operation: Operation;
        let subLoan: SubLoan;
        let tx: Promise<ContractTransactionResponse>;

        beforeEach(async () => {
          subLoan = loan.subLoans[1];
          const currentBlockTimestamp = await getBlockTimestamp("latest");
          const operationRequest: OperationRequest = {
            subLoanId: subLoan.id,
            kind: OperationKind.SecondaryRateSetting,
            timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
            value: BigInt(subLoan.state.secondaryRate + INTEREST_RATE_FACTOR / 100),
            account: (ADDRESS_ZERO),
          };
          ({ operation } = await submitOperation(market, operationRequest));

          const counterpartyAddress = (ADDRESS_ZERO);
          tx = market.connect(admin).voidOperation(operation.subLoanId, operation.id, counterpartyAddress);
          await getTxTimestamp(tx);
        });

        it("changes the operation status as expected", async () => {
          const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
          operation.status = OperationStatus.Dismissed;
          checkEquality(resultToObject(actualOperationView), getOperationView(operation));
        });

        it("changes the sub-loan as expected", async () => {
          ++subLoan.metadata.operationCount;
          subLoan.metadata.earliestOperationId = operation.id;
          subLoan.metadata.latestOperationId = operation.id;
          await checkSubLoanInContract(market, subLoan);
        });

        it("emits the expected events", async () => {
          expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_DISMISSED)).to.equal(1);
          await expect(tx).not.to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED);

          await expect(tx)
            .to.emit(market, EVENT_NAME_OPERATION_DISMISSED)
            .withArgs(
              operation.subLoanId,
              operation.id,
              operation.kind,
              operation.timestamp,
              operation.value,
              operation.account,
            );
        });

        it("does not transfer tokens", async () => {
          await expect(tx).not.to.emit(tokenMock, EVENT_NAME_TRANSFER);
        });

        it("does not call the liquidity pool or credit line hook functions", async () => {
          await expectNoHookCalls(tx, fixture);
        });
      });
    });

    describe("Is reverted if", () => {
      let subLoan: SubLoan;
      let operation: Operation;

      beforeEach(async () => {
        subLoan = loan.subLoans[0];
        const operationRequest: OperationRequest = {
          subLoanId: subLoan.id,
          kind: OperationKind.Repayment,
          timestamp: 0,
          value: ACCURACY_FACTOR,
          account: repayer.address,
        };
        ({ operation } = await submitOperation(market, operationRequest));
      });

      it("the caller does not have the admin role", async () => {
        await expect(market.connect(deployer).voidOperation(subLoan.id, operation.id, counterparty.address))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(deployer.address, ADMIN_ROLE);
        await expect(market.connect(stranger).voidOperation(subLoan.id, operation.id, counterparty.address))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(stranger.address, ADMIN_ROLE);
      });

      it("the contract is paused", async () => {
        await proveTx(market.connect(pauser).pause());

        await expect(market.connect(admin).voidOperation(subLoan.id, operation.id, counterparty.address))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ENFORCED_PAUSED);
      });

      it("the block timestamp is greater than the maximum allowed value", async () => {
        // Skip this test if the network is not Hardhat
        if (network.name !== "hardhat") {
          return;
        }

        await increaseBlockTimestampTo(Number(maxUintForBits(32)) + 1);

        await expect(market.connect(admin).voidOperation(subLoan.id, operation.id, counterparty.address))
          .to.be.revertedWithCustomError(market, ERROR_NAME_BLOCK_TIMESTAMP_EXCESS);
      });

      it("the sub-loan provided in the request does not exist", async () => {
        const wrongSubLoanId = loan.subLoans[loan.subLoans.length - 1].id + 1n;

        await expect(market.connect(admin).voidOperation(wrongSubLoanId, operation.id, counterparty.address))
          .to.be.revertedWithCustomError(market, ERROR_NAME_SUB_LOAN_NONEXISTENT);
      });

      it("the operation ID in the request is zero", async () => {
        const wrongOperationId = 0;

        await expect(market.connect(admin).voidOperation(subLoan.id, wrongOperationId, counterparty.address))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_NONEXISTENT)
          .withArgs(subLoan.id, wrongOperationId);
      });

      it("the operation ID in the request corresponds to a nonexistent operation", async () => {
        const wrongOperationId = operation.id + 1;

        await expect(market.connect(admin).voidOperation(subLoan.id, wrongOperationId, counterparty.address))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_NONEXISTENT)
          .withArgs(subLoan.id, wrongOperationId);
      });

      it("the operation is already revoked", async () => {
        await proveTx(market.connect(admin).voidOperation(subLoan.id, operation.id, counterparty.address));

        await expect(market.connect(admin).voidOperation(subLoan.id, operation.id, counterparty.address))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_REVOKED_ALREADY)
          .withArgs(subLoan.id, operation.id);
      });

      it("the operation is already dismissed", async () => {
        const subLoan = loan.subLoans[1];
        const currentBlockTimestamp = await getBlockTimestamp("latest");
        const rateSettingOperationRequest: OperationRequest = {
          ...defaultOperationRequest,
          subLoanId: subLoan.id,
          kind: OperationKind.SecondaryRateSetting,
          timestamp: currentBlockTimestamp + 24 * 3600, // Tomorrow
          value: 0n,
        };
        const { operation: rateSettingOperation } = await submitOperation(market, rateSettingOperationRequest);
        const counterpartyAddress = ADDRESS_ZERO;
        await proveTx(market.connect(admin).voidOperation(subLoan.id, rateSettingOperation.id, counterpartyAddress));

        await expect(market.connect(admin).voidOperation(subLoan.id, rateSettingOperation.id, counterpartyAddress))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_DISMISSED_ALREADY)
          .withArgs(subLoan.id, rateSettingOperation.id);
      });
    });
  });

  describe("Function 'repaySubLoan()'", () => {
    let fixture: Fixture;
    let market: Contracts.LendingMarketV2Testable;
    let tokenMock: Contracts.ERC20TokenMock;
    let liquidityPoolMock: Contracts.LiquidityPoolMock;
    let loan: Loan;
    let subLoan: SubLoan; // Overdue sub-loan (index 0, duration 30 day, started 33 days ago)

    beforeEach(async () => {
      fixture = await setUpFixture(deployAndConfigureContractsForLoanTaking);
      ({ market, tokenMock, liquidityPoolMock } = fixture);
      // Take a loan with 1 sub-loan, not overdue
      loan = await takeTypicalLoan(fixture, { subLoanCount: 1, daysAgo: 3 });
      subLoan = loan.subLoans[0];
    });

    describe("Executes as expected when called properly in a simple case and does the following", () => {
      let operation: Operation;
      let tx: Promise<ContractTransactionResponse>;

      async function repaySubLoan(
        market: Contracts.LendingMarketV2,
        subLoan: SubLoan,
        amount: bigint,
        repayer: string,
      ): Promise<{
        tx: Promise<ContractTransactionResponse>;
        operation: Operation;
      }> {
        const operationRequest: OperationRequest = {
          subLoanId: subLoan.id,
          kind: OperationKind.Repayment,
          timestamp: 0,
          value: amount,
          account: repayer,
        };

        const tx = market.connect(admin).repaySubLoan(
          subLoan.id,
          repayer,
          amount,
        );
        const txTimestamp = await getTxTimestamp(tx);

        const expectedOperationId = 1;
        const operation = createOperation(operationRequest, expectedOperationId, txTimestamp);
        operation.status = OperationStatus.Applied;

        return { tx, operation };
      }

      beforeEach(async () => {
        const amount = subLoan.inception.borrowedAmount / 10n;
        ({ tx, operation } = await repaySubLoan(market, subLoan, amount, repayer.address));
      });

      it("registers the expected operation", async () => {
        const actualOperationIds = await market.getSubLoanOperationIds(operation.subLoanId);
        expect(actualOperationIds).to.deep.equal([operation.id]);

        const actualOperationView = await market.getSubLoanOperation(operation.subLoanId, operation.id);
        checkEquality(resultToObject(actualOperationView), getOperationView(operation));
      });

      it("changes the sub-loan as expected", async () => {
        applySubLoanRepayment(subLoan, operation.timestamp, operation.value, operation.id);
        await checkSubLoanInContract(market, subLoan);
      });

      it("registers a new address in the address book as expected", async () => {
        const accountId = (1);
        expect(await market.getAccountAddressBookRecordCount()).to.equal(1);
        expect(await market.getAccountInAddressBook(accountId)).to.equal(repayer.address);
      });

      it("emits the expected events", async () => {
        expect(await getNumberOfEvents(tx, market, EVENT_NAME_OPERATION_APPLIED)).to.equal(1);
        expect(await getNumberOfEvents(tx, market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED)).to.equal(1);
        expect(await getNumberOfEvents(tx, market, EVENT_NAME_SUB_LOAN_UPDATED)).to.equal(1);

        await expect(tx)
          .to.emit(market, EVENT_NAME_OPERATION_APPLIED)
          .withArgs(
            operation.subLoanId,
            operation.id,
            operation.kind,
            operation.timestamp,
            operation.value,
            repayer.address,
          );

        expect(tx).to.emit(market, EVENT_NAME_ADDRESS_BOOK_ACCOUNT_ADDED).withArgs(repayer.address, 1);

        const updateIndex = subLoan.metadata.updateIndex;
        applySubLoanRepayment(subLoan, operation.timestamp, operation.value, operation.id);

        await expect(tx)
          .to.emit(market, EVENT_NAME_SUB_LOAN_UPDATED)
          .withArgs(
            subLoan.id,
            updateIndex,
            toBytes32(packSubLoanParameters(subLoan)),
            toBytes32(packRates(subLoan)),
            toBytes32(packSubLoanPrincipalParts(subLoan)),
            toBytes32(packSubLoanPrimaryInterestParts(subLoan)),
            toBytes32(packSubLoanSecondaryInterestParts(subLoan)),
            toBytes32(packSubLoanMoratoryInterestParts(subLoan)),
            toBytes32(packSubLoanLateFeeParts(subLoan)),
            toBytes32(packSubLoanClawbackFeeParts(subLoan)),
            toBytes32(packSubLoanChargeExpensesParts(subLoan)),
          );
      });

      it("transfers tokens as expected", async () => {
        await expect(tx).to.changeTokenBalances(
          tokenMock,
          [market, liquidityPoolMock, borrower, repayer, addonTreasury],
          [0, operation.value, 0, -operation.value, 0],
        );
        await checkTokenPath(tx, tokenMock, [repayer, market, liquidityPoolMock], operation.value);
      });

      it("calls the expected liquidity pool function properly", async () => {
        expect(await getNumberOfEvents(tx, liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)).to.equal(1);
        expect(tx).not.to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_OUT);
        await checkEventSequence(tx, [
          [liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN],
          [tokenMock, EVENT_NAME_TRANSFER],
        ]);
        await expect(tx)
          .to.emit(liquidityPoolMock, EVENT_NAME_MOCK_LIQUIDITY_IN)
          .withArgs(operation.value);
      });

      it("does not call the credit line hook functions", async () => {
        await expectNoCreditLineHookCalls(tx, fixture);
      });
    });

    // NOTE: Other positive test cases are skipped because
    // the `repaySubLoan()` function is just a shortcut for the `submitOperation()` one

    describe("Is reverted if", () => {
      const repaymentAmount = ACCURACY_FACTOR;

      it("the caller does not have the admin role", async () => {
        await expect(market.connect(deployer).repaySubLoan(subLoan.id, repayer.address, repaymentAmount))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(deployer.address, ADMIN_ROLE);
        await expect(market.connect(stranger).repaySubLoan(subLoan.id, repayer.address, repaymentAmount))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ACCESS_CONTROL_UNAUTHORIZED_ACCOUNT)
          .withArgs(stranger.address, ADMIN_ROLE);
      });

      it("the contract is paused", async () => {
        await proveTx(market.connect(pauser).pause());

        await expect(market.connect(admin).repaySubLoan(subLoan.id, repayer.address, repaymentAmount))
          .to.be.revertedWithCustomError(market, ERROR_NAME_ENFORCED_PAUSED);
      });

      // NOTE: Other negative test cases are skipped because
      // the `repaySubLoan()` function is just a shortcut for the `submitOperation()` one
    });
  });

  describe("Function 'delegateToEngine()'", () => {
    it("cannot be called from an external account", async () => {
      const { market } = await setUpFixture(deployContracts);

      await expect(market.connect(deployer).delegateToEngine("0x"))
        .to.be.revertedWithCustomError(market, ERROR_NAME_CALL_CONTEXT_UNAUTHORIZED);
    });
  });

  describe("Function 'getSubLoanPreview()'", () => {
    let fixture: Fixture;
    let market: Contracts.LendingMarketV2Testable;
    let subLoan: SubLoan;

    beforeEach(async () => {
      fixture = await setUpFixture(deployAndConfigureContractsForLoanTaking);
      ({ market } = fixture);
      const loan = await takeTypicalLoan(fixture, { subLoanCount: 3 });
      subLoan = loan.subLoans[2];
    });

    describe("Executes as expected for different timestamps after the sub-loan started", () => {
      function defineExpectedPreview(subLoan: SubLoan, timestamp: number): SubLoanPreview {
        const preview = defineExpectedSubLoanPreview(subLoan);

        preview.day = dayIndex(timestamp);
        preview.daysSinceStart = preview.day - dayIndex(subLoan.inception.startTimestamp);
        preview.trackedTimestamp = timestamp;

        const daysUpToDue = preview.daysSinceStart > subLoan.inception.initialDuration
          ? subLoan.inception.initialDuration
          : preview.daysSinceStart;
        const daysPostDue = preview.daysSinceStart - daysUpToDue;

        preview.trackedPrimaryInterest = calculateCompoundInterest(
          preview.trackedPrincipal,
          preview.primaryRate,
          daysUpToDue,
        );

        if (daysPostDue > 0) {
          const legalPrincipal = preview.trackedPrincipal + preview.trackedPrimaryInterest;
          preview.trackedSecondaryInterest =
            calculateCompoundInterest(legalPrincipal, preview.secondaryRate, daysPostDue);
          preview.trackedMoratoryInterest = calculateSimpleInterest(legalPrincipal, preview.moratoryRate, daysPostDue);
          preview.trackedLateFee = calculateSimpleInterest(legalPrincipal, preview.lateFeeRate, 1);
          preview.trackedClawbackFee = calculateCompoundInterest(legalPrincipal, preview.clawbackFeeRate, daysUpToDue);
          preview.trackedChargeExpenses = calculateSimpleInterest(legalPrincipal, preview.chargeExpensesRate, 1);
        }

        preview.outstandingBalance = roundFinancially(
          preview.trackedPrincipal +
          preview.trackedPrimaryInterest +
          preview.trackedSecondaryInterest +
          preview.trackedMoratoryInterest +
          preview.trackedLateFee +
          preview.trackedClawbackFee +
          preview.trackedChargeExpenses,
        );

        return preview;
      }

      async function checkPreview(subLoan: SubLoan, timestamp: number) {
        const expectedPreview = defineExpectedPreview(subLoan, timestamp);
        const actualPreview = await market.getSubLoanPreview(subLoan.id, timestamp);
        checkEquality(
          resultToObject(actualPreview),
          expectedPreview,
          subLoan.indexInLoan,
        );
      }

      it("one day before the due date", async () => {
        const timestamp = subLoan.inception.startTimestamp + (subLoan.inception.initialDuration - 1) * DAY_IN_SECONDS;
        await checkPreview(subLoan, timestamp);
      });

      it("at the due date", async () => {
        const timestamp = subLoan.inception.startTimestamp + subLoan.inception.initialDuration * DAY_IN_SECONDS;
        await checkPreview(subLoan, timestamp);
      });

      it("one day after the due date", async () => {
        const timestamp = subLoan.inception.startTimestamp + (subLoan.inception.initialDuration + 1) * DAY_IN_SECONDS;
        await checkPreview(subLoan, timestamp);
      });

      it("ten day after the due date", async () => {
        const timestamp = subLoan.inception.startTimestamp + (subLoan.inception.initialDuration + 10) * DAY_IN_SECONDS;
        await checkPreview(subLoan, timestamp);
      });
    });

    describe("Is reverted if", () => {
      it("the requested timestamp is earlier than the sub-loan start timestamp", async () => {
        const wrongTimestamp = subLoan.inception.startTimestamp - 1;
        await expect(market.getSubLoanPreview(subLoan.id, wrongTimestamp))
          .to.be.revertedWithCustomError(market, ERROR_NAME_OPERATION_APPLYING_TIMESTAMP_TOO_EARLY);
      });
    });
  });
});
