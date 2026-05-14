const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// VERY basic zip reader in Node.js without external libraries
// docx is just a zip file. We need to find word/document.xml
const docxPath = 'c:\\Users\\takahashikei\\OneDrive - 株式会社Rush up\\デスクトップ\\Rushup営業プラットフォーム_簡易仕様書_1.docx';

try {
  // It's much easier to just use the adm-zip library if we have it, 
  // or we can use the 'jszip' which is in node_modules? Wait, jszip was in scratch.
  // Instead, let's just do a child_process call to tar, since Windows 10+ has tar built-in!
  const { execSync } = require('child_process');
  
  // Extract to a temp directory
  const tempDir = path.join(__dirname, 'temp_docx_extract');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  // Windows 10 has tar.exe built-in which can extract zip files
  execSync(`tar -xf "${docxPath}" -C "${tempDir}" word/document.xml`, { stdio: 'pipe' });
  
  const xmlPath = path.join(tempDir, 'word', 'document.xml');
  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
  
  // Strip XML tags
  const text = xmlContent.replace(/<[^>]+>/g, '');
  console.log("--- EXTRACTED TEXT ---");
  console.log(text);
  
} catch (error) {
  console.error("Error extracting docx:", error.message);
}
