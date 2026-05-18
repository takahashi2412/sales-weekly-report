const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docxPath = process.argv[2];
const outPath = process.argv[3];

try {
  const tempDir = path.join(__dirname, 'temp_docx_extract2');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  execSync(`tar -xf "${docxPath}" -C "${tempDir}" word/document.xml`, { stdio: 'pipe' });
  const xmlPath = path.join(tempDir, 'word', 'document.xml');
  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
  // Strip XML tags but replace </w:p> with newline
  let text = xmlContent.replace(/<\/w:p>/g, '\n');
  text = text.replace(/<[^>]+>/g, '');
  fs.writeFileSync(outPath, text, 'utf-8');
  console.log('Extracted to ' + outPath);
} catch (error) {
  console.error("Error extracting docx:", error.message);
}
