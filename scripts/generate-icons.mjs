import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'frontend', 'public');
const input = path.join(publicDir, 'logo.png');

if (!fs.existsSync(input)) {
  console.error(`Input image not found: ${input}`);
  process.exit(1);
}

const sizes = [192, 512];

(async () => {
  try {
    for (const size of sizes) {
      const output = path.join(publicDir, `logo-${size}.png`);
      await sharp(input)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ quality: 90 })
        .toFile(output);
      console.log(`Generated: ${output}`);
    }
    console.log('All icons generated successfully.');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
})();