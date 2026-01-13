/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * Collects deployment information from OpenZeppelin manifest files
 * and outputs a JSON file with all proxy/implementation/beacon addresses.
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface ProxyEntry {
  address: string;
  txHash: string;
  kind: "uups" | "transparent" | "beacon";
  cw_tag?: string;
}

interface ImplEntry {
  address: string;
  txHash: string;
}

interface AdminEntry {
  address: string;
  txHash: string;
}

interface StandardManifest {
  manifestVersion: string;
  proxies?: ProxyEntry[];
  impls?: Record<string, ImplEntry>;
  admin?: AdminEntry;
}

interface BeaconEntry {
  address: string;
  txHash: string;
}

interface BeaconManifest {
  version: string;
  beacons: BeaconEntry[];
}

interface DeploymentInfo {
  package: string;
  chainId: string;
  proxies: {
    address: string;
    txHash: string;
    kind: string;
    tag?: string;
  }[];
  implementations: {
    address: string;
    txHash: string;
    hash: string;
  }[];
  admin?: {
    address: string;
    txHash: string;
  };
  beacons: {
    address: string;
    txHash: string;
  }[];
}

// Generic paginated list type for all lists in the output
// First page has 20 items, subsequent pages have up to 1000 items
// pagesPath is a template for page files with <page> placeholder, e.g. "proxies-2008-cashier-page-<page>.json"
interface PaginatedList<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  pagesPath?: string;
}

interface ProxyOutput {
  address: string;
  txHash: string;
  kind: string;
  tag?: string;
}

interface AdminOutput {
  address: string;
  txHash: string;
}

interface PackageOutput {
  package: string;
  chainId: string;
  proxies: PaginatedList<ProxyOutput>;
  admin?: AdminOutput;
}

interface NetworkOutput {
  chainId: string;
  packages: PaginatedList<PackageOutput>;
}

interface DeploymentsOutput {
  generatedAt: string;
  commitSha?: string;
  networks: Record<string, NetworkOutput>;
}

// Internal types for processing
interface PackageOutputInternal extends Omit<PackageOutput, "proxies"> {
  proxies: PaginatedList<ProxyOutput> & { _allItems: ProxyOutput[] };
}

interface NetworkOutputInternal extends Omit<NetworkOutput, "packages"> {
  packages: PaginatedList<PackageOutputInternal> & { _allItems: PackageOutputInternal[] };
}

interface DeploymentsOutputInternal {
  generatedAt: string;
  commitSha?: string;
  networks: Record<string, NetworkOutputInternal>;
}

const ALLOWED_CHAIN_IDS = ["2008", "2009"];
const FIRST_PAGE_SIZE = 20;
const SUBSEQUENT_PAGE_SIZE = 1000;

// Calculate total pages: first page has 20 items, subsequent pages have 1000 items
function calculateTotalPages(totalCount: number): number {
  if (totalCount <= FIRST_PAGE_SIZE) return 1;
  return 1 + Math.ceil((totalCount - FIRST_PAGE_SIZE) / SUBSEQUENT_PAGE_SIZE);
}

// Generate page file name: {listName}-page-{pageNum}.json
function getPageFileName(listName: string, pageNum: number): string {
  return `${listName}-page-${pageNum}.json`;
}

// Universal pagination file generator
// Generates page files (starting from page 2) containing just an array of items
// Returns the number of files generated
function generatePaginationFiles<T>(
  listName: string,
  allItems: T[],
  outputDir: string,
  transformItem?: (item: T) => unknown,
): number {
  if (allItems.length <= FIRST_PAGE_SIZE) return 0;

  let filesWritten = 0;
  let pageNum = 2;

  for (let offset = FIRST_PAGE_SIZE; offset < allItems.length; offset += SUBSEQUENT_PAGE_SIZE) {
    const pageItems = allItems.slice(offset, offset + SUBSEQUENT_PAGE_SIZE);
    const outputItems = transformItem ? pageItems.map(transformItem) : pageItems;

    const pageFileName = getPageFileName(listName, pageNum);
    const pagePath = path.join(outputDir, pageFileName);
    fs.writeFileSync(pagePath, JSON.stringify(outputItems, null, 2));
    console.log(`Written: ${pagePath}`);
    filesWritten++;
    pageNum++;
  }

  return filesWritten;
}

