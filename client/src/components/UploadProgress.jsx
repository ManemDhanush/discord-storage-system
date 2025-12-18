import React from 'react';
import { File, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function UploadProgress({ file, progress, status }) {
    return (
        <div className="bg-gray-800 rounded-lg p-4 mt-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                    <File className="h-6 w-6 text-blue-400" />
                    <div>
                        <p className="font-medium text-gray-200">{file.name}</p>
                        <p className="text-sm text-gray-400">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                </div>
                <div className="flex items-center">
                    {status === 'completed' && <CheckCircle className="h-6 w-6 text-green-500" />}
                    {status === 'failed' && <XCircle className="h-6 w-6 text-red-500" />}
                    {status === 'uploading' && <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />}
                </div>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <p className="text-right text-sm text-gray-400 mt-1">{progress}%</p>
        </div>
    );
}
