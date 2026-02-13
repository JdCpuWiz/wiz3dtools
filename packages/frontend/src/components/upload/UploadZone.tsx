import React, { useState, useCallback } from 'react';
import { useUpload } from '../../hooks/useUpload';
import { useQueue } from '../../hooks/useQueue';
import { UploadProgress } from './UploadProgress';
import { Button } from '../common/Button';
import type { ExtractedProduct } from '@wizqueue/shared';

export const UploadZone: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [showReview, setShowReview] = useState(false);

  const { upload, isUploading, isProcessing, invoiceStatus, reset } = useUpload();
  const { createBatch } = useQueue();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find((file) => file.type === 'application/pdf');

    if (pdfFile) {
      setSelectedFile(pdfFile);
      upload(pdfFile);
    } else {
      alert('Please upload a PDF file');
    }
  }, [upload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      upload(file);
    }
  }, [upload]);

  // When processing completes, show extracted products for review
  React.useEffect(() => {
    if (invoiceStatus?.processed && invoiceStatus.extractedData) {
      setExtractedProducts(invoiceStatus.extractedData);
      setShowReview(true);
    }
  }, [invoiceStatus]);

  const handleAddToQueue = () => {
    if (extractedProducts.length > 0) {
      createBatch(
        extractedProducts.map((product) => ({
          productName: product.productName,
          details: product.details,
          quantity: product.quantity,
          invoiceId: invoiceStatus?.invoiceId,
        }))
      );
      handleReset();
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setExtractedProducts([]);
    setShowReview(false);
    reset();
  };

  // Show review screen
  if (showReview && extractedProducts.length > 0) {
    return (
      <div className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Review Extracted Products
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            {extractedProducts.length} products extracted from {selectedFile?.name}
          </p>

          <div className="space-y-3 mb-6">
            {extractedProducts.map((product, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {product.productName}
                  </h3>
                  {product.details && (
                    <p className="text-sm text-gray-600 mt-1">{product.details}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    Quantity: {product.quantity}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleReset}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddToQueue}>
              Add to Queue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show processing status
  if (invoiceStatus?.processingError) {
    return (
      <div className="card">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg
              className="w-16 h-16 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Processing Failed</h3>
            <p className="text-sm text-gray-600">{invoiceStatus.processingError}</p>
          </div>
          <Button variant="primary" onClick={handleReset}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (isUploading || isProcessing) {
    return (
      <UploadProgress
        isUploading={isUploading}
        isProcessing={isProcessing}
        filename={selectedFile?.name || ''}
      />
    );
  }

  // Show upload zone
  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Upload Invoice
      </h2>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <svg
          className="w-16 h-16 text-gray-400 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="text-lg font-medium text-gray-900 mb-2">
          Drop your PDF invoice here
        </p>
        <p className="text-sm text-gray-600 mb-6">
          or click to browse your files
        </p>

        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <span className="btn btn-primary inline-block">
            Select PDF File
          </span>
        </label>

        <p className="text-xs text-gray-500 mt-4">
          Maximum file size: 10MB
        </p>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          How it works:
        </h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Upload your PDF invoice</li>
          <li>AI automatically extracts product information</li>
          <li>Review and confirm extracted items</li>
          <li>Products are added to your print queue</li>
        </ol>
      </div>
    </div>
  );
};
