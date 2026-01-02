import React, { useEffect, useRef } from 'react';

function PDFViewer({ pdfDoc, pageNum, onPageRender }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      // Cancel any ongoing render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Calculate scale to fit container (max width 800px)
      const container = canvas.parentElement;
      const maxWidth = 800;
      const viewport = page.getViewport({ scale: 1.0 });
      const scale = Math.min(maxWidth / viewport.width, 2.0); // Max 2x zoom
      const scaledViewport = page.getViewport({ scale });

      // Set canvas dimensions
      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;

      // Notify parent of dimensions
      if (onPageRender) {
        onPageRender(scaledViewport.width, scaledViewport.height, scale);
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

