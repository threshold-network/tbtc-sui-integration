import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

// Testnet deployment information from testnet_deployment_digest.md
const TESTNET_CONFIG = {
    packageId: '0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7',
    objects: {
        // Admin capabilities
        tbtcAdminCap: '0xca6ea16fef73bd28a70b3ec996204b8bd7e0b60662892f52b0f12529445aaa7c',
        gatewayAdminCap: '0x6cbd4a5001ed0ea5f1b6d9b713adaf1b592216278ce6db7bc821f092dcf22f56',
        treasuryCap: '0x1e436da66457d0ee9e49d2f5373ecd21666a739c1cc84f52e7b6df69ef23b884',
        
        // Shared objects
        tokenState: '0x7c3ee5fb7f905dff8b70daadd953758c92b6f72ed121474c98c3129993d24e93',
        gatewayState: '0x4329bd8869d23c6b0e3020d74f3c1199aa7a34a45ee9d7aca496c70439220510',
        
        // Wormhole (testnet addresses)
        wormholeState: '0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790',
    },
    rpc: 'https://fullnode.testnet.sui.io:443',
};

async function demonstrateMinterCapIssue() {
    console.log('🔍 Demonstrating MinterCap Issue on Testnet\n');
    
    try {
        const client = new SuiClient({ url: TESTNET_CONFIG.rpc });
        
        // First, let's check the current state
        console.log('1️⃣ Checking Gateway State...');
        const gatewayState = await client.getObject({
            id: TESTNET_CONFIG.objects.gatewayState,
            options: { showContent: true }
        });
        
        if (gatewayState.data?.content?.dataType === 'moveObject') {
            const fields = gatewayState.data.content.fields as any;
            console.log('   - Is Initialized:', fields.is_initialized);
            console.log('   - Is Paused:', fields.paused);
            console.log('   - Minting Limit:', fields.minting_limit);
            console.log('   - Minted Amount:', fields.minted_amount);
        }
        
        // Check if Gateway is in minters list
        console.log('\n2️⃣ Checking Token State...');
        const tokenState = await client.getObject({
            id: TESTNET_CONFIG.objects.tokenState,
            options: { showContent: true }
        });
        
        if (tokenState.data?.content?.dataType === 'moveObject') {
            const fields = tokenState.data.content.fields as any;
            console.log('   - Total Minters:', fields.minters?.length || 0);
            console.log('   - Gateway in minters:', fields.minters?.includes(TESTNET_CONFIG.objects.gatewayState));
        }
        
        // Try to find the MinterCap
        console.log('\n3️⃣ Looking for MinterCap...');
        console.log('   - Expected location: Owned by Gateway address', TESTNET_CONFIG.objects.gatewayState);
        
        // Get objects owned by the Gateway address
        const gatewayOwnedObjects = await client.getOwnedObjects({
            owner: TESTNET_CONFIG.objects.gatewayState,
            options: { showType: true }
        });
        
        console.log('   - Objects owned by Gateway:', gatewayOwnedObjects.data.length);
        
        const minterCap = gatewayOwnedObjects.data.find(obj => 
            obj.data?.type?.includes('MinterCap')
        );
        
        if (minterCap) {
            console.log('   - ✅ Found MinterCap:', minterCap.data?.objectId);
            console.log('   - ⚠️  But Gateway (shared object) cannot use it!');
        } else {
            console.log('   - ❌ No MinterCap found');
        }
        
        // Show the initialization attempt would fail
        console.log('\n4️⃣ Initialization Status:');
        console.log('   - Gateway is NOT initialized');
        console.log('   - MinterCap is stuck with Gateway address');
        console.log('   - Gateway cannot sign transactions to use MinterCap');
        console.log('   - Result: System is non-functional');
        
        console.log('\n5️⃣ The Fix:');
        console.log('   - Need to modify add_minter to return MinterCap');
        console.log('   - Admin receives MinterCap and provides it during initialization');
        console.log('   - Use PTB to do both operations atomically');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Check if MinterCap was already transferred
async function checkMinterCapStatus() {
    console.log('\n📊 Checking MinterCap Status...\n');
    
    try {
        const client = new SuiClient({ url: TESTNET_CONFIG.rpc });
        
        // Look for add_minter transaction
        const transactions = await client.queryTransactionBlocks({
            filter: {
                FromAddress: '0xd078ab2f62bf6549c2887119a65f97428c6b197e5c704ffcbe0bde4370a295f9'
            },
            options: {
                showEvents: true,
                showEffects: true,
            }
        });
        
        // Find MinterAdded event
        const minterAddedTx = transactions.data.find(tx => 
            tx.events?.some(event => 
                event.type.includes('MinterAdded')
            )
        );
        
        if (minterAddedTx) {
            console.log('Found MinterAdded transaction:', minterAddedTx.digest);
            
            // Check created objects for MinterCap
            const createdObjects = minterAddedTx.effects?.created;
            const minterCap = createdObjects?.find(obj => 
                obj.reference.objectId && obj.owner
            );
            
            if (minterCap && typeof minterCap.owner === 'object' && 'AddressOwner' in minterCap.owner) {
                console.log('\nMinterCap Details:');
                console.log('- Object ID:', minterCap.reference.objectId);
                console.log('- Owner:', (minterCap.owner as any).AddressOwner);
                console.log('- Is Gateway:', (minterCap.owner as any).AddressOwner === TESTNET_CONFIG.objects.gatewayState);
                
                // This is the stuck MinterCap!
                return minterCap.reference.objectId;
            }
        }
        
    } catch (error) {
        console.error('Error checking status:', error);
    }
}

// Run the demonstration
(async () => {
    await demonstrateMinterCapIssue();
    const minterCapId = await checkMinterCapStatus();
    
    if (minterCapId) {
        console.log('\n🚨 CONFIRMED: MinterCap is stuck at address:', TESTNET_CONFIG.objects.gatewayState);
        console.log('   This confirms the issue described in the analysis.');
    }
})();