function findManifestDirs(contractsDir: string): string[] {
  const dirs: string[] = [];
  const packages = fs.readdirSync(contractsDir);

  for (const pkg of packages) {
    const pkgPath = path.join(contractsDir, pkg);
    if (!fs.statSync(pkgPath).isDirectory()) continue;

    const ozDir = path.join(pkgPath, ".openzeppelin");
    if (fs.existsSync(ozDir) && fs.statSync(ozDir).isDirectory()) {
      dirs.push(ozDir);
    }
  }

  return dirs;
}

function parseStandardManifest(
  filePath: string,
  packageName: string,
  chainId: string,
): DeploymentInfo {
  const content = fs.readFileSync(filePath, "utf-8");
  const manifest: StandardManifest = JSON.parse(content);

  const info: DeploymentInfo = {
    package: packageName,
    chainId,
    proxies: [],
    implementations: [],
    beacons: [],
  };

  if (manifest.proxies) {
    for (const proxy of manifest.proxies) {
      info.proxies.push({
        address: proxy.address,
        txHash: proxy.txHash,
        kind: proxy.kind,
        tag: proxy.cw_tag,
      });
    }
  }

  if (manifest.impls) {
    for (const [hash, impl] of Object.entries(manifest.impls)) {
      info.implementations.push({
        address: impl.address,
        txHash: impl.txHash,
        hash,
      });
    }
  }

  if (manifest.admin) {
    info.admin = {
      address: manifest.admin.address,
      txHash: manifest.admin.txHash,
    };
  }

  return info;
}

function parseBeaconManifest(
  filePath: string,
  packageName: string,
  chainId: string,
): DeploymentInfo {
  const content = fs.readFileSync(filePath, "utf-8");
  const manifest: BeaconManifest = JSON.parse(content);

  const info: DeploymentInfo = {
    package: packageName,
    chainId,
    proxies: [],
    implementations: [],
    beacons: [],
  };

  if (manifest.beacons) {
    for (const beacon of manifest.beacons) {
      info.beacons.push({
        address: beacon.address,
        txHash: beacon.txHash,
      });
    }
  }

  return info;
}

function mergeDeploymentInfo(
  base: DeploymentInfo,
  additional: DeploymentInfo,
): DeploymentInfo {
  return {
    ...base,
    proxies: [...base.proxies, ...additional.proxies],
    implementations: [...base.implementations, ...additional.implementations],
    beacons: [...base.beacons, ...additional.beacons],
  };
}

function collectDeployments(rootDir: string): DeploymentsOutputInternal {
  const contractsDir = path.join(rootDir, "contracts");
  const manifestDirs = findManifestDirs(contractsDir);

  const networkMap = new Map<string, Map<string, DeploymentInfo>>();

  for (const ozDir of manifestDirs) {
    const packageName = path.basename(path.dirname(ozDir));
    const files = fs.readdirSync(ozDir);

    for (const file of files) {
      const filePath = path.join(ozDir, file);

      // Standard manifest: unknown-{chainId}.json
      const standardMatch = file.match(/^unknown-(\d+)\.json$/);
      if (standardMatch) {
        const chainId = standardMatch[1];
        const info = parseStandardManifest(filePath, packageName, chainId);

        if (!networkMap.has(chainId)) {
          networkMap.set(chainId, new Map());
        }

        const pkgMap = networkMap.get(chainId)!;

        if (pkgMap.has(packageName)) {
          pkgMap.set(packageName, mergeDeploymentInfo(pkgMap.get(packageName)!, info));
        } else {
          pkgMap.set(packageName, info);
        }
      }

      // Beacon manifest: beacon-manifest-{chainId}.json
      const beaconMatch = file.match(/^beacon-manifest-(\d+)\.json$/);
      if (beaconMatch) {
        const chainId = beaconMatch[1];
        const info = parseBeaconManifest(filePath, packageName, chainId);

        if (!networkMap.has(chainId)) {
          networkMap.set(chainId, new Map());
        }
        const pkgMap = networkMap.get(chainId)!;

        if (pkgMap.has(packageName)) {
          pkgMap.set(packageName, mergeDeploymentInfo(pkgMap.get(packageName)!, info));
        } else {
          pkgMap.set(packageName, info);
        }
      }
    }
  }

  // Build output
  const output: DeploymentsOutputInternal = {
    generatedAt: new Date().toISOString(),
    commitSha: process.env.GITHUB_SHA,
    networks: {},
  };

  // Sort networks by chainId
  const sortedChainIds = Array.from(networkMap.keys()).sort(
    (a, b) => parseInt(a) - parseInt(b),
  );

  for (const chainId of sortedChainIds) {
    // Filter out networks we don't want
    if (!ALLOWED_CHAIN_IDS.includes(chainId)) {
      continue;
    }

    const pkgMap = networkMap.get(chainId)!;
    const packages = Array.from(pkgMap.values()).sort((a, b) =>
      a.package.localeCompare(b.package),
    );

    // Filter out packages with no deployments and build paginated output
    const allPackages: PackageOutputInternal[] = packages
      .filter(p => p.proxies.length > 0)
      .map((p) => {
        const totalProxies = p.proxies.length;
        const totalProxyPages = calculateTotalPages(totalProxies);
        const proxyListName = `proxies-${chainId}-${p.package}`;

        return {
          package: p.package,
          chainId: p.chainId,
          proxies: {
            items: p.proxies.slice(0, FIRST_PAGE_SIZE),
            totalCount: totalProxies,
            totalPages: totalProxyPages,
            pagesPath: totalProxies > FIRST_PAGE_SIZE ? `${proxyListName}-page-<page>.json` : undefined,
            _allItems: p.proxies,
          },
          admin: p.admin,
        };
      });

    if (allPackages.length > 0) {
      const totalPackageCount = allPackages.length;
      const totalPackagePages = calculateTotalPages(totalPackageCount);
      const packageListName = `packages-${chainId}`;

      output.networks[`chain-${chainId}`] = {
        chainId,
        packages: {
          items: allPackages.slice(0, FIRST_PAGE_SIZE),
          totalCount: totalPackageCount,
          totalPages: totalPackagePages,
          pagesPath: totalPackageCount > FIRST_PAGE_SIZE ? `${packageListName}-page-<page>.json` : undefined,
          _allItems: allPackages,
        },
      };
    }
  }

  return output;
}

