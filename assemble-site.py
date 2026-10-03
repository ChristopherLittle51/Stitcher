from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

if 'classic.css' not in s:
    s = s.replace('</head>', '  <link rel="stylesheet" href="./classic.css?v=1">\n</head>')

if 'classic.js' not in s:
    s = s.replace(
        '</body>',
        '  <script src="./classic.js?v=1"></script>\n'
        '  <script src="./classic-ui.js?v=1"></script>\n'
        '</body>'
    )

p.write_text(s, encoding='utf-8')
print('Stitcher site assembled with Classic assets.')
