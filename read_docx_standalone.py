import zipfile
import xml.etree.ElementTree as ET
import glob

files = glob.glob('*v3.3*.docx')
for docx_file in files:
    print(f'Reading {docx_file}:')
    try:
        with zipfile.ZipFile(docx_file, 'r') as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            paragraphs = tree.findall('.//w:p', namespaces)
            for p in paragraphs:
                texts = [node.text for node in p.findall('.//w:t', namespaces) if node.text]
                if texts:
                    print(''.join(texts))
    except Exception as e:
        print(f'Error reading {docx_file}: {e}')
