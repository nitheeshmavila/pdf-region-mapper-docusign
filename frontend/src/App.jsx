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
  const [rectangles, setRectangles] = useState([]); // Array of { x, y, width, height, pageNum, xPoints, yPoints, widthPoints, heightPoints }
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const drawingStateRef = useRef({
    isDrawing: false,
    currentRect: null,
    startPos: null
  });
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
      setRectangles([]);

      // Reset drawing state
      drawingStateRef.current = {
        isDrawing: false,
        currentRect: null,
        startPos: null
      };

      console.log(`PDF loaded successfully: ${pdf.numPages} pages`);

    } catch (error) {
      console.error('Error loading PDF:', error);

      // Reset state on error
      setPdfFile(null);
      setPdfFileName(null);
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      setRectangles([]);

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
    setRectangles([]);
    setCurrentRect(null);
    setIsDrawing(false);
    setStartPos(null);
  };

  // Handle page change
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setCurrentRect(null);
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

  // Get top-left corner coordinates
  const getTopLeftCoordinates = (x1, y1, x2, y2) => {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    
    return {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(width),
      height: Math.round(height)
    };
  };

  // Canvas mouse handlers for drawing rectangles
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
      const y = (e.clientY - rect.top) * scaleY;

      // Validate coordinates
      if (!isFinite(x) || !isFinite(y)) return null;

      return { x, y };
    } catch (error) {
      console.error('Error getting canvas coordinates:', error);
      return null;
    }
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasCoordinates(e);
    if (!pos) return;

    drawingStateRef.current.isDrawing = true;
    drawingStateRef.current.startPos = pos;
    drawingStateRef.current.currentRect = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };

    // Trigger immediate draw
    drawCanvas();
  };

  const handleMouseMove = (e) => {
    if (!drawingStateRef.current.isDrawing || !drawingStateRef.current.startPos) return;

    const pos = getCanvasCoordinates(e);
    if (!pos) return;

    drawingStateRef.current.currentRect = {
      x1: drawingStateRef.current.startPos.x,
      y1: drawingStateRef.current.startPos.y,
      x2: pos.x,
      y2: pos.y
    };

    // Efficient drawing without triggering re-renders
    drawCanvas();
  };

  const handleMouseUp = (e) => {
    if (!drawingStateRef.current.isDrawing || !drawingStateRef.current.startPos) return;

    const pos = getCanvasCoordinates(e);
    if (!pos || !drawingStateRef.current.currentRect) return;

    // Get top-left corner coordinates
    const coords = getTopLeftCoordinates(
      drawingStateRef.current.currentRect.x1,
      drawingStateRef.current.currentRect.y1,
      drawingStateRef.current.currentRect.x2,
      drawingStateRef.current.currentRect.y2
    );

    // Only save if rectangle has meaningful size
    if (coords.width > 5 && coords.height > 5) {
      const newRect = {
        ...coords,
        xPoints: pixelsToPoints(coords.x),
        yPoints: pixelsToPoints(coords.y),
        widthPoints: pixelsToPoints(coords.width),
        heightPoints: pixelsToPoints(coords.height),
        pageNum: currentPage,
        id: Date.now()
      };

      setRectangles(prev => [...prev, newRect]);
    }

    // Reset drawing state
    drawingStateRef.current.isDrawing = false;
    drawingStateRef.current.startPos = null;
    drawingStateRef.current.currentRect = null;

    // Redraw canvas
    drawCanvas();
  };


  // Delete a rectangle
  const handleDeleteRect = (id) => {
    setRectangles(prev => prev.filter(rect => rect.id !== id));
  };

  // Clear all rectangles on current page
  const handleClearPage = () => {
    setRectangles(prev => prev.filter(rect => rect.pageNum !== currentPage));
  };

  // Efficient canvas drawing function
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw current rectangle being drawn (live feedback) - BRIGHT BLUE
      if (drawingStateRef.current.currentRect && drawingStateRef.current.isDrawing) {
        const { x1, y1, x2, y2 } = drawingStateRef.current.currentRect;
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        // Bright blue semi-transparent fill - highly visible
        ctx.fillStyle = 'rgba(59, 130, 246, 0.6)'; // Bright blue with 60% opacity
        ctx.fillRect(minX, minY, width, height);

        // Bold blue border with strong glow
        ctx.strokeStyle = '#2563eb'; // Bright blue
        ctx.lineWidth = 5;
        ctx.setLineDash([]);
        ctx.shadowColor = '#2563eb';
        ctx.shadowBlur = 15;
        ctx.strokeRect(minX, minY, width, height);

        // Yellow inner dashed border for high contrast
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fbbf24'; // Yellow
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(minX + 2, minY + 2, width - 4, height - 4);

        // Large blue corner handles with yellow borders
        ctx.fillStyle = '#2563eb';
        ctx.setLineDash([]);
        const handleSize = 15;

        // Draw corner handles
        const corners = [
          [minX - handleSize/2, minY - handleSize/2],
          [minX + width - handleSize/2, minY - handleSize/2],
          [minX - handleSize/2, minY + height - handleSize/2],
          [minX + width - handleSize/2, minY + height - handleSize/2]
        ];

        corners.forEach(([x, y]) => {
          ctx.fillRect(x, y, handleSize, handleSize);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, handleSize, handleSize);
        });

        // Show live dimensions with blue background
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(minX + width/2 - 45, minY - 35, 90, 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        const dimText = `${width} × ${height}`;
        ctx.fillText(dimText, minX + width/2 - ctx.measureText(dimText).width/2, minY - 15);

        // Show DocuSign point coordinates with blue background
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(minX + 10, minY + 10, 120, 26);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        const pointX = pixelsToPoints(minX);
        const pointY = pixelsToPoints(minY);
        const coordText = `Points: (${pointX}, ${pointY})`;
        ctx.fillText(coordText, minX + 15, minY + 28);
      }

      // Draw saved rectangles for current page
      rectangles.forEach((rect) => {
        if (rect.pageNum === currentPage) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

          // Draw DocuSign point coordinate label
          ctx.fillStyle = '#10b981';
          ctx.font = '12px Arial';
          ctx.fillText(`Points: (${rect.xPoints}, ${rect.yPoints})`, rect.x + 2, rect.y - 5);
        }
      });
    } catch (error) {
      console.error('Error drawing canvas:', error);
      // Clear canvas on error to prevent corrupted state
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (clearError) {
        console.error('Error clearing canvas after draw error:', clearError);
      }
    }
  };

  // Update canvas when page or rect changes (but not during drawing)
  useEffect(() => {
    drawCanvas();
  }, [rectangles, currentPage]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDF Region Selector</h1>
        {pdfFileName && (
          <div className="file-info">
            <span className="file-name">{pdfFileName}</span>
          </div>
        )}
        <div className="header-actions">
          {pdfDoc && (
            <button onClick={handleHome} className="btn btn-secondary">
              🏠 Home
            </button>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            id="pdf-upload"
            style={{ display: 'none' }}
          />
          <label htmlFor="pdf-upload" className="btn btn-primary">
            Upload PDF
          </label>
          {pdfDoc && rectangles.filter(r => r.pageNum === currentPage).length > 0 && (
            <button onClick={handleClearPage} className="btn btn-danger">
              Clear Page
            </button>
          )}
        </div>
      </header>

      <div className="app-content">
        {!pdfDoc ? (
          <div className="empty-state">
            <p>Upload a PDF to get started</p>
            <p className="hint">Draw rectangles on the PDF pages to see coordinates</p>
          </div>
        ) : (
          <>
            <div className="sidebar">
              <div className="rectangles-list">
                <h3>Rectangles on Page {currentPage}</h3>
                <div className="coordinate-info">
                  <p className="rectangles-hint">
                    Click and drag on the PDF to draw rectangles
                  </p>
                  <div className="docusign-info">
                    <small><strong>DocuSign Points:</strong> 72 DPI coordinate system</small><br/>
                    <small>Letter page: 612×792 points (8.5"×11")</small><br/>
                    <small>Conversion: UI pixels → DocuSign points</small>
                  </div>
                </div>
                
                {rectangles.filter(r => r.pageNum === currentPage).length === 0 ? (
                  <p className="no-rectangles">No rectangles drawn yet</p>
                ) : (
                  <div className="rectangle-items">
                    {rectangles
                      .filter(r => r.pageNum === currentPage)
                      .map((rect) => (
                        <div key={rect.id} className="rectangle-item">
                          <div className="rect-info">
                            <div className="rect-coords">
                              <span className="coord-label">DocuSign Points:</span> ({rect.xPoints}, {rect.yPoints})
                            </div>
                            <div className="rect-size">
                              Size: {rect.widthPoints} × {rect.heightPoints} points
                            </div>
                            <div className="rect-inches">
                              Inches: ({(rect.xPoints/72).toFixed(2)}", {(rect.yPoints/72).toFixed(2)}")
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteRect(rect.id)}
                            className="btn-delete"
                            title="Delete rectangle"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  </div>
                )}
                
                <div className="rectangles-summary">
                  <div className="summary-item">
                    <strong>Total on page:</strong> {rectangles.filter(r => r.pageNum === currentPage).length}
                  </div>
                  <div className="summary-item">
                    <strong>Total all pages:</strong> {rectangles.length}
                  </div>
                </div>
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
                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>
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
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    drawingStateRef.current.isDrawing = false;
                    drawingStateRef.current.currentRect = null;
                    drawCanvas();
                  }}
                />
              </div>

              <div className={`drawing-hint ${drawingStateRef.current.isDrawing ? 'drawing-active' : ''}`}>
                {drawingStateRef.current.isDrawing ? 'Release mouse to complete rectangle' : 'Click and drag to draw a rectangle — Top-left coordinates will appear in the sidebar'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;

