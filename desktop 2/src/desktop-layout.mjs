const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function resolveDesktopLayout(bounds = {}, workArea = {}, platform = process.platform) {
  const width = clamp(Number(bounds.width) || 1280, 320, 10000);
  const height = clamp(Number(bounds.height) || 800, 240, 10000);
  const displayWidth = clamp(Number(workArea.width) || width, 320, 10000);
  const displayHeight = clamp(Number(workArea.height) || height, 240, 10000);
  let mode = 'wide';
  let dock = 'right';
  let maxVisibleTiles = 5;
  let tileSize = 'medium';
  let controls = 'full';

  if (width < 560 || height < 390) {
    mode = 'mini'; dock = 'top'; tileSize = 'small'; controls = 'minimal';
    maxVisibleTiles = width < 440 ? 1 : 2;
  } else if (width < 820 || height < 560) {
    mode = 'compact'; dock = 'top'; tileSize = 'small'; controls = 'compact';
    maxVisibleTiles = Math.max(2, Math.min(5, Math.floor((width - 32) / 150)));
  } else if (width < 1180 || height < 700) {
    mode = 'narrow'; dock = 'top'; controls = 'compact';
    maxVisibleTiles = Math.max(3, Math.min(5, Math.floor((width - 48) / 180)));
  }

  return Object.freeze({
    mode, dock, maxVisibleTiles, tileSize, controls, width, height,
    maximized: width >= displayWidth - 24 && height >= displayHeight - 24,
    nativeWindowStyle: platform === 'darwin' ? 'macos-traffic-lights' : 'windows-caption-buttons',
    alwaysOnTop: mode === 'mini'
  });
}

