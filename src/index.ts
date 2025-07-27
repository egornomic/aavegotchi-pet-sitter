#!/usr/bin/env node

import { config, validateConfig } from './config/index.js';
import { PetSitterService } from './services/petSitter.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    logger.info('🎮 Aavegotchi Pet Sitter v2.0 - Base Chain Edition');
    logger.info('Configuration loaded', {
      targetAddress: config.targetAddress,
      contractAddress: config.diamondContractAddress,
      petInterval: `${config.petIntervalHours}h`,
      chainId: 8453,
    });

    // Initialize pet sitter service
    const petSitter = new PetSitterService();

    // Handle graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await petSitter.stop();
        logger.info('Shutdown completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });

    // Get initial target info for validation
    const targetInfo = await petSitter.getTargetInfo();
    logger.info('Target validation successful', {
      totalTokenIds: targetInfo.totalTokenIds,
      successfulFetches: targetInfo.aavegotchis.length,
      tokenIds: targetInfo.aavegotchis.map(g => g.tokenId.toString()),
    });

    if (targetInfo.totalTokenIds === 0) {
      throw new Error(`No Aavegotchis found for target address: ${config.targetAddress}`);
    }

    if (targetInfo.aavegotchis.length === 0) {
      logger.warn('No individual Aavegotchi data could be fetched, but will proceed with failure-safe petting using token IDs only');
    }

    // Start the pet sitter
    await petSitter.start();

    // Keep the process running
    logger.info('🚀 Pet Sitter is now running. Press Ctrl+C to stop.');
    
    // Status reporting interval
    setInterval(() => {
      const status = petSitter.getStatus();
      logger.info('Status report', {
        isRunning: status.isRunning,
        totalPets: status.totalPets,
        errors: status.errors,
        nextPet: status.nextPetTime ? new Date(status.nextPetTime).toISOString() : 'unknown',
      });
    }, 30 * 60 * 1000); // Report every 30 minutes

  } catch (error) {
    logger.error('Failed to start pet sitter', { error });
    
    if (error instanceof Error) {
      logger.error('Error details', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    
    process.exit(1);
  }
}

// Handle module loading
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}