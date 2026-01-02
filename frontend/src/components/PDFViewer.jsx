import React, { useEffect, useRef } from 'react';

function PDFViewer({ pdfDoc, pageNum, onPageRender }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        // Cancel any ongoing render
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;

        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) {
          console.error('Could not get canvas context');
          return;
        }

        // Calculate scale to fit container (max width 800px)
        const container = canvas.parentElement;
        const maxWidth = 800;
        const viewport = page.getViewport({ scale: 1.0 });

        if (!viewport || viewport.width === 0 || viewport.height === 0) {
          console.error('Invalid viewport dimensions');
          return;
        }

        const scale = Math.min(maxWidth / viewport.width, 2.0); // Max 2x zoom
        const scaledViewport = page.getViewport({ scale });

        // Validate scaled viewport
        if (!scaledViewport || scaledViewport.width === 0 || scaledViewport.height === 0) {
          console.error('Invalid scaled viewport dimensions');
          return;
        }

        // Set canvas dimensions with validation
        const newWidth = Math.max(1, Math.round(scaledViewport.width));
        const newHeight = Math.max(1, Math.round(scaledViewport.height));

        canvas.height = newHeight;
        canvas.width = newWidth;

        // Clear canvas before rendering
        context.clearRect(0, 0, newWidth, newHeight);

        // Render PDF page
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
        };

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;

        // Notify parent of dimensions
        if (onPageRender) {
          onPageRender(newWidth, newHeight, scale);
        }

        console.log(`Page ${pageNum} rendered successfully`);

      } catch (error) {
        console.error(`Error rendering page ${pageNum}:`, error);

        // Clear canvas on error
        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext('2d');
          if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);

            // Draw error message
            context.fillStyle = '#ef4444';
            context.font = '16px Arial';
            context.fillText('Error loading page', 20, 50);
          }
        }
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, onPageRender]);

  return (
    <canvas
      ref={canvasRef}
      className="pdf-canvas"
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    />
  );
}

export default PDFViewer;

