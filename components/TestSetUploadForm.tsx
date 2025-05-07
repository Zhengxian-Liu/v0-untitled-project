'use client';

import React, { useState, ChangeEvent, useRef } from 'react';
import type { UploadedFileInfo } from '../types'; // Assuming types.tsx is in the root
import { Button } from '@/components/ui/button';

interface TestSetUploadFormProps {
  onFileSelect: (fileInfo: UploadedFileInfo | null) => void;
}

const TestSetUploadForm: React.FC<TestSetUploadFormProps> = ({ onFileSelect }) => {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    onFileSelect(null);

    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel', // Older .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
      ];

      if (!allowedTypes.includes(file.type)) {
        const errorMessage = `Invalid file type: ${file.type}. Please upload a CSV or Excel file.`;
        setError(errorMessage);
        console.warn(errorMessage);
        if (event.target) {
            event.target.value = ''; // Reset the input
        }
        return;
      }
      
      const completeFileInfo: UploadedFileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        fileObject: file,
        headers: [] // Headers will be populated in a later step by the parent/modal logic
      };

      onFileSelect(completeFileInfo); // Pass the complete info up
      console.log('Selected file in TestSetUploadForm:', completeFileInfo);
    } else {
      onFileSelect(null); // Ensure parent is notified if no file is selected (e.g., user cancels dialog)
    }
  };

  const handleButtonClick = () => {
    setError(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    fileInputRef.current?.click();
  };

  return (
    <div>
      <Button
        type="button"
        onClick={handleButtonClick}
        className="w-full px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 cursor-pointer"
      >
        Select CSV or Excel File
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        id="testSetFileInputInternal"
        name="testSetFileInputInternal"
        className="hidden"
        accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleFileChange}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default TestSetUploadForm; 