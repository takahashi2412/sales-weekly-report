const AdmZip = require('adm-zip');
const fs = require('fs');

const pptxPath = "C:\\Users\\takahashikei\\OneDrive - 株式会社Rush up\\デスクトップ\\Rushup週次資料.pptx";

if (!fs.existsSync(pptxPath)) {
    console.log(`File not found: ${pptxPath}`);
    process.exit(1);
}

try {
    const zip = new AdmZip(pptxPath);
    const zipEntries = zip.getEntries();
    
    let textRuns = [];

    zipEntries.forEach((entry) => {
        if (entry.entryName.startsWith("ppt/slides/slide") && entry.entryName.endsWith(".xml")) {
            const content = zip.readAsText(entry);
            // Simple regex to extract text between <a:t> tags
            const regex = /<a:t.*?>(.*?)<\/a:t>/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                if (match[1].trim() !== '') {
                    textRuns.push(match[1]);
                }
            }
        }
    });

    console.log("Extracted Text:");
    textRuns.forEach((t, i) => console.log(`${i+1}: ${t}`));
} catch (e) {
    console.error("Error reading PPTX:", e);
}
