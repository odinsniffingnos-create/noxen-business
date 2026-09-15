const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const size = 256;
const outPath = path.join(__dirname, '..', 'build', 'icon.png');
const png = new PNG({ width: size, height: size, colorType: 6, bgColor: { red: 11, green: 16, blue: 32 } });

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const idx = (size * y + x) << 2;
    const cx = x - size / 2;
    const cy = y - size / 2;
    const r = 10;
    const d1 = Math.abs(cx + 30);
    const d2 = Math.abs(cx - 30);
    const insideN =
      (Math.abs(cx - 30) < 20 && Math.abs(cy) < 90) ||
      (Math.abs(cx + 30) < 20 && Math.abs(cy) < 90) ||
      (Math.abs((cx + 30) / (cy + 0.0001) - 1) < 0.9 && Math.abs(cy) < 90);

    const isStroke =
      ((x > 35 && x < 220) && (y > 35 && y < 220)) &&
      ((d1 < 18 && Math.abs(cy) < 90) ||
        (d2 < 18 && Math.abs(cy) < 90) ||
        (Math.abs((cx + 30) / (cy + 0.0001) - 1) < 0.9 && Math.abs(cy) < 90));

    const isBackground = Math.hypot(cx, cy) < 110 && !(isStroke);

    png.data[idx] = isBackground ? 22 : 122;
    png.data[idx + 1] = isBackground ? 33 : 120;
    png.data[idx + 2] = isBackground ? 56 : 255;
    png.data[idx + 3] = 255;

    if (isStroke) {
      png.data[idx] = 124;
      png.data[idx + 1] = 108;
      png.data[idx + 2] = 249;
      png.data[idx + 3] = 255;
    }

    if (isBackground && Math.hypot(cx, cy) < 90) {
      png.data[idx] = 15;
      png.data[idx + 1] = 23;
      png.data[idx + 2] = 42;
      png.data[idx + 3] = 255;
    }
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(png));
console.log(`Generated icon: ${outPath}`);
