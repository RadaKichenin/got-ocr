import React, { useState, useRef, useEffect, useCallback } from 'react';
// No longer need react-image-crop

const ImageViewer = ({ imageUrl, onAreaSelect }) => {
    const imgRef = useRef(null); // Ref to <img>
    const containerRef = useRef(null); // Ref to scrollable container div

    const [isDragging, setIsDragging] = useState(false);
    const [selectionRect, setSelectionRect] = useState(null); // { startX, startY, currentX, currentY } relative to container scroll area
    const [completedSelection, setCompletedSelection] = useState(null); // Final { x, y, width, height } relative to container scroll area

    // Reset state when image URL changes
    useEffect(() => {
        console.log("ImageViewer: Image URL changed/mounted. Resetting state.");
        setIsDragging(false);
        setSelectionRect(null);
        setCompletedSelection(null);
        if (onAreaSelect) {
            onAreaSelect(null);
        }
    }, [imageUrl]); // Keep dependencies

    // --- Effect to calculate final coordinates AFTER selection is completed ---
    useEffect(() => {
        if (!completedSelection || !imgRef.current || !containerRef.current) {
            console.log("ImageViewer: Skipping final calculation - no completed selection or refs invalid.");
            if (completedSelection === null && onAreaSelect) onAreaSelect(null); // Clear parent if selection is cleared
            return;
        }

        console.log("ImageViewer: Calculating final coords for completed selection:", completedSelection);

        const imageElement = imgRef.current;
        const containerElement = containerRef.current;
        const { naturalWidth, naturalHeight } = imageElement;

        // Get container scroll offsets at the time of calculation
        const scrollTop = containerElement.scrollTop;
        const scrollLeft = containerElement.scrollLeft;

        // Get image position *relative to the scrollable container's top-left*
        // offsetTop/offsetLeft are relative to the offsetParent, which might be the container if positioned
        const imageOffsetTop = imageElement.offsetTop;
        const imageOffsetLeft = imageElement.offsetLeft;

        // Get actual displayed dimensions of the image element
        const displayWidth = imageElement.clientWidth; // Use clientWidth/Height for rendered size
        const displayHeight = imageElement.clientHeight;

        console.log(`ImageViewer: -- Dimensions/Offsets for Final Calc --
            Natural W/H: ${naturalWidth} / ${naturalHeight}
            Displayed W/H: ${displayWidth.toFixed(0)} / ${displayHeight.toFixed(0)}
            Image Offset T/L: ${imageOffsetTop.toFixed(0)} / ${imageOffsetLeft.toFixed(0)}
            Container Scroll T/L: ${scrollTop.toFixed(0)} / ${scrollLeft.toFixed(0)}
            Completed Selection (rel to container scroll): x=${completedSelection.x.toFixed(0)}, y=${completedSelection.y.toFixed(0)}, w=${completedSelection.width.toFixed(0)}, h=${completedSelection.height.toFixed(0)}`);

        if (!naturalWidth || !naturalHeight || displayWidth <= 0 || displayHeight <= 0) {
            console.error("ImageViewer: Invalid natural or display dimensions.");
            if (onAreaSelect) onAreaSelect(null);
            return;
        }

        // --- Calculate object-fit offsets within the image element's box ---
        const naturalAspect = naturalWidth / naturalHeight;
        const displayAspect = displayWidth / displayHeight;
        let objectFitOffsetX = 0;
        let objectFitOffsetY = 0;
        let visualWidth = displayWidth;
        let visualHeight = displayHeight;

        if (naturalAspect > displayAspect) {
            visualHeight = displayWidth / naturalAspect;
            objectFitOffsetY = (displayHeight - visualHeight) / 2;
        } else if (naturalAspect < displayAspect) {
            visualWidth = displayHeight * naturalAspect;
            objectFitOffsetX = (displayWidth - visualWidth) / 2;
        }
         console.log(`ImageViewer: Object-Fit Visual/Offset: visualW=${visualWidth.toFixed(2)}, visualH=${visualHeight.toFixed(2)}, objFitOffsetX=${objectFitOffsetX.toFixed(2)}, objFitOffsetY=${objectFitOffsetY.toFixed(2)}`);

        // --- Translate completedSelection Coords to be relative to VISUAL image content ---
        // 1. Relative to Image Element Box: Subtract image offset from selection coords
        const selX_relToImg = completedSelection.x - imageOffsetLeft;
        const selY_relToImg = completedSelection.y - imageOffsetTop;

        // 2. Relative to Visual Content: Subtract object-fit offset
        const selX_relToVisual = selX_relToImg - objectFitOffsetX;
        const selY_relToVisual = selY_relToImg - objectFitOffsetY;

        console.log(`ImageViewer: Selection top-left relative to visual content: x=${selX_relToVisual.toFixed(0)}, y=${selY_relToVisual.toFixed(0)}`);

        // --- Clamp selection bounds to the visual content area ---
        const clampedX1_visual = Math.max(0, selX_relToVisual);
        const clampedY1_visual = Math.max(0, selY_relToVisual);
        // Calculate bottom-right relative to visual content top-left
        const selX2_relToVisual = selX_relToVisual + completedSelection.width;
        const selY2_relToVisual = selY_relToVisual + completedSelection.height;
        // Clamp bottom-right to visual bounds
        const clampedX2_visual = Math.min(visualWidth, selX2_relToVisual);
        const clampedY2_visual = Math.min(visualHeight, selY2_relToVisual);
        // Recalculate clamped width/height in visual space
        const clampedW_visual = Math.max(0, clampedX2_visual - clampedX1_visual);
        const clampedH_visual = Math.max(0, clampedY2_visual - clampedY1_visual);

         console.log(`ImageViewer: Clamped Selection in Visual Space: x=${clampedX1_visual.toFixed(0)}, y=${clampedY1_visual.toFixed(0)}, w=${clampedW_visual.toFixed(0)}, h=${clampedH_visual.toFixed(0)}`);


        // --- Calculate Scaling based on VISUAL dimensions ---
        if (visualWidth <= 0 || visualHeight <= 0) {
             console.error("ImageViewer: Zero visual dimensions.");
             if (onAreaSelect) onAreaSelect(null);
             return;
        }
        const scaleX = naturalWidth / visualWidth;
        const scaleY = naturalHeight / visualHeight;

        // --- Scale the CLAMPED coordinates (relative to visual content) ---
        const finalX1 = Math.round(clampedX1_visual * scaleX);
        const finalY1 = Math.round(clampedY1_visual * scaleY);
        const finalX2 = Math.round(clampedX2_visual * scaleX);
        const finalY2 = Math.round(clampedY2_visual * scaleY);

        // --- Final Clamp to natural dimensions (redundant if previous clamping correct, but safe) ---
        const clampedX1_natural = Math.max(0, Math.min(finalX1, naturalWidth));
        const clampedY1_natural = Math.max(0, Math.min(finalY1, naturalHeight));
        const clampedX2_natural = Math.max(0, Math.min(finalX2, naturalWidth));
        const clampedY2_natural = Math.max(0, Math.min(finalY2, naturalHeight));
         console.log(`ImageViewer: Final Coords (Rounded & Clamped to Natural): x1=${clampedX1_natural}, y1=${clampedY1_natural}, x2=${clampedX2_natural}, y2=${clampedY2_natural}`);


        // --- Propagate results ---
        if (clampedX2_natural > clampedX1_natural && clampedY2_natural > clampedY1_natural) {
            const boxString = `[${clampedX1_natural},${clampedY1_natural},${clampedX2_natural},${clampedY2_natural}]`;
            console.log("***** ImageViewer: Calculated Original Coords Box:", boxString, "*****");
            if (onAreaSelect) onAreaSelect(boxString);
        } else {
            console.warn("ImageViewer: Calculated zero-area crop. Reporting null.");
            if (onAreaSelect) onAreaSelect(null);
        }

    }, [completedSelection, onAreaSelect]); // Depend on the final selection state


    // --- Manual Event Handlers ---
    const getCoords = (event) => {
        if (!containerRef.current) return null;
        const rect = containerRef.current.getBoundingClientRect();
        const scrollLeft = containerRef.current.scrollLeft;
        const scrollTop = containerRef.current.scrollTop;
        // Calculate coords relative to the container's scrollable content top-left
        const x = event.clientX - rect.left + scrollLeft;
        const y = event.clientY - rect.top + scrollTop;
        return { x, y };
    };

    const handleMouseDown = (event) => {
        // Prevent text selection during drag
        event.preventDefault();
        const coords = getCoords(event);
        if (!coords) return;
        console.log("MouseDown Coords (rel to container scroll):", coords);
        setIsDragging(true);
        setSelectionRect({ startX: coords.x, startY: coords.y, currentX: coords.x, currentY: coords.y });
        setCompletedSelection(null); // Clear previous completed selection
         if (onAreaSelect) onAreaSelect(null); // Clear parent state too
    };

    const handleMouseMove = useCallback((event) => {
        if (!isDragging) return;
        const coords = getCoords(event);
        if (!coords) return;
        setSelectionRect(prev => ({ ...prev, currentX: coords.x, currentY: coords.y }));
    }, [isDragging]); // Use useCallback

    const handleMouseUp = useCallback((event) => {
        if (!isDragging || !selectionRect) return;
        console.log("MouseUp fired.");
        setIsDragging(false);
        const finalCoords = getCoords(event); // Get final position
        const finalRect = {
             startX: selectionRect.startX,
             startY: selectionRect.startY,
             currentX: finalCoords ? finalCoords.x : selectionRect.currentX, // Use last known if null
             currentY: finalCoords ? finalCoords.y : selectionRect.currentY
        };

        // Calculate final rectangle properties (x, y, width, height)
        const x = Math.min(finalRect.startX, finalRect.currentX);
        const y = Math.min(finalRect.startY, finalRect.currentY);
        const width = Math.abs(finalRect.startX - finalRect.currentX);
        const height = Math.abs(finalRect.startY - finalRect.currentY);

        if (width > 5 && height > 5) { // Only complete if selection is reasonably sized
             console.log("Setting Completed Selection (rel to container scroll):", { x, y, width, height });
             setCompletedSelection({ x, y, width, height });
        } else {
             console.log("Selection too small, clearing.");
             setSelectionRect(null);
             setCompletedSelection(null);
              if (onAreaSelect) onAreaSelect(null);
        }
        // Don't clear selectionRect immediately, let the visual persist until next mousedown
    }, [isDragging, selectionRect, onAreaSelect]); // Include onAreaSelect if used inside

    // Add global mouse move/up listeners if dragging starts within the container
    useEffect(() => {
        if (isDragging) {
            // Add listeners to window to catch mouseup/move even if cursor leaves container
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            // Remove listeners when not dragging
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        // Cleanup function
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]); // Dependencies

     function onImageLoad(e) {
        console.log("ImageViewer: Image loaded. Natural W/H:", e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
        // Reset state completely on new image load to be safe
        setIsDragging(false);
        setSelectionRect(null);
        setCompletedSelection(null);
         if (onAreaSelect) onAreaSelect(null);
    }

    // --- Render Logic ---
    // Calculate visual selection box style
    const selectionBoxStyle = {};
    if (selectionRect) {
        selectionBoxStyle.position = 'absolute';
        selectionBoxStyle.border = '1px dashed red';
        selectionBoxStyle.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        selectionBoxStyle.left = `${Math.min(selectionRect.startX, selectionRect.currentX)}px`;
        selectionBoxStyle.top = `${Math.min(selectionRect.startY, selectionRect.currentY)}px`;
        selectionBoxStyle.width = `${Math.abs(selectionRect.startX - selectionRect.currentX)}px`;
        selectionBoxStyle.height = `${Math.abs(selectionRect.startY - selectionRect.currentY)}px`;
        selectionBoxStyle.zIndex = 10; // Ensure it's above the image
        selectionBoxStyle.pointerEvents = 'none'; // Don't interfere with image events
    }


    if (!imageUrl) {
        return <div className="image-viewer-panel placeholder">Select a page to view.</div>;
    }

    return (
        <div className="image-viewer-panel">
            <h4>Page Viewer</h4>
            <p style={{ fontSize: '0.9em', color: '#555' }}>
                Drag on the image area to select for OCR.
            </p>
            {/* Attach mouse listeners to the container */}
            <div
                ref={containerRef}
                className="image-crop-container" // Keep class for existing styles
                style={{ position: 'relative', cursor: 'crosshair', overflow: 'auto' }} // Ensure position relative for absolute child, add cursor
                onMouseDown={handleMouseDown}
                // onMouseMove and onMouseUp are handled globally while dragging
            >
                {/* Render the visual selection box */}
                {selectionRect && <div style={selectionBoxStyle}></div>}

                {/* Image is positioned relative to this container */}
                <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="Document page for cropping"
                    style={{ display: 'block', objectFit: 'contain', margin: 'auto', pointerEvents: 'none' }} // Center image, prevent its own pointer events
                    onLoad={onImageLoad}
                    draggable="false" // Prevent native image dragging
                />
            </div>
        </div>
    );
};

export default ImageViewer;