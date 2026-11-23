import re

with open('main_v130.js', 'r', encoding='utf-8') as f:
    js = f.read()

idx1 = js.find('window.wrapAlcampoCrfTable3D =')
idx2 = js.find('window.wrapCarrefourPremiumTable3D =')
wrap_code = js[idx1:idx2]

classes = set(re.findall(r'class=[\"\']([a-zA-Z0-9_\-\s]+)[\"\']', wrap_code))
all_classes = set()
for c in classes:
    for sub in c.split():
        all_classes.add(sub)

print('Classes in wrapAlcampoCrfTable3D:')
for c in sorted(all_classes):
    print(' ', c)

with open('style_v128.css', 'r', encoding='utf-8') as f:
    css = f.read()

for c in sorted(all_classes):
    matches = re.findall(rf'(\.{re.escape(c)}[^{{]*\{{[^}}]*\}})', css)
    for m in matches:
        if any(color in m for color in ['#1e293b', '#334155', '#475569', '#0f172a', 'background:', 'background-color:']):
            print(f'Match for .{c}:')
            print(m)
            print('='*40)
