import React, { useCallback } from 'react';
import { Upload } from 'lucide-react';

export function FilePicker({ onFileSelect }) {
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onFileSelect(files[0]);
        }
    }, [onFileSelect]);

    const handleChange = useCallback((e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            onFileSelect(files[0]);
        }
    }, [onFileSelect]);

    return (
        <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-800"
            onClick={() => document.getElementById('fileInput').click()}
        >
            <input
                type="file"
                id="fileInput"
                className="hidden"
                onChange={handleChange}
            />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-200">
                Drop file here or click to upload
            </p>
            <p className="text-sm text-gray-400 mt-2">
                Supports large files with chunked upload
            </p>
        </div>
    );
}
