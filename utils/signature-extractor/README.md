# Signature Extractor

Extracts smart contract signatures from CSV files containing Blockscout database exports.

## Installation

```bash
npm install
```

## Usage

```bash
INPUT_DIR=./path/to/csvs OUTPUT_DIR=./path/to/output npm start
```

Alternatively, you can do the following:

1. Create the `input` directory in the root of the project.
2. Place the CSV files in the `input` directory.
3. Run the script without environment variables as:
    ```bash
    npm start
    ```

## Environment Variables

- `INPUT_DIR` - Directory containing CSV files (default: `./input`)
- `OUTPUT_DIR` - Directory for output files (default: `./output`)

## Input CSV Format

CSV files must use **tab (`\t`) delimiters** and contain these columns:

### Required Columns
- `selector` - Function/error selector (8 hex chars) or event topic (64 hex chars), with or without `0x` prefix
- `abi` - JSON string containing the ABI fragment

### Optional Columns
- `name`, `type`, or any other columns - Will be ignored

### Example Queries

The following queries can be used to export data from Blockscout databases.

**Note:** The selector is always in 4-byte format for all entity types, including events. This is because Blockscout stores only the first 4 bytes of the event topic.

#### PostgreSQL

```sql
WITH selectors AS (
  SELECT
    CASE
      WHEN cm.identifier < 0 THEN decode(lpad(to_hex(cm.identifier + 4294967296), 8, '0'), 'hex')
      ELSE decode(lpad(to_hex(cm.identifier), 8, '0'), 'hex')
    END AS selector,
    (cm.abi::jsonb ->> 'name') AS name,
    cm.type, -- can be 'function', 'error', 'event'
    cm.abi AS abi
  FROM contract_methods AS cm
)
SELECT
  '0x' || encode(selector, 'hex') AS selector,
  name,
  type,
  abi
FROM selectors
ORDER BY selector, type, name
```

#### BigQuery

```sql
WITH
  selectors AS (
    SELECT
    CASE
      WHEN cm.identifier < 0 THEN FROM_HEX(TRIM(CAST((cm.identifier + 4294967296) AS STRING FORMAT '0000000x')))
      ELSE FROM_HEX(TRIM(CAST((cm.identifier) AS STRING FORMAT '0000000x')))
    END AS selector,
    JSON_EXTRACT_SCALAR(cm.abi, '$.name') AS name,
    cm.type, -- can be 'function', 'error', 'event'
    cm.abi AS abi
    FROM blockscout.contract_methods AS cm
  )
SELECT
  '0x' || TO_HEX(selector) AS selector,
  name,
  type,
  abi
FROM selectors
ORDER BY selector, type, name
```

### Example CSV for testing

```
selector	name	type	abi
0x095EA7B3	approve	function	{"type":"function","name":"approve","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint"}]}
095ea7b3	approve	function	{"type":"function","name":"approve","inputs":[{"name":"s","type":"address"},{"name":"value","type":"uint256"}]}
0x9996b315	AddressEmptyCode	error	{"type":"error","name":"AddressEmptyCode","inputs":[{"name":"target","type":"address"}]}
0x23b872dd	transferFrom	function	{"type":"function","name":"transferFrom","inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"value","type":"uint256"}]}
0x23b872dd	gasprice_bit_ether	function	{"type":"function","name":"gasprice_bit_ether","inputs":[{"name":"","type":"int128"}]}
0xDDF252AD	Transfer	event	{"type":"event","name":"Transfer","inputs":[{"name":"from","type":"address","indexed":true},{"name":"to","type":"address","indexed":true},{"name":"value","type":"uint256","indexed":false}],"anonymous":false}
0xe128bbe1fe4110a3ca2b1ef460259c503b6883f8717fd3c99cd60691e5666e8c	Anon	event	{"type":"event","name":"Anon","inputs":[{"name":"x","type":"uint256","indexed":false}],"anonymous":true}
0x00000001	badAbi	function	{"invalid json}
0xdeadbeef	balanceOf	function	{"type":"function","name":"balanceOf","inputs":[{"name":"account","type":"address"}]}
0xc210b011	takeLoan	function	{"name": "takeLoan", "type": "function", "inputs": [{"name": "", "type": "tuple", "components": [{"name": "borrower", "type": "address", "internalType": "address"}, {"name": "programId", "type": "uint256", "internalType": "uint256"}, {"name": "startTimestamp", "type": "uint256", "internalType": "uint256"}], "internalType": "struct ILendingMarketV2Types.LoanTakingRequest"}, {"name": "", "type": "tuple[]", "components": [{"name": "borrowedAmount", "type": "uint256", "internalType": "uint256"}, {"name": "addonAmount", "type": "uint256", "internalType": "uint256"}, {"name": "duration", "type": "uint256", "internalType": "uint256"}, {"name": "primaryRate", "type": "uint256", "internalType": "uint256"}, {"name": "secondaryRate", "type": "uint256", "internalType": "uint256"}, {"name": "moratoryRate", "type": "uint256", "internalType": "uint256"}, {"name": "lateFeeRate", "type": "uint256", "internalType": "uint256"}, {"name": "clawbackFeeRate", "type": "uint256", "internalType": "uint256"}], "internalType": "struct ILendingMarketV2Types.SubLoanTakingRequest[]"}], "outputs": [{"name": "firstSubLoanId", "type": "uint256", "internalType": "uint256"}], "stateMutability": "nonpayable"}
```

**Notes:**
1. The delimiter between columns must be a tab character, not spaces.
2. The `selector` column in the example contains different formats while the queries above returns the selector in 4-byte format with `0x` prefix.

## Output Files

1. `zzz-databases.All.signatures` - All unique signatures in the format: `selector: signature`
2. `signature-collisions.md` - Collision analysis report in human-readable `Markdown` format
3. `signature-verification.md` - The CSV data validation report in human-readable `Markdown` format

### The signatures file example (based on the example CSV):

```
Function signatures:
095ea7b3: approve(address,uint256)
23b872dd: transferFrom(address,address,uint256)
23b872dd: gasprice_bit_ether(int128)
c210b011: takeLoan((address,uint256,uint256),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)[])

Error signatures:
9996b315: AddressEmptyCode(address)

Event signatures:
ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef: Transfer(address,address,uint256)
e128bbe1fe4110a3ca2b1ef460259c503b6883f8717fd3c99cd60691e5666e8c: Anon(uint256)
```
