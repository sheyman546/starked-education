import React, { useState, useRef, useCallback } from 'react';
import { useQuery } from 'react-query';
import { Download, ZoomIn, ZoomOut, Maximize2, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { progressAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdfjs/${pdfjs.version}/pdf.worker.min.js`;

const DocumentViewer = ({ content, onProgressUpdate, onComplete }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  
  const { user } = useAuth();
  const documentRef = useRef(null);

  // Get content progress
  const { data: progressData } = useQuery(
    ['content-progress', content._id],
    () => progressAPI.getContentProgress(content._id),
    {
      enabled: !!content._id && !!user,
      onSuccess: (data) => {
        if (data.lastPosition) {
          setPageNumber(Math.max(1, Math.floor(data.lastPosition)));
        }
      },
    }
  );

  // Get document URL
  const getDocumentUrl = () => {
    const documentFile = content.files.find(f => f.type === 'document');
    return documentFile?.url || '';
  };

  // Handle document load success
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    
    // Calculate reading progress based on current page
    const progress = ((pageNumber - 1) / numPages) * 100;
    setReadingProgress(progress);
    
    if (onProgressUpdate) {
      onProgressUpdate(progress);
    }
  };

  // Handle page change
  const changePage = useCallback((offset) => {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      return Math.min(Math.max(1, newPage), numPages);
    });
  }, [numPages]);

  // Handle zoom
  const handleZoom = (zoomIn) => {
    setScale(prevScale => {
      const newScale = zoomIn ? prevScale + 0.25 : prevScale - 0.25;
      return Math.min(Math.max(0.5, newScale), 3.0);
    });
  };

  // Update progress when page changes
  const updateProgress = useCallback(async () => {
    if (!user || !numPages) return;
    
    const progress = ((pageNumber - 1) / numPages) * 100;
    
    try {
      await progressAPI.updateContentProgress(content._id, {
        progress: Math.min(progress, 100),
        lastPosition: pageNumber,
        watchTime: 30, // Assume 30 seconds per page
      });
      
      setReadingProgress(progress);
      
      if (onProgressUpdate) {
        onProgressUpdate(progress);
      }
      
      // Mark as completed if on last page
      if (pageNumber === numPages && progressData?.status !== 'completed') {
        await progressAPI.markContentCompleted(content._id);
        if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }, [pageNumber, numPages, user, content._id, onProgressUpdate, onComplete, progressData?.status]);

  // Handle download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getDocumentUrl();
    link.download = content.title || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    // In a real implementation, this would highlight search terms in the PDF
    console.log('Searching for:', searchTerm);
  };

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        changePage(-1);
      } else if (e.key === 'ArrowRight') {
        changePage(1);
      } else if (e.key === '+' || e.key === '=') {
        handleZoom(true);
      } else if (e.key === '-') {
        handleZoom(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [changePage]);

  // Update progress when page number changes
  React.useEffect(() => {
    updateProgress();
  }, [pageNumber, updateProgress]);

  // Render different document types
  const renderDocument = () => {
    const documentFile = content.files.find(f => f.type === 'document');
    const fileExtension = documentFile?.format?.toLowerCase();

    if (fileExtension === 'pdf') {
      return (
        <div className="flex flex-col items-center">
          <Document
            file={getDocumentUrl()}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            }
            error={
              <div className="text-center text-red-600">
                Failed to load PDF document
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="border border-gray-300 shadow-lg"
            />
          </Document>
        </div>
      );
    }

    // For non-PDF documents, show in iframe or download link
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {content.title}
        </h3>
        <p className="text-gray-600 mb-6">
          This document type is not supported for inline viewing.
        </p>
        <button
          onClick={handleDownload}
          className="btn-primary"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Document
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {numPages ? `Page ${pageNumber} of ${numPages}` : 'Loading...'}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Search */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Search in document"
            >
              <Search className="w-5 h-5" />
            </button>
            
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleZoom(false)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="px-2 text-sm text-gray-600">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => handleZoom(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
            
            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download document"
            >
              <Download className="w-5 h-5" />
            </button>
            
            {/* Fullscreen */}
            <button
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="mt-4">
            <form onSubmit={handleSearch} className="flex space-x-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search in document..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </form>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Reading Progress</span>
            <span>{Math.round(readingProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${readingProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="p-4 bg-gray-50 min-h-[600px] overflow-auto" ref={documentRef}>
        {renderDocument()}
      </div>

      {/* Navigation Controls */}
      {numPages > 1 && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max={numPages}
                value={pageNumber}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= numPages) {
                    setPageNumber(page);
                  }
                }}
                className="w-16 px-2 py-1 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-600">of {numPages}</span>
            </div>

            <button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
