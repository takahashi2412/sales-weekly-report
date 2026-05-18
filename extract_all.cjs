const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tempDir = path.join(__dirname, 'temp_docx_extract');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.docx'));
let output = '';

for (const f of files) {
  output += `\n\n=== ${f} ===\n\n`;
  try {
    const docxPath = path.join(__dirname, f);
    execSync(`tar -xf "${docxPath}" -C "${tempDir}" word/document.xml`, { stdio: 'pipe' });
    
    const xmlPath = path.join(tempDir, 'word', 'document.xml');
    const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
    
    let text = xmlContent.replace(/<w:p\b[^>]*>/g, '\n');
    text = text.replace(/<[^>]+>/g, '');
    
    output += text;
    
    fs.unlinkSync(xmlPath);
  } catch (error) {
    output += `Error reading ${f}: ${error.message}`;
  }
}

fs.writeFileSync('docs_content.md', output, 'utf-8');
console.log("Extraction complete!");
