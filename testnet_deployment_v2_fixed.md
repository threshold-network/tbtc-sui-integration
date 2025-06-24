# Testnet Deployment V2 - Fixed MinterCap Issue

## Deployment Information
- **Date**: June 24, 2025
- **Transaction Digest**: `EFuh52w1qZ3sPaqWHn3bFqW19ZscTXUhMWAcrQXziDjD`
- **Package ID**: `0xc32a05cc6567773f0515f95682e0e7be545c93c54c8b24d45f39dc4dd2db8bee`
- **Deployer**: `0xd078ab2f62bf6549c2887119a65f97428c6b197e5c704ffcbe0bde4370a295f9`

## Key Objects Created

### Admin Capabilities
- **TBTC AdminCap**: `0xd36c153f3ebdf0e704efe0728a87d907a9448b33ea3846dcefbc16493575f8ff`
- **Gateway AdminCap**: `0x7ee56af292718611ed5f5c956c3cd181805aaf9dd42698c7147c206242234413`
- **BitcoinDepositor AdminCap**: `0x8867a62b6085bbfce08492d0870e3f43e899deba824075bd16eab131a152aa44`
- **TreasuryCap**: `0x2b522445afe6778d822621cb53543e84f56c7e2cf6fb01c5693cb4b49ec5f4cf`

### Shared Objects
- **TokenState**: `0x40277729d0ae3a0829d6e076cf5bf4c2853e0035f7db4a75dac0bdbeab3a0802`
- **GatewayState**: `0x23c56d89a95d89c6e3e470151e456c7c3bcda46c6febf9195e1da1bdd0538ea4`
- **ReceiverState**: `0xeb1d3d0a48f1f0ae3bf1f95b82a80874bd4602924e1ddb1dccda288ce5dc4176`

### Other Objects
- **CoinMetadata**: `0x3ef6314e89946951ffa00ff1182fb72440d3263d10f716f6c31af091eb4c50f7`
- **UpgradeCap**: `0x42c4b55d57544c5deb0fb6a38ea7f8bd14dbb7fb422c37b6fd99f35398ff7bae`

## Key Fix Implemented

Added `add_minter_with_cap` function to TBTC module that returns the MinterCap instead of transferring it:

```move
public fun add_minter_with_cap(
    _: &AdminCap,
    state: &mut TokenState,
    minter: address,
    ctx: &mut TxContext,
): MinterCap {
    assert!(!is_minter(state, minter), E_ALREADY_MINTER);
    vector::push_back(&mut state.minters, minter);
    let minter_cap = MinterCap {
        id: object::new(ctx),
        minter,
    };
    event::emit(MinterAdded { minter });
    minter_cap // Return instead of transfer
}
```

## Next Steps

1. Initialize Gateway using PTB to atomically:
   - Call `add_minter_with_cap` to get MinterCap
   - Call `initialize_gateway` with the MinterCap
   
2. Set trusted emitter on BitcoinDepositor
3. Test the complete flow

## Wormhole Dependencies
- **Wormhole Core**: `0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94`
- **Token Bridge**: `0x562760fc51d90d4ae1835bac3e91e0e6987d3497b06f066941d3e51f6e8d76d0`
- **Wormhole State**: `0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790`