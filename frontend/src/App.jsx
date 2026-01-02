import React, { useState, useRef, useEffect } from 'react';
import PDFViewer from './components/PDFViewer';
import './App.css';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [rectangles, setRectangles] = useState([]); // Array of { x, y, width, height, pageNum }
  const [currentRect, setCurrentRect] = useState(null); // { x1, y1, x2, y2 }
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pageScale, setPageScale] = useState(1);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });

  // Load PDF file
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPdfFile(file);
    const arrayBuffer = await file.arrayBuffer();
    
    // Initialize pdf.js
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    setPdfDoc(pdf);
    setTotalPages(pdf.numPages);
    setCurrentPage(1);
    setRectangles([]);
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
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasCoordinates(e);
    if (!pos) return;

    setIsDrawing(true);
    setStartPos(pos);
    setCurrentRect({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPos) return;
    
    const pos = getCanvasCoordinates(e);
    if (!pos) return;
    
    setCurrentRect({
      x1: startPos.x,
      y1: startPos.y,
      x2: pos.x,
      y2: pos.y
    });
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !startPos) return;
    
    const pos = getCanvasCoordinates(e);
    if (!pos || !currentRect) return;
    
    // Get top-left corner coordinates
    const coords = getTopLeftCoordinates(
      currentRect.x1,
      currentRect.y1,
      currentRect.x2,
      currentRect.y2
    );
    
    // Only save if rectangle has meaningful size
    if (coords.width > 5 && coords.height > 5) {
      const newRect = {
        ...coords,
        pageNum: currentPage,
        id: Date.now()
      };
      
      setRectangles(prev => [...prev, newRect]);
    }
    
    setIsDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  };

  // Delete a rectangle
  const handleDeleteRect = (id) => {
    setRectangles(prev => prev.filter(rect => rect.id !== id));
  };

  // Clear all rectangles on current page
  const handleClearPage = () => {
    setRectangles(prev => prev.filter(rect => rect.pageNum !== currentPage));
  };

  // Update canvas when page or rect changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw current rectangle being drawn (live feedback) - BRIGHT BLUE
    if (currentRect && isDrawing) {
      const { x1, y1, x2, y2 } = currentRect;
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

      // Show coordinates with blue background
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(minX + 10, minY + 10, 100, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      const coordText = `(${Math.round(minX)}, ${Math.round(minY)})`;
      ctx.fillText(coordText, minX + 15, minY + 28);
    }

    // Draw saved rectangles for current page
    rectangles.forEach((rect) => {
      if (rect.pageNum === currentPage) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        // Draw coordinate label
        ctx.fillStyle = '#10b981';
        ctx.font = '12px Arial';
        ctx.fillText(`(${rect.x}, ${rect.y})`, rect.x + 2, rect.y - 5);
      }
    });
  }, [currentRect, rectangles, currentPage, isDrawing]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDF Region Selector</h1>
        <div className="header-actions">
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
                <p className="rectangles-hint">
                  Click and drag on the PDF to draw rectangles
                </p>
                
                {rectangles.filter(r => r.pageNum === currentPage).length === 0 ? (
                  <p className="no-rectangles">No rectangles drawn yet</p>
                ) : (
                  <div className="rectangle-items">
                    {rectangles
                      .filter(r => r.pageNum === currentPage)
                      .map((rect) => (
                        <div key={rect.id} className="rectangle-item">
                          <div className="rect-info">
                            <div className="rect-label">Top-Left Corner:</div>
                            <div className="rect-coords">
                              <span className="coord-label">X:</span> {rect.x}px
                              <span className="coord-separator">|</span>
                              <span className="coord-label">Y:</span> {rect.y}px
                            </div>
                            <div className="rect-size">
                              {rect.width} × {rect.height} px
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
                    setIsDrawing(false);
                    setCurrentRect(null);
                  }}
                />
              </div>

              <div className={`drawing-hint ${isDrawing ? 'drawing-active' : ''}`}>
                {isDrawing ? 'Release mouse to complete rectangle' : 'Click and drag to draw a rectangle — Top-left coordinates will appear in the sidebar'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;

