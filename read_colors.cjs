const AdmZip = require('adm-zip');
const fs = require('fs');

const pptxPath = "C:\\Users\\takahashikei\\OneDrive - 株式会社Rush up\\デスクトップ\\Rushup週次資料.pptx";
const zip = new AdmZip(pptxPath);

// Extract colors from theme
const themeEntry = zip.getEntry("ppt/theme/theme1.xml");
if (themeEntry) {
    const themeContent = zip.readAsText(themeEntry);
    const regex = /<a:srgbClr val="([0-9a-fA-F]{6})"/g;
    let match;
    console.log("Theme colors:");
    while ((match = regex.exec(themeContent)) !== null) {
        console.log(`#${match[1]}`);
    }
}

// Find colors directly used in slides
const zipEntries = zip.getEntries();
const slideColors = new Set();
zipEntries.forEach((entry) => {
    if (entry.entryName.startsWith("ppt/slides/slide") && entry.entryName.endsWith(".xml")) {
        const content = zip.readAsText(entry);
        const regex = /<a:srgbClr val="([0-9a-fA-F]{6})"/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            slideColors.add(`#${match[1]}`);
        }
    }
});

console.log("Slide specific colors:");
slideColors.forEach(c => console.log(c));
