import axios from 'axios';

export class UploadManager {
    constructor(concurrency = 3) {
        this.concurrency = concurrency;
        this.activeUploads = new Map(); // uploadId -> { status, progress, controller }
    }

    async uploadFile(file, onProgress) {
        try {
            // 1. Initialize upload
            const initResponse = await axios.post('/uploads/init', {
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
            });

            const { uploadId, chunkSize, totalChunks } = initResponse.data;

            this.activeUploads.set(uploadId, {
                status: 'uploading',
                progress: 0,
                controller: new AbortController(),
            });

            // 2. Upload chunks
            const chunks = [];
            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                chunks.push({
                    index: i,
                    blob: file.slice(start, end),
                });
            }

            let uploadedChunks = 0;
            const uploadChunk = async (chunk) => {
                const { index, blob } = chunk;

                await axios.put(`/uploads/${uploadId}/chunks/${index}`, blob, {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
                    signal: this.activeUploads.get(uploadId).controller.signal,
                });

                uploadedChunks++;
                const progress = Math.round((uploadedChunks / totalChunks) * 100);
                this.activeUploads.get(uploadId).progress = progress;
                onProgress(progress);
            };

            // Bounded concurrency
            const queue = [...chunks];
            const workers = [];

            for (let i = 0; i < this.concurrency; i++) {
                workers.push(async () => {
                    while (queue.length > 0) {
                        const chunk = queue.shift();
                        try {
                            await uploadChunk(chunk);
                        } catch (error) {
                            console.error(`Error uploading chunk ${chunk.index}:`, error);
                            // Simple retry logic: put back in queue if not aborted
                            if (!axios.isCancel(error)) {
                                // TODO: Implement max retries
                                queue.push(chunk);
                            } else {
                                break;
                            }
                        }
                    }
                });
            }

            await Promise.all(workers.map(w => w()));

            this.activeUploads.get(uploadId).status = 'completed';
            return uploadId;
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    cancelUpload(uploadId) {
        if (this.activeUploads.has(uploadId)) {
            this.activeUploads.get(uploadId).controller.abort();
            this.activeUploads.get(uploadId).status = 'cancelled';
        }
    }
}

export const uploadManager = new UploadManager();