// Main execution
const rootDir = process.cwd();
const outputDir = process.argv[2] || path.join(rootDir, "deployments-output");

console.log(`Collecting deployments from: ${rootDir}`);
console.log(`Output directory: ${outputDir}`);

const deploymentsInternal = collectDeployments(rootDir);

// Create output directory
fs.mkdirSync(outputDir, { recursive: true });

let paginationFilesWritten = 0;

// Helper to strip internal fields from package output
function stripInternalFields(pkg: PackageOutputInternal): PackageOutput {
  const { _allItems, ...proxies } = pkg.proxies;
  return {
    package: pkg.package,
    chainId: pkg.chainId,
    proxies,
    admin: pkg.admin,
  };
}

// Generate pagination files for all lists
for (const network of Object.values(deploymentsInternal.networks)) {
  const chainId = network.chainId;

  // Generate proxy pagination files for each package
  for (const pkg of network.packages._allItems) {
    const proxyListName = `proxies-${chainId}-${pkg.package}`;
    paginationFilesWritten += generatePaginationFiles(
      proxyListName,
      pkg.proxies._allItems,
      outputDir,
    );
  }

  // Generate package pagination files for the network
  const packageListName = `packages-${chainId}`;
  paginationFilesWritten += generatePaginationFiles(
    packageListName,
    network.packages._allItems,
    outputDir,
    stripInternalFields,
  );
}

// Strip internal fields from output
const deployments: DeploymentsOutput = {
  generatedAt: deploymentsInternal.generatedAt,
  commitSha: deploymentsInternal.commitSha,
  networks: Object.fromEntries(
    Object.entries(deploymentsInternal.networks).map(([key, network]) => {
      const { _allItems, ...packages } = network.packages;
      return [
        key,
        {
          chainId: network.chainId,
          packages: {
            ...packages,
            items: packages.items.map(stripInternalFields),
          },
        },
      ];
    }),
  ),
};

// Write main JSON
const jsonPath = path.join(outputDir, "deployments.json");
fs.writeFileSync(jsonPath, JSON.stringify(deployments, null, 2));
console.log(`Written: ${jsonPath}`);

// Summary
let totalProxies = 0;

for (const network of Object.values(deploymentsInternal.networks)) {
  for (const pkg of network.packages._allItems) {
    totalProxies += pkg.proxies._allItems.length;
  }
}

console.log(`\nSummary:`);
console.log(`  Networks: ${Object.keys(deployments.networks).length}`);
console.log(`  Total proxies: ${totalProxies}`);
console.log(`  Pagination files: ${paginationFilesWritten}`);
