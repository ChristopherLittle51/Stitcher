from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

if 'classic.css' not in s:
    s = s.replace('</head>', '  <link rel="stylesheet" href="./classic.css?v=2">\n</head>')

if 'classic-mobile.css' not in s:
    s = s.replace('</head>', '  <link rel="stylesheet" href="./classic-mobile.css?v=1">\n</head>')

if 'classic.js' not in s:
    s = s.replace(
        '</body>',
        '  <script src="./classic.js?v=2"></script>\n'
        '  <script src="./classic-beauty.js?v=3"></script>\n'
        '  <script src="./classic-patch.js?v=1"></script>\n'
        '  <script src="./classic-ui.js?v=2"></script>\n'
        '  <script src="./classic-mobile.js?v=1"></script>\n'
        '</body>'
    )
else:
    if 'classic-beauty.js' not in s:
        s = s.replace(
            '<script src="./classic-patch.js?v=1"></script>',
            '<script src="./classic-beauty.js?v=3"></script>\n  <script src="./classic-patch.js?v=1"></script>'
        )
    else:
        s = s.replace('./classic-beauty.js?v=1', './classic-beauty.js?v=3')
        s = s.replace('./classic-beauty.js?v=2', './classic-beauty.js?v=3')
    if 'classic-mobile.js' not in s:
        s = s.replace('</body>', '  <script src="./classic-mobile.js?v=1"></script>\n</body>')

p.write_text(s, encoding='utf-8')
print('Stitcher site assembled with Classic assets.')
