const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourcePath = 'C:\\Users\\iskan\\.gemini\\antigravity-ide\\brain\\bcd26097-362c-4872-90af-6bfe34e49703\\media__1784709272530.png';
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(sourcePath)) {
  console.error('Source image not found at:', sourcePath);
  process.exit(1);
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function processLogo() {
  try {
    console.log('Copying logo.png to public/...');
    fs.copyFileSync(sourcePath, path.join(publicDir, 'logo.png'));
    console.log('✅ Updated public/logo.png');

    console.log('Generating PWA icons...');
    await sharp(sourcePath)
      .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(iconsDir, 'icon-192.png'));
    console.log('✅ Generated public/icons/icon-192.png');

    await sharp(sourcePath)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(iconsDir, 'icon-512.png'));
    console.log('✅ Generated public/icons/icon-512.png');

    // Generate Android mipmap density launcher icons
    const densities = [
      { name: 'mipmap-mdpi', size: 48 },
      { name: 'mipmap-hdpi', size: 72 },
      { name: 'mipmap-xhdpi', size: 96 },
      { name: 'mipmap-xxhdpi', size: 144 },
      { name: 'mipmap-xxxhdpi', size: 192 },
    ];

    console.log('Generating Android mipmap launcher icons...');
    for (const d of densities) {
      const dir = path.join(androidResDir, d.name);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      await sharp(sourcePath)
        .resize(d.size, d.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(dir, 'ic_launcher.png'));

      await sharp(sourcePath)
        .resize(d.size, d.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(dir, 'ic_launcher_round.png'));

      console.log(`✅ Generated Android launcher icons in ${d.name} (${d.size}x${d.size})`);
    }

    console.log('🎉 All logo assets updated successfully!');
  } catch (err) {
    console.error('Error processing logo:', err);
  }
}

processLogo();
