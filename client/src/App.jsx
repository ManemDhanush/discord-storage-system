import React, { useState } from 'react';
import { FilePicker } from './components/FilePicker';
import { UploadProgress } from './components/UploadProgress';
import { uploadManager } from './services/uploadManager';
import { Download, RefreshCw } from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, completed, failed
  const [progress, setProgress] = useState(0);
  const [uploadId, setUploadId] = useState(null);

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setStatus('uploading');
    setProgress(0);

    try {
      const id = await uploadManager.uploadFile(selectedFile, (p) => {
        setProgress(p);
      });
      setUploadId(id);
      setStatus('completed');
    } catch (error) {
      console.error(error);
      setStatus('failed');
    }
  };

  const handleReset = () => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setUploadId(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
            Discord Storage System
          </h1>
          <p className="text-gray-400">
            Secure, chunked, and resumable file uploads
          </p>
        </header>

        <main>
          {!file ? (
            <FilePicker onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              <UploadProgress
                file={file}
                progress={progress}
                status={status}
              />

              {status === 'completed' && (
                <div className="bg-gray-800 rounded-lg p-6 border border-green-500/30">
                  <h3 className="text-xl font-semibold text-green-400 mb-4">
                    Upload Complete!
                  </h3>
                  <div className="flex space-x-4">
                    <a
                      href={`/downloads/${uploadId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex-1"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download File
                    </a>
                    <button
                      onClick={handleReset}
                      className="flex items-center justify-center px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Upload Another
                    </button>
                  </div>
                </div>
              )}

              {status === 'failed' && (
                <div className="text-center">
                  <button
                    onClick={handleReset}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
