const AdmZip = require('adm-zip');
const fs = require('fs');

const pptxPath = "C:\\Users\\takahashikei\\OneDrive - 株式会社Rush up\\デスクトップ\\Rushup週次資料.pptx";
const zip = new AdmZip(pptxPath);

const entries = zip.getEntries();
entries.forEach(entry => {
    if (entry.entryName === 'ppt/slides/slide2.xml') {
        const content = zip.readAsText(entry);
        fs.writeFileSync('slide2_raw.xml', content);
        console.log("Extracted slide2_raw.xml");
        
        // Also let's try a better regex for all text
        const textRegex = />([^<]+)</g;
        let match;
        let text = [];
        while ((match = textRegex.exec(content)) !== null) {
            if (match[1].trim() !== '') {
                text.push(match[1].trim());
            }
        }
        console.log("Text in slide 2:");
        console.log(text.join('\n'));
    }
});
