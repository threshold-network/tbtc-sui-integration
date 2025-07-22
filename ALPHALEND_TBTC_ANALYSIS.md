# AlphaLend tBTC Double-Counting Investigation Report

## Executive Summary

AlphaLend, a lending protocol on Sui blockchain, is reporting 43.75 tBTC in total deposits, which is impossible since only 37.44 tBTC exists on the entire Sui blockchain. This discrepancy is caused by a systematic exploitation where users borrow tBTC and redeposit it, causing the protocol to count the same coins multiple times.

## Key Findings

- **AlphaLend Claims**: 43.75 tBTC total deposits
- **Actual tBTC on Sui**: 37.44 tBTC (canonical supply)
- **Excess**: 6.32 tBTC (16.9% more than possible)
- **Actual coins in pool**: 23.57 tBTC (available for withdrawal)
- **Scheme impact**: 58% of deposits are from borrowing-recycling

## Technical Details

### Contract Addresses

```
tBTC Token Package: 0x77045f1b9f811a7a8fb9ebd085b5b0c55c5cb0d1520ff55f7037f89b5da9f5f1
AlphaLend Package: 0xd631cd66138909636fc3f73ed75820d0c5b76332d1644608ed1c85ea2b8219b4
AlphaLend tBTC Market: 0x4288e5038d5efee54f88ee1c9c6992799e0215be0364dd6103dcc80045d11414
tBTC Treasury Cap: 0xb0faec8d0a74808108c775230967d9617acf0952425c2a559cac95588f187901
Market ID: 14 (tBTC market identifier in AlphaLend)
```

### Current Market State (as of analysis)

```
balance_holding: 2,357,225,185 (23.57 tBTC) - Actual coins in pool
borrowed_amount: 2,018,235,714 (20.18 tBTC) - Outstanding debt
xtoken_supply:   4,371,195,336 (43.71 xTBTC) - Receipt tokens
xtoken_ratio:    1.000942698663238141
```

## The Double-Counting Scheme

### How It Works

1. **User deposits collateral** (often minimal or using other borrowed assets)
2. **User borrows tBTC** from AlphaLend
3. **User deposits the borrowed tBTC back** into AlphaLend
4. **Result**: AlphaLend counts the same tBTC twice
   - Once as the original deposit (still tracked)
   - Once as the newly deposited amount

### Example Transaction Flow

```
Initial State: 100 tBTC in pool
├── balance_holding: 100 tBTC
├── borrowed_amount: 0 tBTC
└── Total: 100 tBTC ✓

After User Borrows 60 tBTC:
├── balance_holding: 40 tBTC (decreased)
├── borrowed_amount: 60 tBTC (increased)
└── Total: 100 tBTC ✓ (correct)

After User Redeposits the 60 tBTC:
├── balance_holding: 100 tBTC (increased)
├── borrowed_amount: 60 tBTC (unchanged)
└── Total: 160 tBTC ✗ (WRONG - 60 phantom tBTC created)
```

## Major Perpetrators

### 1. Largest Borrowing-Recycling Scheme
- **Borrower**: `0x064b5431ceba22515234a97bc54b58c3522a000ae2861d5473f4067e755814c1`
- **Amount Borrowed**: 13.34 tBTC
- **Depositor**: `0x8557047e3409a37cb75810d0f8b0fd3e89f269ed1ceb0209e4fe038cfe241409`
- **Transaction**: Borrowed 13.34 tBTC and transferred to depositor who redeposited

### 2. Second Largest Scheme
- **Borrower**: `0xca6c716d15c164e3f61ca65b0cba56744df1b87a1d2d06e164493cf7b86a6299`
- **Amount Borrowed**: 8.80 tBTC
- **Depositor**: `0x2a039da2a2aca594a2e1d4a8c382832e2c5067b2d8032f24a2f0c813d3ab5adf`

### 3. Complex Multi-Step Scheme
- **Initial Actor**: `0xdfe220ae0e20b1cfbe94800d957564ec3d6b444467a33825b790ef3e4a90a2de`
- **Borrowed**: 0.6 tBTC (TX: `Anogod7BYqQB6DrN7828LekCUHcTyh5WgSYnJKsoTEAM`)
- **Sent to**: `0x927363c465a04495ba8a88085ab12a3ee9902c3775601aeb8fa897b4ab564742`
- **Final Amount**: 4.78 tBTC deposited (after WBTC swaps)

### Complete List of Borrowing-Recycling Participants

