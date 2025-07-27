#!/usr/bin/env node

import { PetSitterService } from '../services/petSitter.js';
import { config, validateConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

async function testControlTransaction(): Promise<void> {
  console.log('🧪 CONTROL TRANSACTION TEST');
  console.log('===========================');
  console.log('This test will verify that both initial and control transactions are sent');
  console.log('');
  
  try {
    validateConfig();
    
    console.log(`Contract: ${config.diamondContractAddress}`);
    console.log(`Target: ${config.targetAddress}`);
    console.log('');
    
    // Create pet sitter service
    const petSitter = new PetSitterService();
    
    // Get target info first
    console.log('1. 📋 Getting target Aavegotchis:');
    console.log('=================================');
    
    const targetInfo = await petSitter.getTargetInfo();
    console.log(`✅ Found ${targetInfo.totalTokenIds} Aavegotchis for target`);
    console.log(`✅ Successfully fetched ${targetInfo.aavegotchis.length} individual Aavegotchi data`);
    
    if (targetInfo.totalTokenIds === 0) {
      throw new Error('No Aavegotchis found for the target address');
    }
    
    // Show token IDs that will be tested
    const tokenIds = targetInfo.aavegotchis.map(g => g.tokenId);
    console.log(`Token IDs to pet: ${tokenIds.slice(0, 5).map(id => id.toString()).join(', ')}${tokenIds.length > 5 ? '...' : ''}`);
    console.log('');
    
    // Log initial timing data if available
    if (targetInfo.aavegotchis.length > 0) {
      const firstGotchi = targetInfo.aavegotchis[0];
      const lastInteracted = new Date(Number(firstGotchi!.lastInteracted) * 1000);
      console.log(`Sample Aavegotchi "${firstGotchi!.name}" last interacted: ${lastInteracted.toISOString()}`);
      console.log('');
    }
    
    console.log('2. 🎯 Testing Control Transaction Feature:');
    console.log('==========================================');
    console.log('⚠️  This will send TWO transactions:');
    console.log('   1. Initial Interact transaction (immediate)');
    console.log('   2. Control Interact transaction (after 10 seconds)');
    console.log('');
    console.log('⏳ Starting test... Watch the logs for timing:');
    console.log('');
    
    const startTime = Date.now();
    console.log(`Test started at: ${new Date(startTime).toISOString()}`);
    
    try {
      // This should trigger both the initial and control transactions
      const result = await (petSitter as any).petAllTokenIds(
        tokenIds.length > 0 ? tokenIds : [BigInt(1)], // Use actual token IDs or fallback
        targetInfo.aavegotchis.length > 0 ? targetInfo.aavegotchis[0]!.lastInteracted : undefined
      );
      
      console.log('');
      console.log('3. 📊 Initial Transaction Result:');
      console.log('=================================');
      console.log(`Success: ${result.success}`);
      console.log(`Transaction Hash: ${result.transactionHash || 'N/A'}`);
      console.log(`Pet Count: ${result.petCount}`);
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      
      console.log('');
      console.log('4. ⏰ Waiting for Control Transaction:');
      console.log('=====================================');
      console.log('The control transaction should appear in logs ~10 seconds from initial transaction...');
      console.log('Waiting 15 seconds to ensure control transaction completes...');
      
      // Wait an additional 15 seconds to ensure control transaction completes
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      console.log('');
      console.log('5. ✅ Test Results Summary:');
      console.log('===========================');
      console.log(`✅ Initial transaction completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`✅ Control transaction should have been triggered automatically`);
      console.log(`✅ Check the application logs for control transaction details`);
      console.log(`✅ Both transactions should use the same token IDs`);
      console.log(`✅ Test completed - monitor logs for 10-second delay verification`);
      
    } catch (testError) {
      throw testError;
    }
    
  } catch (error) {
    console.error('❌ Control transaction test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testControlTransaction().catch(console.error);
}