(() => {
  'use strict';
  if (window.DominionNativeDockQuality) return;

  // Executive6 historically sampled participant video into an off-DOM
  // 300x169 canvas and encoded it at JPEG quality .68 before forwarding it
  // to the native presenter dock. That is acceptable for thumbnails, but it
  // visibly softens faces once the dock is rendered at Zoom-class size.
  //
  // Keep the compatibility contract intact while transparently upgrading
  // only that specific offscreen video-sampling canvas to a 720x405 frame.
  const TARGET_WIDTH = 720;
  const TARGET_HEIGHT = 405;
  const LEGACY_WIDTH = 300;
  const LEGACY_HEIGHT = 169;
  const upgraded = new WeakSet();

  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  const isNativeDockCanvas = canvas => Boolean(
    canvas &&
    !canvas.isConnected &&
    ((canvas.width === LEGACY_WIDTH && canvas.height === LEGACY_HEIGHT) || upgraded.has(canvas))
  );

  CanvasRenderingContext2D.prototype.fillRect = function patchedFillRect(x, y, width, height) {
    const canvas = this.canvas;
    if (upgraded.has(canvas) && x === 0 && y === 0 && width === LEGACY_WIDTH && height === LEGACY_HEIGHT) {
      return originalFillRect.call(this, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
    }
    return originalFillRect.apply(this, arguments);
  };

  CanvasRenderingContext2D.prototype.drawImage = function patchedDrawImage(source, ...args) {
    const canvas = this.canvas;
    const isVideo = typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement;
    const isNineArgDraw = args.length === 8;
    const legacyDestination = isNineArgDraw &&
      Number(args[4]) === 0 && Number(args[5]) === 0 &&
      Number(args[6]) === LEGACY_WIDTH && Number(args[7]) === LEGACY_HEIGHT;

    if (isVideo && legacyDestination && isNativeDockCanvas(canvas)) {
      if (!upgraded.has(canvas)) {
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        upgraded.add(canvas);
      }
      const [sx, sy, sw, sh] = args;
      return originalDrawImage.call(this, source, sx, sy, sw, sh, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
    }
    return originalDrawImage.call(this, source, ...args);
  };

  HTMLCanvasElement.prototype.toDataURL = function patchedToDataURL(type, quality) {
    if (upgraded.has(this) && String(type || '').toLowerCase() === 'image/jpeg') {
      return originalToDataURL.call(this, type, Math.max(0.90, Number(quality) || 0));
    }
    return originalToDataURL.apply(this, arguments);
  };

  window.DominionNativeDockQuality = Object.freeze({
    version: '1.0.0',
    target: Object.freeze({ width: TARGET_WIDTH, height: TARGET_HEIGHT, jpegQuality: 0.90 })
  });
})();
