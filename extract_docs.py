import zipfile
import xml.etree.ElementTree as ET
import glob

with open('docs_output.txt', 'w', encoding='utf-8') as out:
    for f in glob.glob('*.docx'):
        out.write(f'=== {f} ===\n')
        try:
            with zipfile.ZipFile(f) as docx:
                xml_content = docx.read('word/document.xml')
                tree = ET.fromstring(xml_content)
                namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                for p in tree.iterfind('.//w:p', namespaces):
                    texts = [node.text for node in p.iterfind('.//w:t', namespaces) if node.text]
                    if texts:
                        out.write(''.join(texts) + '\n')
            out.write('\n\n')
        except Exception as e:
            out.write(f'Error: {e}\n\n')
