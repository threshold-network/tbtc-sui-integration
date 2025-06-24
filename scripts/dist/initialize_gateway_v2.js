"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transactions_1 = require("@mysten/sui.js/transactions");
const client_1 = require("@mysten/sui.js/client");
const ed25519_1 = require("@mysten/sui.js/keypairs/ed25519");
// V2 Testnet deployment with MinterCap fix
const TESTNET_V2_CONFIG = {
    packageId: '0xc32a05cc6567773f0515f95682e0e7be545c93c54c8b24d45f39dc4dd2db8bee',
    objects: {
        // Admin capabilities
        tbtcAdminCap: '0xd36c153f3ebdf0e704efe0728a87d907a9448b33ea3846dcefbc16493575f8ff',
        gatewayAdminCap: '0x7ee56af292718611ed5f5c956c3cd181805aaf9dd42698c7147c206242234413',
        treasuryCap: '0x2b522445afe6778d822621cb53543e84f56c7e2cf6fb01c5693cb4b49ec5f4cf',
        // Shared objects
        tokenState: '0x40277729d0ae3a0829d6e076cf5bf4c2853e0035f7db4a75dac0bdbeab3a0802',
        gatewayState: '0x23c56d89a95d89c6e3e470151e456c7c3bcda46c6febf9195e1da1bdd0538ea4',
        // Wormhole (testnet addresses)
        wormholeState: '0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790',
    },
    types: {
        // The wrapped tBTC type from Wormhole
        wrappedTbtcType: '0x562760fc51d90d4ae1835bac3e91e0e6987d3497b06f066941d3e51f6e8d76d0::wrapped::Wrapped<0x562760fc51d90d4ae1835bac3e91e0e6987d3497b06f066941d3e51f6e8d76d0::token::Token>',
    },
    rpc: 'https://fullnode.testnet.sui.io:443',
};
async function initializeGateway() {
    console.log('🚀 Initializing Gateway V2 (Fixed MinterCap)\n');
    try {
        const client = new client_1.SuiClient({ url: TESTNET_V2_CONFIG.rpc });
        // Get the deployer keypair from environment or use a test keypair
        // In production, this should come from environment variables
        const keypair = ed25519_1.Ed25519Keypair.fromSecretKey(
        // Replace with your actual secret key
        Buffer.from(process.env.SUI_SECRET_KEY || '', 'hex'));
        const address = keypair.getPublicKey().toSuiAddress();
        console.log('Admin address:', address);
        // Check Gateway state before initialization
        console.log('\n1️⃣ Checking Gateway State...');
        const gatewayState = await client.getObject({
            id: TESTNET_V2_CONFIG.objects.gatewayState,
            options: { showContent: true }
        });
        if (gatewayState.data?.content?.dataType === 'moveObject') {
            const fields = gatewayState.data.content.fields;
            console.log('   - Is Initialized:', fields.is_initialized);
            if (fields.is_initialized) {
                console.log('   ⚠️  Gateway is already initialized!');
                return;
            }
        }
        // Create a Programmable Transaction Block
        console.log('\n2️⃣ Creating Programmable Transaction Block...');
        const tx = new transactions_1.TransactionBlock();
        // Step 1: Add Gateway as minter and receive MinterCap
        console.log('   - Adding Gateway as minter with MinterCap return...');
        const [minterCap] = tx.moveCall({
            target: `${TESTNET_V2_CONFIG.packageId}::TBTC::add_minter_with_cap`,
            arguments: [
                tx.object(TESTNET_V2_CONFIG.objects.tbtcAdminCap), // AdminCap
                tx.object(TESTNET_V2_CONFIG.objects.tokenState), // TokenState  
                tx.pure(TESTNET_V2_CONFIG.objects.gatewayState), // Gateway address
            ],
        });
        // Step 2: Initialize Gateway with MinterCap (same transaction!)
        console.log('   - Initializing Gateway with MinterCap...');
        tx.moveCall({
            target: `${TESTNET_V2_CONFIG.packageId}::Gateway::initialize_gateway`,
            arguments: [
                tx.object(TESTNET_V2_CONFIG.objects.gatewayAdminCap), // Gateway AdminCap
                tx.object(TESTNET_V2_CONFIG.objects.gatewayState), // GatewayState
                tx.object(TESTNET_V2_CONFIG.objects.wormholeState), // WormholeState
                minterCap, // MinterCap from Step 1
                tx.object(TESTNET_V2_CONFIG.objects.treasuryCap), // TreasuryCap
            ],
            typeArguments: [TESTNET_V2_CONFIG.types.wrappedTbtcType],
        });
        // Set gas budget
        tx.setGasBudget(100000000); // 0.1 SUI
        // Execute the transaction
        console.log('\n3️⃣ Executing transaction...');
        const result = await client.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: tx,
            options: {
                showObjectChanges: true,
                showEffects: true,
                showEvents: true,
            },
        });
        console.log('\n✅ Transaction successful!');
        console.log('   - Digest:', result.digest);
        // Check if Gateway was initialized
        if (result.objectChanges) {
            const gatewayCapabilitiesCreated = result.objectChanges.find(change => change.type === 'created' &&
                change.objectType?.includes('GatewayCapabilities'));
            if (gatewayCapabilitiesCreated) {
                console.log('   - GatewayCapabilities created:', gatewayCapabilitiesCreated.objectId);
            }
        }
        // Verify Gateway is now initialized
        console.log('\n4️⃣ Verifying Gateway initialization...');
        const updatedGateway = await client.getObject({
            id: TESTNET_V2_CONFIG.objects.gatewayState,
            options: { showContent: true }
        });
        if (updatedGateway.data?.content?.dataType === 'moveObject') {
            const fields = updatedGateway.data.content.fields;
            console.log('   - Is Initialized:', fields.is_initialized);
            console.log('   - Minting Limit:', fields.minting_limit);
            if (fields.is_initialized) {
                console.log('\n🎉 Gateway successfully initialized!');
                console.log('   The Gateway can now mint and burn tBTC.');
            }
        }
    }
    catch (error) {
        console.error('\n❌ Error:', error);
        if (error instanceof Error) {
            console.error('   Details:', error.message);
        }
    }
}
// Run the initialization
initializeGateway();
