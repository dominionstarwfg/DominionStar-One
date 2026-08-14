import assert from 'node:assert/strict';
import { resolveDesktopLayout } from '../src/desktop-layout.mjs';

const display={width:1440,height:900};
assert.equal(resolveDesktopLayout({width:1400,height:860},display,'darwin').mode,'wide');
assert.equal(resolveDesktopLayout({width:1000,height:650},display,'win32').dock,'top');
assert.equal(resolveDesktopLayout({width:720,height:520},display,'win32').mode,'compact');
assert.equal(resolveDesktopLayout({width:480,height:360},display,'darwin').mode,'mini');
assert.equal(resolveDesktopLayout({width:480,height:360},display,'darwin').nativeWindowStyle,'macos-traffic-lights');
assert.equal(resolveDesktopLayout({width:480,height:360},display,'win32').nativeWindowStyle,'windows-caption-buttons');
assert(resolveDesktopLayout({width:720,height:520},display).maxVisibleTiles<=5);
console.log('Desktop adaptive-layout tests passed.');