| Depositor | Amount Deposited | Borrower Source | Amount Borrowed |
|-----------|------------------|-----------------|-----------------|
| 0x855704...241409 | 13.34 tBTC | 0x064b54...5814c1 | 13.34 tBTC |
| 0x2a039d...3ab5adf | 8.81 tBTC | 0xca6c71...6a6299 | 8.80 tBTC |
| 0xb5c106...e17a30 | 6.50 tBTC | 0xe1b19d...8f913e | 6.50 tBTC |
| 0x49b2d7...3928e8 | 3.06 tBTC | 0xb78daf...be742 | 3.06 tBTC |
| 0x2ded33...667038 | 1.96 tBTC | 0xa3fd0a...aba279 | 1.96 tBTC |
| 0x3bc774...6975c3 | 1.71 tBTC | 0xeeba72...b07c27 | 1.71 tBTC |
| 0xd1e821...1ab5cd | 1.65 tBTC | 0x3e72af...572552 | 1.65 tBTC |
| 0x5c48d2...1dfa85 | 1.50 tBTC | 0x669313...ce749d9 | 1.50 tBTC |

## Investigation Methodology

### 1. Transaction Analysis
- Analyzed 794 AlphaLend events over 15 days (July 3-18, 2025)
- Tracked all DepositEvent, BorrowEvent, WithdrawEvent, and RepayEvent
- Cross-referenced depositors with tBTC minting events

### 2. Source Verification
- Checked TokensMinted events from tBTC bridge
- Only 6 out of 115 depositors (5.2%) actually minted tBTC
- 58% of deposits traced to borrowing schemes
- 20.5% from unknown sources (including DEX swaps)

### 3. Balance Verification
- Compared AlphaLend's claimed supply with canonical tBTC supply
- Found 6.32 tBTC excess (impossible amount)

## How to Reproduce and Verify

### Step 1: Check Canonical tBTC Supply
```typescript
// Get total tBTC minted on Sui
const treasuryCap = await client.getObject({
  id: '0xb0faec8d0a74808108c775230967d9617acf0952425c2a559cac95588f187901',
  options: { showContent: true }
});
const totalSupply = treasuryCap.data.content.fields.treasury_cap.fields.total_supply.fields.value;
// Result: 3,743,539,198 (37.44 tBTC)
```

### Step 2: Check AlphaLend's Claimed Supply
```typescript
// Get AlphaLend market data
const market = await client.getObject({
  id: '0x4288e5038d5efee54f88ee1c9c6992799e0215be0364dd6103dcc80045d11414',
  options: { showContent: true }
});
const marketData = market.data.content.fields.value.fields;
const totalClaimed = BigInt(marketData.balance_holding) + BigInt(marketData.borrowed_amount);
// Result: 4,375,460,899 (43.75 tBTC)
```

### Step 3: Verify Specific Schemes
```typescript
// Example: Check the largest borrower
// 1. Find borrow events for address
// 2. Track where borrowed tBTC went
// 3. Check if recipient deposited to AlphaLend
```

### Step 4: Run Analysis Scripts
```bash
# Check current AlphaLend tBTC balance
npx ts-node scripts/verify-xtoken-calculation.ts

# Analyze historical transactions
npx ts-node scripts/analyze-alphalend-transactions.ts

# Trace specific addresses
npx ts-node scripts/trace-largest-depositor-tbtc.ts
```

## Impact Analysis

### Financial Impact
- **Inflated TVL**: AlphaLend shows 43.75 tBTC when only 23.57 tBTC is actually available
- **Leverage Risk**: 46% utilization rate (20.18 borrowed / 43.75 total)
- **Liquidity Risk**: Mass withdrawals would fail as there's insufficient tBTC

### Breakdown of 72.88 tBTC Deposits (15-day period)
- **Legitimate (Minted)**: 15.82 tBTC (21.7%)
- **Borrowing Schemes**: 42.28 tBTC (58.0%)
- **Unknown Sources**: 14.79 tBTC (20.3%)

## Circular Borrowing Examples

### Case 1: Self-Recycling
- `0x594d38c1febe6df9390a0b43ce37205271cc9598e632d3868441dc72c9a9981e`
- `0x38d1f50b8870d6a8ed0200c6b630c1ed0c6ea1fdab0868b5057d49876eb8f037`
- These addresses borrowed 1 tBTC from each other and redeposited

### Case 2: Multi-Hop Recycling
- Start: Borrow → Transfer → Swap → Deposit
- Creates complex chains difficult to trace without systematic analysis

## Recommendations

1. **Immediate**: AlphaLend should prevent borrowed assets from being redeposited
2. **Transparency**: Separate reporting of external deposits vs total tracked
3. **Audit**: Full audit of position accounting and collateral requirements
4. **User Warning**: Users should understand actual liquidity is 54% of displayed

## Conclusion

AlphaLend's tBTC market shows systematic exploitation through borrowing-recycling schemes, resulting in impossible accounting where the protocol claims to hold 16.9% more tBTC than exists on the entire blockchain. The actual available liquidity is only 23.57 tBTC, not the 43.75 tBTC displayed. This represents a critical risk to users who may not realize that 46% of the "deposits" are actually phantom assets created through double-counting.

---

*Investigation conducted by analyzing on-chain data from Sui blockchain*  
*All addresses and transactions are verifiable on-chain*  
*Scripts available in `/scripts/` directory for independent verification*