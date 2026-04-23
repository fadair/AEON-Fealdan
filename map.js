(() => {
  const viewer = document.getElementById('viewer');
  const image = document.getElementById('map-image');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const resetBtn = document.getElementById('reset-view');

  let naturalWidth = 0;
  let naturalHeight = 0;

  let scale = 1;
  let minScale = 1;
  let maxScale = 8;
  let x = 0;
  let y = 0;

  const pointers = new Map();

  let dragStartX = 0;
  let dragStartY = 0;
  let startX = 0;
  let startY = 0;

  let pinchStartDistance = 0;
  let pinchStartScale = 1;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getViewerRect() {
    return viewer.getBoundingClientRect();
  }

  function centerImageAtCurrentScale() {
    const rect = getViewerRect();
    const scaledWidth = naturalWidth * scale;
    const scaledHeight = naturalHeight * scale;

    x = (rect.width - scaledWidth) / 2;
    y = (rect.height - scaledHeight) / 2;
  }

  function clampPosition() {
    const rect = getViewerRect();
    const scaledWidth = naturalWidth * scale;
    const scaledHeight = naturalHeight * scale;

    if (scaledWidth <= rect.width) {
      x = (rect.width - scaledWidth) / 2;
    } else {
      x = clamp(x, rect.width - scaledWidth, 0);
    }

    if (scaledHeight <= rect.height) {
      y = (rect.height - scaledHeight) / 2;
    } else {
      y = clamp(y, rect.height - scaledHeight, 0);
    }
  }

  function render() {
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function fitToScreen() {
    const rect = getViewerRect();
    minScale = Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
    maxScale = minScale * 8;
    scale = minScale;
    centerImageAtCurrentScale();
    render();
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = getViewerRect();
    const targetScale = clamp(scale * factor, minScale, maxScale);

    if (targetScale === scale) {
      return;
    }

    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;

    const imageX = (pointX - x) / scale;
    const imageY = (pointY - y) / scale;

    scale = targetScale;
    x = pointX - imageX * scale;
    y = pointY - imageY * scale;

    clampPosition();
    render();
  }

  function setScaleAround(clientX, clientY, newScale) {
    const rect = getViewerRect();
    const targetScale = clamp(newScale, minScale, maxScale);

    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;

    const imageX = (pointX - x) / scale;
    const imageY = (pointY - y) / scale;

    scale = targetScale;
    x = pointX - imageX * scale;
    y = pointY - imageY * scale;

    clampPosition();
    render();
  }

  function getPointerList() {
    return Array.from(pointers.values());
  }

  function distance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  function midpoint(a, b) {
    return {
      clientX: (a.clientX + b.clientX) / 2,
      clientY: (a.clientY + b.clientY) / 2
    };
  }

  function beginDrag(pointer) {
    dragStartX = pointer.clientX;
    dragStartY = pointer.clientY;
    startX = x;
    startY = y;
    viewer.classList.add('dragging');
  }

  function updateDrag(pointer) {
    x = startX + (pointer.clientX - dragStartX);
    y = startY + (pointer.clientY - dragStartY);
    clampPosition();
    render();
  }

  function beginPinch() {
    const [a, b] = getPointerList();
    pinchStartDistance = distance(a, b);
    pinchStartScale = scale;
  }

  function updatePinch() {
    const [a, b] = getPointerList();
    const currentDistance = distance(a, b);

    if (!pinchStartDistance || currentDistance === 0) {
      return;
    }

    const mid = midpoint(a, b);
    const nextScale = pinchStartScale * (currentDistance / pinchStartDistance);
    setScaleAround(mid.clientX, mid.clientY, nextScale);
  }

  function onPointerDown(event) {
    viewer.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    if (pointers.size === 1) {
      beginDrag(event);
    } else if (pointers.size === 2) {
      viewer.classList.remove('dragging');
      beginPinch();
    }
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    pointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    if (pointers.size === 1) {
      updateDrag(event);
    } else if (pointers.size === 2) {
      updatePinch();
    }
  }

  function onPointerUpOrCancel(event) {
    pointers.delete(event.pointerId);
    viewer.classList.remove('dragging');

    if (pointers.size === 1) {
      const [remaining] = getPointerList();
      beginDrag(remaining);
    } else if (pointers.size === 2) {
      beginPinch();
    }
  }

  function onWheel(event) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAt(event.clientX, event.clientY, factor);
  }

  function zoomByButton(factor) {
    const rect = getViewerRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    zoomAt(centerX, centerY, factor);
  }

  function init() {
    naturalWidth = image.naturalWidth;
    naturalHeight = image.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      console.error('Image failed to load or has invalid dimensions.');
      return;
    }

    fitToScreen();

    viewer.addEventListener('pointerdown', onPointerDown);
    viewer.addEventListener('pointermove', onPointerMove);
    viewer.addEventListener('pointerup', onPointerUpOrCancel);
    viewer.addEventListener('pointercancel', onPointerUpOrCancel);
    viewer.addEventListener('pointerleave', onPointerUpOrCancel);
    viewer.addEventListener('wheel', onWheel, { passive: false });

    window.addEventListener('resize', fitToScreen);

    zoomInBtn.addEventListener('click', () => zoomByButton(1.2));
    zoomOutBtn.addEventListener('click', () => zoomByButton(1 / 1.2));
    resetBtn.addEventListener('click', fitToScreen);

    viewer.addEventListener('dblclick', (event) => {
      zoomAt(event.clientX, event.clientY, 1.5);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === '+' || event.key === '=') {
        zoomByButton(1.2);
      } else if (event.key === '-') {
        zoomByButton(1 / 1.2);
      } else if (event.key === '0') {
        fitToScreen();
      }
    });
  }

  if (image.complete) {
    init();
  } else {
    image.addEventListener('load', init, { once: true });
  }
})();