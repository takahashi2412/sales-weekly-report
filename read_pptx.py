import zipfile
import xml.etree.ElementTree as ET
import sys
import os

def extract_text_from_pptx(pptx_path):
    text_runs = []
    if not os.path.exists(pptx_path):
        print(f"File not found: {pptx_path}")
        return
        
    try:
        with zipfile.ZipFile(pptx_path, 'r') as z:
            # Find all slide XML files
            slide_files = [f for f in z.namelist() if f.startswith('ppt/slides/slide') and f.endswith('.xml')]
            
            for slide_file in slide_files:
                xml_content = z.read(slide_file)
                root = ET.fromstring(xml_content)
                
                # The namespace for drawingML
                namespace = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                
                for node in root.findall('.//a:t', namespace):
                    text = node.text
                    if text and text.strip():
                        text_runs.append(text.strip())
                        
            print("Extracted Text:")
            for t in text_runs:
                print(t)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    pptx_path = r"c:\Users\takahashikei\OneDrive - 株式会社Rush up\デスクトップ\Rushup週次資料.pptx"
    extract_text_from_pptx(pptx_path)
