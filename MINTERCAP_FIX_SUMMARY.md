# MinterCap Fix Summary

## Quick Reference

### What Changed
- Added `public fun add_minter_with_cap()` to TBTC module
- Returns MinterCap instead of transferring to minter address
- Enables Gateway initialization for shared objects

### Why It's Needed
- Original `add_minter` transfers MinterCap to Gateway's address
- Gateway is a shared object that can't sign transactions
- MinterCap becomes permanently inaccessible
- Gateway can't be initialized without MinterCap

### How to Use

```typescript
// Single PTB transaction
const tx = new TransactionBlock();

// Step 1: Get MinterCap
const [minterCap] = tx.moveCall({
    target: `${PACKAGE}::TBTC::add_minter_with_cap`,
    arguments: [adminCap, tokenState, gatewayAddress]
});

// Step 2: Initialize Gateway
tx.moveCall({
    target: `${PACKAGE}::Gateway::initialize_gateway`,
    arguments: [adminCap, gatewayState, wormholeState, minterCap, treasuryCap]
});

// Execute atomically
await client.signAndExecuteTransactionBlock({ signer, transactionBlock: tx });
```

### Files Modified
1. `sources/token/tbtc.move` - Add new function
2. `scripts/initialize_gateway_with_ptb.ts` - New initialization script
3. `docs/mintercap-fix-deployment-guide.md` - Full documentation

### Next Steps
1. Deploy updated contract
2. Run initialization script
3. Verify Gateway can mint/burn tBTC