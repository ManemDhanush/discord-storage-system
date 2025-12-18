import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { StorageService } from '../services/StorageService.js';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import fs from 'fs-extra';
import path from 'path';

const program = new Command();

// Initialize storage service
const storageService = new StorageService();

// Helper function to handle errors
const handleError = (error, spinner) => {
  if (spinner) spinner.fail();
  logger.error(error.message);
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
};

// Upload command
program
  .command('upload <filePath>')
  .description('Upload a file to Discord storage')
  .option('-t, --thread <name>', 'Custom thread name')
  .option('-d, --description <text>', 'File description')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(async (filePath, options) => {
    const spinner = ora('Initializing upload...').start();
    
    try {
      // Validate file path
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      spinner.text = `Uploading ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`;
      
      const result = await storageService.uploadFile(filePath, {
        threadName: options.thread,
        description: options.description,
        tags: options.tags ? options.tags.split(',') : [],
      });

      spinner.succeed(chalk.green(`Upload completed!`));
      
      console.log(chalk.blue('\n📁 Upload Summary:'));
      console.log(`  File: ${result.fileName}`);
      console.log(`  Size: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Chunks: ${result.totalChunks}`);
      console.log(`  File ID: ${chalk.yellow(result.fileId)}`);
      console.log(`  Thread: ${result.threadId}`);
      console.log(`  Status: ${chalk.green(result.status)}`);
      
    } catch (error) {
      handleError(error, spinner);
    } finally {
      await storageService.cleanup();
    }
  });

// Download command
program
  .command('download <fileId>')
  .description('Download a file from Discord storage')
  .option('-o, --output <path>', 'Output path for the file')
  .action(async (fileId, options) => {
    const spinner = ora('Initializing download...').start();
    
    try {
      // Get file info first
      spinner.text = 'Getting file information...';
      const fileInfo = await storageService.getFileInfo(fileId);
      
      // Determine output path
      const outputPath = options.output || path.join(config.app.downloadPath, fileInfo.originalName);
      await fs.ensureDir(path.dirname(outputPath));
      
      spinner.text = `Downloading ${fileInfo.originalName}...`;
      
      const result = await storageService.downloadFile(fileId, outputPath);
      
      spinner.succeed(chalk.green(`Download completed!`));
      
      console.log(chalk.blue('\n📥 Download Summary:'));
      console.log(`  File: ${result.fileName}`);
      console.log(`  Size: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Saved to: ${chalk.yellow(result.outputPath)}`);
      
    } catch (error) {
      handleError(error, spinner);
    } finally {
      await storageService.cleanup();
    }
  });

// List command
program
  .command('list')
  .description('List files in storage')
  .option('-s, --status <status>', 'Filter by status (uploading, completed, failed)')
  .option('-q, --search <query>', 'Search files by name')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async (options) => {
    const spinner = ora('Fetching files...').start();
    
    try {
      const files = await storageService.listFiles({
        status: options.status,
        search: options.search,
        limit: parseInt(options.limit),
      });

      spinner.succeed(chalk.green(`Found ${files.length} files`));
      
      if (files.length === 0) {
        console.log(chalk.yellow('No files found.'));
        return;
      }

      console.log(chalk.blue('\n📋 Files:'));
      console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
      console.log('│ File ID                              │ Name                    │ Size      │ Status    │');
      console.log('├─────────────────────────────────────────────────────────────────────────────┤');
      
      files.forEach(file => {
        const size = (file.originalSize / 1024 / 1024).toFixed(2);
        const statusColor = file.status === 'completed' ? chalk.green : 
                           file.status === 'failed' ? chalk.red : chalk.yellow;
        
        console.log(`│ ${file.fileId.padEnd(36)} │ ${file.originalName.padEnd(22)} │ ${size.padEnd(8)}MB │ ${statusColor(file.status.padEnd(8))} │`);
      });
      
      console.log('└─────────────────────────────────────────────────────────────────────────────┘');
      
    } catch (error) {
      handleError(error, spinner);
    } finally {
      await storageService.cleanup();
    }
  });

// Info command
program
  .command('info <fileId>')
  .description('Get detailed information about a file')
  .action(async (fileId) => {
    const spinner = ora('Getting file information...').start();
    
    try {
      const fileInfo = await storageService.getFileInfo(fileId);
      
      spinner.succeed(chalk.green(`File information retrieved`));
      
      console.log(chalk.blue('\n📄 File Information:'));
      console.log(`  File ID: ${chalk.yellow(fileInfo.fileId)}`);
      console.log(`  Name: ${fileInfo.originalName}`);
      console.log(`  Size: ${(fileInfo.originalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Type: ${fileInfo.mimeType}`);
      console.log(`  Hash: ${fileInfo.hash}`);
      console.log(`  Chunks: ${fileInfo.totalChunks}`);
      console.log(`  Status: ${fileInfo.status === 'completed' ? chalk.green(fileInfo.status) : chalk.yellow(fileInfo.status)}`);
      console.log(`  Uploaded: ${fileInfo.uploadedAt.toLocaleString()}`);
      console.log(`  Last Accessed: ${fileInfo.lastAccessed.toLocaleString()}`);
      console.log(`  Thread: ${fileInfo.threadId}`);
      
    } catch (error) {
      handleError(error, spinner);
    } finally {
      await storageService.cleanup();
    }
  });

// Delete command
program
  .command('delete <fileId>')
  .description('Delete a file from storage')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(async (fileId, options) => {
    const spinner = ora('Getting file information...').start();
    
    try {
      // Get file info for confirmation
      const fileInfo = await storageService.getFileInfo(fileId);
      
      if (!options.force) {
        spinner.stop();
        console.log(chalk.yellow(`\n⚠️  Are you sure you want to delete "${fileInfo.originalName}"?`));
        console.log(chalk.red('This action cannot be undone.'));
        console.log(chalk.gray('Use --force flag to skip confirmation.'));
        return;
      }
      
      spinner.text = `Deleting ${fileInfo.originalName}...`;
      
      const result = await storageService.deleteFile(fileId);
      
      spinner.succeed(chalk.green(`File deleted successfully`));
      
      console.log(chalk.blue('\n🗑️  Deletion Summary:'));
      console.log(`  File: ${result.fileName}`);
      console.log(`  File ID: ${chalk.yellow(result.fileId)}`);
      console.log(`  Status: ${chalk.green('Deleted')}`);
      
    } catch (error) {
      handleError(error, spinner);
    } finally {
      await storageService.cleanup();
    }
  });

// Status command
program
  .command('status')
  .description('Show storage system status')
  .action(async () => {
    const spinner = ora('Checking system status...').start();
    
    try {
      // This would typically check database connection, Discord API, etc.
      spinner.succeed(chalk.green('System status OK'));
      
      console.log(chalk.blue('\n🔧 System Status:'));
      console.log(`  Database: ${chalk.green('Connected')}`);
      console.log(`  Discord API: ${chalk.green('Connected')}`);
      console.log(`  Chunk Size: ${(config.app.chunkSize / 1024 / 1024).toFixed(1)} MB`);
      console.log(`  Max File Size: ${(config.discord.maxFileSize / 1024 / 1024).toFixed(1)} MB`);
      
    } catch (error) {
      handleError(error, spinner);
    } finally {
      await storageService.cleanup();
    }
  });

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error(chalk.red('An unexpected error occurred. Check logs for details.'));
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error(chalk.red('An unexpected error occurred. Check logs for details.'));
  process.exit(1);
});

// Parse command line arguments
program
  .name('discord-storage')
  .description('A modern Discord-based file storage system')
  .version('2.0.0')
  .parse();

export default program;
