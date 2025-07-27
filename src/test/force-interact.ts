#!/usr/bin/env node

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config, validateConfig } from '../config/index.js';

async function forceInteractTest(): Promise<void> {
  console.log('🚀 FORCED INTERACT TRANSACTION TEST');
  console.log('===================================');
  console.log('⚠️  This will attempt to pet Aavegotchis regardless of cooldown!');
  console.log('');
  
  try {
    validateConfig();
    
    const baseChain = {
      id: 8453,
      name: 'Base',
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      rpcUrls: {
        default: { http: [config.baseRpcUrl] },
        public: { http: [config.baseRpcUrl] },
      },
    } as const;

    const publicClient = createPublicClient({
      chain: baseChain,
      transport: http(config.baseRpcUrl),
    });

    const account = privateKeyToAccount(config.privateKey);
    const walletClient = createWalletClient({
      account,
      chain: baseChain,
      transport: http(config.baseRpcUrl),
    });

    console.log(`Contract: ${config.diamondContractAddress}`);
    console.log(`Bot Account: ${account.address}`);
    console.log(`Target: ${config.targetAddress}`);

    // Balance checks removed - using default network gas settings

    // Get a few token IDs to test with
    console.log('\n1. 📋 Getting Token IDs to Test:');
    console.log('===============================');
    
    const tokenIds = await publicClient.readContract({
      address: config.diamondContractAddress,
      abi: [
        {
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'tokenIdsOfOwner',
          outputs: [{ name: 'tokenIds_', type: 'uint32[]' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'tokenIdsOfOwner',
      args: [config.targetAddress],
    });

    console.log(`✅ Found ${tokenIds.length} total Aavegotchis`);
    
    // Use just 1 Aavegotchi for testing to minimize gas cost
    if (tokenIds.length === 0) {
      throw new Error('No Aavegotchis found for the target address');
    }
    const testTokenIds = [BigInt(tokenIds[0]!)]; // Convert uint32 to uint256
    console.log(`Testing with Token ID: ${testTokenIds[0]}`);

    // Get current data before interaction
    console.log('\n2. 📊 Pre-Interaction Data:');
    console.log('===========================');
    
    const preGotchi = await publicClient.readContract({
      address: config.diamondContractAddress,
      abi: [
        {
          inputs: [{ name: '_tokenId', type: 'uint256' }],
          name: 'getAavegotchi',
          outputs: [
            {
              components: [
                { name: 'tokenId', type: 'uint256' },
                { name: 'name', type: 'string' },
                { name: 'owner', type: 'address' },
                { name: 'randomNumber', type: 'uint256' },
                { name: 'status', type: 'uint256' },
                { name: 'numericTraits', type: 'int16[6]' },
                { name: 'modifiedNumericTraits', type: 'int16[6]' },
                { name: 'equippedWearables', type: 'uint16[16]' },
                { name: 'collateral', type: 'address' },
                { name: 'escrow', type: 'address' },
                { name: 'stakedAmount', type: 'uint256' },
                { name: 'minimumStake', type: 'uint256' },
                { name: 'kinship', type: 'uint256' },
                { name: 'lastInteracted', type: 'uint256' },
                { name: 'experience', type: 'uint256' },
                { name: 'toNextLevel', type: 'uint256' },
                { name: 'usedSkillPoints', type: 'uint256' },
                { name: 'level', type: 'uint256' },
                { name: 'hauntId', type: 'uint256' },
                { name: 'baseRarityScore', type: 'uint256' },
                { name: 'modifiedRarityScore', type: 'uint256' },
                { name: 'locked', type: 'bool' },
              ],
              name: 'aavegotchiInfo_',
              type: 'tuple',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'getAavegotchi',
      args: [testTokenIds[0]!],
    });

    const preLastInteracted = new Date(Number(preGotchi.lastInteracted) * 1000);
    console.log(`Name: "${preGotchi.name}"`);
    console.log(`Kinship: ${preGotchi.kinship}`);
    console.log(`Level: ${preGotchi.level}`);
    console.log(`Last Interacted: ${preLastInteracted.toISOString()}`);

    // Gas estimation
    console.log('\n3. ⛽ Gas Estimation:');
    console.log('====================');
    
    const gasEstimate = await publicClient.estimateContractGas({
      address: config.diamondContractAddress,
      abi: [
        {
          inputs: [{ name: '_tokenIds', type: 'uint256[]' }],
          name: 'interact',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'interact',
      args: [testTokenIds],
      account: account.address,
    });

    console.log(`Gas Estimate: ${gasEstimate} gas`);

    // Execute the transaction
    console.log('\n4. 🚀 EXECUTING INTERACT TRANSACTION:');
    console.log('====================================');
    console.log('⚠️  This is a LIVE transaction on Base mainnet!');
    console.log(`Attempting to pet "${preGotchi.name}" (ID: ${testTokenIds[0]})...`);
    
    try {
      const hash = await walletClient.writeContract({
        address: config.diamondContractAddress,
        abi: [
          {
            inputs: [{ name: '_tokenIds', type: 'uint256[]' }],
            name: 'interact',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'interact',
        args: [testTokenIds],
      });
      
      console.log(`✅ TRANSACTION SUBMITTED!`);
      console.log(`Transaction Hash: ${hash}`);
      console.log(`BaseScan URL: https://basescan.org/tx/${hash}`);
      
      console.log('\n⏳ Waiting for confirmation...');
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        timeout: 60000 // 60 second timeout
      });
      
      console.log('\n5. 📋 TRANSACTION RESULTS:');
      console.log('=========================');
      
      if (receipt.status === 'success') {
        console.log(`✅ TRANSACTION SUCCESSFUL!`);
        console.log(`Block Number: ${receipt.blockNumber}`);
        console.log(`Gas Used: ${receipt.gasUsed} / ${gasEstimate} estimated`);
        console.log(`Actual Gas Efficiency: ${Number(receipt.gasUsed) / Number(gasEstimate) * 100}%`);
        
        // Check if the interaction was successful or if it was a cooldown error
        console.log('\n6. 🔍 Verifying Results:');
        console.log('========================');
        
        // Get updated Aavegotchi data
        const postGotchi = await publicClient.readContract({
          address: config.diamondContractAddress,
          abi: [
            {
              inputs: [{ name: '_tokenId', type: 'uint256' }],
              name: 'getAavegotchi',
              outputs: [
                {
                  components: [
                    { name: 'tokenId', type: 'uint256' },
                    { name: 'name', type: 'string' },
                    { name: 'owner', type: 'address' },
                    { name: 'randomNumber', type: 'uint256' },
                    { name: 'status', type: 'uint256' },
                    { name: 'numericTraits', type: 'int16[6]' },
                    { name: 'modifiedNumericTraits', type: 'int16[6]' },
                    { name: 'equippedWearables', type: 'uint16[16]' },
                    { name: 'collateral', type: 'address' },
                    { name: 'escrow', type: 'address' },
                    { name: 'stakedAmount', type: 'uint256' },
                    { name: 'minimumStake', type: 'uint256' },
                    { name: 'kinship', type: 'uint256' },
                    { name: 'lastInteracted', type: 'uint256' },
                    { name: 'experience', type: 'uint256' },
                    { name: 'toNextLevel', type: 'uint256' },
                    { name: 'usedSkillPoints', type: 'uint256' },
                    { name: 'level', type: 'uint256' },
                    { name: 'hauntId', type: 'uint256' },
                    { name: 'baseRarityScore', type: 'uint256' },
                    { name: 'modifiedRarityScore', type: 'uint256' },
                    { name: 'locked', type: 'bool' },
                  ],
                  name: 'aavegotchiInfo_',
                  type: 'tuple',
                },
              ],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'getAavegotchi',
          args: [testTokenIds[0]!],
        });

        const postLastInteracted = new Date(Number(postGotchi.lastInteracted) * 1000);
        
        console.log('📊 BEFORE vs AFTER:');
        console.log(`Kinship: ${preGotchi.kinship} → ${postGotchi.kinship} (${postGotchi.kinship > preGotchi.kinship ? '+' : ''}${Number(postGotchi.kinship) - Number(preGotchi.kinship)})`);
        console.log(`Level: ${preGotchi.level} → ${postGotchi.level}`);
        console.log(`Last Interacted:`);
        console.log(`  Before: ${preLastInteracted.toISOString()}`);
        console.log(`  After:  ${postLastInteracted.toISOString()}`);
        
        if (postGotchi.lastInteracted > preGotchi.lastInteracted) {
          console.log('🎉 SUCCESS! Interaction timestamp updated - Pet was successful!');
        } else {
          console.log('⚠️  Timestamp unchanged - Likely hit cooldown period but transaction still succeeded');
        }
        
        if (postGotchi.kinship > preGotchi.kinship) {
          console.log('💖 Kinship increased! Aavegotchi is happier!');
        }
        
      } else {
        console.log(`❌ TRANSACTION FAILED`);
        console.log(`Status: ${receipt.status}`);
      }
      
    } catch (txError) {
      console.log(`❌ TRANSACTION ERROR: ${txError instanceof Error ? txError.message : txError}`);
      
      // Try to analyze the error
      if (txError instanceof Error) {
        if (txError.message.includes('lastInteracted')) {
          console.log('💡 This appears to be a cooldown error - function works but Aavegotchi was recently petted');
        } else if (txError.message.includes('insufficient funds')) {
          console.log('💡 Insufficient ETH for gas fees');
        } else {
          console.log('💡 Unknown error - function signature might be incorrect');
        }
      }
    }

    console.log('\n🏁 INTERACT FUNCTION TEST COMPLETE');
    console.log('==================================');
    
  } catch (error) {
    console.error('❌ Force interact test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  forceInteractTest().catch(console.error);
}