import React, { useState, useRef, useEffect } from 'react';
import PDFViewer from './components/PDFViewer';
import './App.css';

// DocuSign coordinate conversion constants
const DOCUSIGN_DPI = 72; // DocuSign uses 72 DPI (points)
const UI_DPI = 96; // Standard screen DPI

// Convert UI pixels to DocuSign points
const pixelsToPoints = (pixels) => {
  if (!isFinite(pixels) || pixels < 0) return 0;
  return Math.max(0, Math.round((pixels * DOCUSIGN_DPI) / UI_DPI));
};

// Convert DocuSign points to UI pixels for display
const pointsToPixels = (points) => {
  if (!isFinite(points) || points < 0) return 0;
  return Math.max(0, Math.round((points * UI_DPI) / DOCUSIGN_DPI));
};

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [jumpToPage, setJumpToPage] = useState('');
  const [signaturePoints, setSignaturePoints] = useState([]); // Array of { x, y, xPoints, yPoints, pageNum, id }
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pageScale, setPageScale] = useState(1);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });

  // Load PDF file
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes('pdf')) {
      alert('Please upload a valid PDF file.');
      return;
    }

    // Validate file size (limit to 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('File size too large. Please upload a PDF smaller than 50MB.');
      return;
    }

    try {
      setPdfFile(file);
      setPdfFileName(file.name);

      // Show loading state
      console.log('Loading PDF...');

      const arrayBuffer = await file.arrayBuffer();

      // Initialize pdf.js with error handling
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0 // Reduce console noise
      });

      // Add timeout to loading
      const pdf = await Promise.race([
        loadingTask.promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PDF loading timeout')), 30000)
        )
      ]);

      if (!pdf || pdf.numPages === 0) {
        throw new Error('Invalid or empty PDF file');
      }

      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setSignaturePoints([]);

      console.log(`PDF loaded successfully: ${pdf.numPages} pages`);

    } catch (error) {
      console.error('Error loading PDF:', error);

      // Reset state on error
      setPdfFile(null);
      setPdfFileName(null);
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      setSignaturePoints([]);

      // Show user-friendly error message
      let errorMessage = 'Failed to load PDF. ';
      if (error.message.includes('InvalidPDFException')) {
        errorMessage += 'The file appears to be corrupted or not a valid PDF.';
      } else if (error.message.includes('MissingPDFException')) {
        errorMessage += 'The PDF file could not be found or read.';
      } else if (error.message.includes('UnexpectedResponseException')) {
        errorMessage += 'Network error while loading PDF.';
      } else if (error.message.includes('timeout')) {
        errorMessage += 'PDF loading timed out. File might be too large.';
      } else {
        errorMessage += 'Please try a different PDF file.';
      }

      alert(errorMessage);
    }
  };

  // Reset to home state (clear PDF and all data)
  const handleHome = () => {
    setPdfFile(null);
    setPdfFileName(null);
    setPdfDoc(null);
    setCurrentPage(1);
    setTotalPages(0);
    setSignaturePoints([]);
  };

  // Handle page change
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!pdfDoc) return;
      
      if (e.key === 'ArrowRight' || e.key === 'n') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        e.preventDefault();
        goToPage(currentPage - 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [pdfDoc, currentPage, totalPages]);

  // Get canvas coordinates from mouse event
  const getCanvasCoordinates = (e) => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return null;

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      // Validate scale factors
      if (!isFinite(scaleX) || !isFinite(scaleY)) return null;

      const x = (e.clientX - rect.left) * scaleX;
      let y = (e.clientY - rect.top) * scaleY;

      // Apply offset correction (subtract 10 pixels from Y coordinate only)
      y = Math.max(0, y - 10);

      // Validate coordinates
      if (!isFinite(x) || !isFinite(y)) return null;

      return { x, y };
    } catch (error) {
      console.error('Error getting canvas coordinates:', error);
      return null;
    }
  };

  // Handle click on canvas to place signature point
  const handleCanvasClick = (e) => {
    e.preventDefault(); // Prevent any default browser behavior
    e.stopPropagation(); // Stop event bubbling

    const pos = getCanvasCoordinates(e);
    if (!pos) return;

    // Create signature point
    const signaturePoint = {
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      xPoints: pixelsToPoints(pos.x),
      yPoints: pixelsToPoints(pos.y),
      pageNum: currentPage,
      id: Date.now()
    };

    setSignaturePoints(prev => [...prev, signaturePoint]);
    drawCanvas();
  };


  // Clear all signature points on current page
  const handleClearPage = () => {
    setSignaturePoints(prev => prev.filter(point => point.pageNum !== currentPage));
  };

  // Handle page jump input
  const handlePageJump = () => {
    const pageNum = parseInt(jumpToPage);
    if (pageNum >= 1 && pageNum <= totalPages) {
      goToPage(pageNum);
      setJumpToPage('');
    }
  };

  // Handle Enter key press for page jump
  const handlePageJumpKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePageJump();
    }
  };

  // Canvas drawing function for signature points
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw signature points for current page
      signaturePoints.forEach((point) => {
        if (point.pageNum === currentPage) {
          // Draw a cross marker at the point
          const crossSize = 10;
          ctx.strokeStyle = '#dc2626'; // Red color
          ctx.lineWidth = 3;
          ctx.setLineDash([]);

          // Draw cross lines
          ctx.beginPath();
          ctx.moveTo(point.x - crossSize, point.y);
          ctx.lineTo(point.x + crossSize, point.y);
          ctx.moveTo(point.x, point.y - crossSize);
          ctx.lineTo(point.x, point.y + crossSize);
          ctx.stroke();

          // Draw circle around the point
          ctx.beginPath();
          ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw coordinate label
          ctx.fillStyle = '#dc2626';
          ctx.font = 'bold 14px Arial';
          ctx.fillText(`Points: (${point.xPoints}, ${point.yPoints})`, point.x + 15, point.y - 10);
        }
      });
    } catch (error) {
      console.error('Error drawing canvas:', error);
      // Clear canvas on error
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (clearError) {
        console.error('Error clearing canvas after draw error:', clearError);
      }
    }
  };

  // Update canvas when page or signature points change
  useEffect(() => {
    drawCanvas();
  }, [signaturePoints, currentPage]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <img src="/favicon.ico" alt="PDF Coordinates Selector" className="header-icon" />
          <h1>PDF Coordinates Selector</h1>
        </div>
        {pdfFileName && (
          <div className="file-info">
            <span className="file-name">{pdfFileName}</span>
          </div>
        )}
        <div className="header-actions">
          {pdfDoc && (
            <button onClick={handleHome} className="btn btn-primary">
              🏠 Home
            </button>
          )}
        </div>
      </header>

      <div className="app-content">
        {!pdfDoc ? (
          <div className="empty-state">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              id="pdf-upload"
              style={{ display: 'none' }}
            />
            <label htmlFor="pdf-upload" className="btn btn-primary btn-upload">
              📄 Upload PDF
            </label>
            <p className="upload-hint">Upload a PDF to get started</p>
          </div>
        ) : (
          <>
            <div className="sidebar">
              <div className="rectangles-list">
                <h3>Signature Points on Page {currentPage}</h3>
                <div className="coordinate-info">
                  <p className="rectangles-hint">
                    <strong>Single Click Only:</strong> Click on the PDF where you want to place a signature (no dragging)
                  </p>
                  <div className="docusign-info">
                    <small><strong>DocuSign Points:</strong> 72 DPI coordinate system</small><br/>
                    <small>Letter page: 612×792 points (8.5"×11")</small><br/>
                    <small>Conversion: UI pixels → DocuSign points</small>
                  </div>
                </div>

                {signaturePoints.filter(p => p.pageNum === currentPage).length === 0 ? (
                  <p className="no-rectangles">No signature points placed yet</p>
                ) : (
                  <div className="rectangle-items">
                    {signaturePoints
                      .filter(p => p.pageNum === currentPage)
                      .map((point) => (
                        <div key={point.id} className="rectangle-item">
                          <div className="rect-info">
                            <div className="rect-coords">
                              <span className="coord-label">DocuSign Points:</span> ({point.xPoints}, {point.yPoints})
                            </div>
                            <div className="rect-inches">
                              Inches: ({(point.xPoints/72).toFixed(2)}", {(point.yPoints/72).toFixed(2)}")
                            </div>
                          </div>
                          <div className="point-status">
                            <span className="point-checkmark">✓</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {signaturePoints.filter(p => p.pageNum === currentPage).length > 0 && (
                  <div className="points-summary">
                    <div className="summary-item">
                      <strong>Points on this page:</strong> {signaturePoints.filter(p => p.pageNum === currentPage).length}
                    </div>
                    <div className="summary-item">
                      <strong>Total points:</strong> {signaturePoints.length}
                    </div>
                    <div className="clear-action">
                      <span
                        onClick={handleClearPage}
                        className="clear-all-link"
                        title="Clear all points on this page"
                      >
                        Clear All
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="main-viewer" ref={containerRef}>
              <div className="viewer-controls">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn btn-sm"
                >
                  ← Prev
                </button>
                <div className="page-navigation">
                  <span className="page-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="page-jump">
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={jumpToPage}
                      onChange={(e) => setJumpToPage(e.target.value)}
                      onKeyPress={handlePageJumpKeyPress}
                      className="page-input"
                    />
                    <button
                      onClick={handlePageJump}
                      className="btn btn-sm btn-secondary"
                      disabled={!jumpToPage || jumpToPage < 1 || jumpToPage > totalPages}
                    >
                      Go
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn btn-sm"
                >
                  Next →
                </button>
                <span className="keyboard-hint">(Use ← → or n/p keys)</span>
              </div>

              <div className="pdf-container">
                <PDFViewer
                  pdfDoc={pdfDoc}
                  pageNum={currentPage}
                  onPageRender={(width, height, scale) => {
                    setPageDimensions({ width, height });
                    setPageScale(scale);
                    const canvas = canvasRef.current;
                    if (canvas) {
                      canvas.width = width;
                      canvas.height = height;
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="drawing-canvas"
                  onClick={handleCanvasClick}
                  style={{
                    cursor: 'crosshair',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none'
                  }}
                />
              </div>

              <div className="drawing-hint">
                Click on the PDF where you want to place a signature — DocuSign coordinates will appear in the sidebar
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;


