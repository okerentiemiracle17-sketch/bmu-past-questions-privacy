/* Build-time static image optimization. Keep original PNG/JPEG assets unchanged. */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = __dirname;
const assetDir = path.join(root, 'assets');
const outputHtml = path.join(root, 'index.html');
const targets = {
  'bmu_logo.png': 180,
  'floating_books.png': 160,
  'floating_cap.png': 160,
  'floating_science.png': 160,
  'floating_note.png': 160,
  'miracle_nexus_logo.jpg': 160,
  'student_character.png': 480,
  'android_apk_card.png': 960,
  'continue_website_card.png': 960,
  'apple_store_card.png': 960,
  'google_play_card.png': 960,
  'nexus_ai_robot.png': 480,
  'study_group_character.png': 480
};

async function main() {
  let html = await fs.readFile(outputHtml, 'utf8');
  let totalInput = 0, totalOutput = 0;
  for (const [file, maxWidth] of Object.entries(targets)) {
    const source = path.join(assetDir, file);
    const outputName = file.replace(/\.(png|jpe?g)$/i, '.webp');
    const destination = path.join(assetDir, outputName);
    const inputStat = await fs.stat(source);
    await sharp(source, { limitInputPixels: 100000000 })
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 80, effort: 5, alphaQuality: 85 })
      .toFile(destination);
    const outputStat = await fs.stat(destination);
    totalInput += inputStat.size; totalOutput += outputStat.size;
    // Rewrite only the website's static image references, not original assets.
    html = html.replaceAll('assets/' + file, 'assets/' + outputName);
    console.log(file + ': ' + (inputStat.size / 1024).toFixed(0) + ' KB -> ' + (outputStat.size / 1024).toFixed(0) + ' KB');
  }
  // Prioritize the real brand/logo and student artwork; defer decorative hero icons.
  html = html.replace(/(<img[^>]*class="hero-float[^"]*"[^>]*)(>)/g, '$1 loading="lazy" decoding="async" fetchpriority="low"$2');
  html = html.replace(/(<img[^>]*class="hero-student"[^>]*)(>)/g, '$1 decoding="async" fetchpriority="high"$2');
  html = html.replace(/(<img[^>]*class="nexus-robot"[^>]*)(>)/g, '$1 loading="lazy" decoding="async"$2');
  html = html.replace(/(<img[^>]*class="nexus-download-card-image"[^>]*)(>)/g, '$1 decoding="async"$2');
  await fs.writeFile(outputHtml, html, 'utf8');
  console.log('Static artwork optimized: ' + (totalInput / 1048576).toFixed(2) + ' MB -> ' + (totalOutput / 1048576).toFixed(2) + ' MB.');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
