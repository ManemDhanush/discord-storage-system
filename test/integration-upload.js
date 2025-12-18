import axios from 'axios';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'http://localhost:3000';
const TEST_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const TEST_FILE_PATH = path.join(__dirname, 'test-file.bin');
const DOWNLOAD_PATH = path.join(__dirname, 'downloaded-file.bin');

async function runTest() {
    try {
        console.log('Creating test file...');
        const buffer = crypto.randomBytes(TEST_FILE_SIZE);
        fs.writeFileSync(TEST_FILE_PATH, buffer);
        const originalHash = crypto.createHash('sha256').update(buffer).digest('hex');

        console.log('Initializing upload...');
        const initRes = await axios.post(`${API_URL}/uploads/init`, {
            fileName: 'test-file.bin',
            fileSize: TEST_FILE_SIZE,
            mimeType: 'application/octet-stream',
        });

        const { uploadId, chunkSize, totalChunks } = initRes.data;
        console.log(`Upload initialized: ${uploadId}, chunks: ${totalChunks}`);

        console.log('Uploading chunks...');
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, TEST_FILE_SIZE);
            const chunk = buffer.subarray(start, end);

            await axios.put(`${API_URL}/uploads/${uploadId}/chunks/${i}`, chunk, {
                headers: { 'Content-Type': 'application/octet-stream' },
            });
            console.log(`Uploaded chunk ${i + 1}/${totalChunks}`);
        }

        console.log('Checking status...');
        const statusRes = await axios.get(`${API_URL}/uploads/${uploadId}/status`);
        console.log('Status:', statusRes.data.status);

        if (statusRes.data.status !== 'completed') {
            throw new Error('Upload not completed');
        }

        console.log('Downloading file...');
        const downloadRes = await axios.get(`${API_URL}/downloads/${uploadId}`, {
            responseType: 'arraybuffer',
        });

        fs.writeFileSync(DOWNLOAD_PATH, downloadRes.data);
        const downloadedHash = crypto.createHash('sha256').update(downloadRes.data).digest('hex');

        console.log('Verifying hash...');
        if (originalHash === downloadedHash) {
            console.log('SUCCESS: Hashes match!');
        } else {
            console.error('FAILURE: Hashes do not match!');
            console.error('Original:', originalHash);
            console.error('Downloaded:', downloadedHash);
            process.exit(1);
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        process.exit(1);
    } finally {
        // Cleanup
        if (fs.existsSync(TEST_FILE_PATH)) fs.unlinkSync(TEST_FILE_PATH);
        if (fs.existsSync(DOWNLOAD_PATH)) fs.unlinkSync(DOWNLOAD_PATH);
    }
}

runTest();
