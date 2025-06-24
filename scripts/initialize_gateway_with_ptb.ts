import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

// Configuration - Update these values based on your deployment
const config = {
    packageId: '0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7',
    adminCaps: {
        tbtc: '0x6cbd4a5001ed0ea5f1b6d9b713adaf1b592216278ce6db7bc821f092dcf22f56',
        gateway: '0x...', // Gateway AdminCap ID
        treasuryCap: '0x1e436da66457d0ee9e49d2f5373ecd21666a739c1cc84f52e7b6df69ef23b884',
    },
    sharedObjects: {
        tokenState: '0x...', // TBTC TokenState ID
        gatewayState: '0x4329bd8869d23c6b0e3020d74f3c1199aa7a34a45ee9d7aca496c70439220510',
    },
    wormhole: {
        coreState: '0x...', // Wormhole state ID
        wrappedTbtcType: '...', // Wrapped TBTC type
    },
    sui: {
        rpc: 'https://fullnode.testnet.sui.io:443',
        privateKey: 'YOUR_ADMIN_PRIVATE_KEY', // Admin private key
    }
};

async function initializeGatewayWithMinterCap() {
    console.log('🚀 Initializing Gateway with MinterCap using PTB\n');

    try {
        // Setup SUI client and keypair
        const client = new SuiClient({ url: config.sui.rpc });
        const keypair = Ed25519Keypair.fromSecretKey(config.sui.privateKey);
        const adminAddress = keypair.getPublicKey().toSuiAddress();
        
        console.log('Admin Address:', adminAddress);
        console.log('Package ID:', config.packageId);
        console.log('Gateway State ID:', config.sharedObjects.gatewayState);

        // Create a Programmable Transaction Block
        const tx = new TransactionBlock();

        // Step 1: Add Gateway as minter and get the MinterCap
        // This calls the new public function that returns MinterCap
        const [minterCap] = tx.moveCall({
            target: `${config.packageId}::TBTC::add_minter_with_cap`,
            arguments: [
                tx.object(config.adminCaps.tbtc),           // AdminCap
                tx.object(config.sharedObjects.tokenState), // TokenState
                tx.pure(config.sharedObjects.gatewayState), // Gateway address (minter)
            ],
            typeArguments: [],
        });

        // Step 2: Initialize the Gateway with the MinterCap
        // This happens in the same transaction, ensuring atomicity
        tx.moveCall({
            target: `${config.packageId}::Gateway::initialize_gateway`,
            arguments: [
                tx.object(config.adminCaps.gateway),       // Gateway AdminCap
                tx.object(config.sharedObjects.gatewayState), // GatewayState
                tx.object(config.wormhole.coreState),      // WormholeState
                minterCap,                                 // MinterCap from step 1
                tx.object(config.adminCaps.treasuryCap),   // TreasuryCap
            ],
            typeArguments: [config.wormhole.wrappedTbtcType],
        });

        // Set gas budget
        tx.setGasBudget(100000000); // 0.1 SUI

        console.log('\n📤 Executing transaction...');

        // Sign and execute the transaction
        const result = await client.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: tx,
            options: {
                showEffects: true,
                showObjectChanges: true,
                showEvents: true,
            },
        });

        console.log('\nTransaction Digest:', result.digest);
        console.log('Status:', result.effects?.status.status);

        if (result.effects?.status.status === 'success') {
            console.log('\n✅ SUCCESS! Gateway initialized with MinterCap');
            
            // Check for events
            if (result.events && result.events.length > 0) {
                console.log('\nEvents:');
                result.events.forEach(event => {
                    console.log(`- ${event.type}`);
                    if (event.parsedJson) {
                        console.log('  Data:', JSON.stringify(event.parsedJson, null, 2));
                    }
                });
            }

            // Check for object changes
            if (result.objectChanges && result.objectChanges.length > 0) {
                console.log('\nObject Changes:');
                result.objectChanges.forEach(change => {
                    console.log(`- ${change.type}: ${change.objectId}`);
                });
            }

            console.log('\n🎉 Gateway is now ready to mint tBTC!');
            console.log('The entire process completed in a single atomic transaction.');
            
        } else {
            console.log('\n❌ Transaction failed!');
            if (result.effects?.status.error) {
                console.log('Error:', result.effects.status.error);
            }
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Alternative: Using the entry function approach if preferred
async function initializeGatewayAlternative() {
    console.log('🔄 Alternative: Using add_minter_to_recipient approach\n');
    
    try {
        const client = new SuiClient({ url: config.sui.rpc });
        const keypair = Ed25519Keypair.fromSecretKey(config.sui.privateKey);
        const adminAddress = keypair.getPublicKey().toSuiAddress();

        // Step 1: Add Gateway as minter and send MinterCap to admin
        const tx1 = new TransactionBlock();
        tx1.moveCall({
            target: `${config.packageId}::TBTC::add_minter_to_recipient`,
            arguments: [
                tx1.object(config.adminCaps.tbtc),
                tx1.object(config.sharedObjects.tokenState),
                tx1.pure(config.sharedObjects.gatewayState), // minter
                tx1.pure(adminAddress), // cap_recipient (admin)
            ],
        });

        const result1 = await client.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: tx1,
        });

        if (result1.effects?.status.status !== 'success') {
            throw new Error('Failed to add minter');
        }

        // Extract MinterCap ID from created objects
        const minterCapId = result1.objectChanges?.find(
            change => change.type === 'created' && 
                     change.objectType?.includes('MinterCap')
        )?.objectId;

        if (!minterCapId) {
            throw new Error('MinterCap not found in transaction results');
        }

        console.log('MinterCap created:', minterCapId);

        // Step 2: Initialize Gateway with the MinterCap
        const tx2 = new TransactionBlock();
        tx2.moveCall({
            target: `${config.packageId}::Gateway::initialize_gateway`,
            arguments: [
                tx2.object(config.adminCaps.gateway),
                tx2.object(config.sharedObjects.gatewayState),
                tx2.object(config.wormhole.coreState),
                tx2.object(minterCapId), // MinterCap owned by admin
                tx2.object(config.adminCaps.treasuryCap),
            ],
            typeArguments: [config.wormhole.wrappedTbtcType],
        });

        const result2 = await client.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: tx2,
        });

        if (result2.effects?.status.status === 'success') {
            console.log('\n✅ Gateway initialized successfully!');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the initialization
// Prefer the PTB approach for atomicity
initializeGatewayWithMinterCap()
    .catch(console.error);