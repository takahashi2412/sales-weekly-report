import zipfile
import re
import sys

docx_path = r"c:\Users\takahashikei\OneDrive - 株式会社Rush up\デスクトップ\Rushup営業プラットフォーム_簡易仕様書_1.docx"

try:
    with zipfile.ZipFile(docx_path) as docx:
        xml_content = docx.read('word/document.xml').decode('utf-8')
        
        # Simple regex to strip XML tags
        text = re.sub('<[^<]+>', '', xml_content)
        
        print("--- EXTRACTED TEXT ---")
        print(text)
except Exception as e:
    print(f"Error: {e}")
