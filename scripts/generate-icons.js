const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
const svgPath = path.join(publicDir, 'logo.svg');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function generateIcons() {
  try {
    console.log('Generating PNG icons from logo.svg...');
    
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(iconsDir, 'icon-192.png'));
    console.log('✅ Generated public/icons/icon-192.png');

    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(iconsDir, 'icon-512.png'));
    console.log('✅ Generated public/icons/icon-512.png');

  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generateIcons();
