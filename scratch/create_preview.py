import subprocess
import os

with open('stores_imei_real.js', 'r', encoding='utf-8') as f:
    stores_code = f.read()

with open('main_v130.js', 'r', encoding='utf-8') as f:
    main_code = f.read()

with open('style_v128.css', 'r', encoding='utf-8') as f:
    css_code = f.read()

html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
    {css_code}
    body {{
        margin: 0;
        padding: 20px;
        background: #f1f5f9;
        font-family: 'Inter', sans-serif;
    }}
    .test-box {{
        margin-bottom: 40px;
        background: white;
        padding: 20px;
        border-radius: 12px;
    }}
    </style>
</head>
<body>
    <div id="container-alc-front" class="test-box"></div>
    <div id="container-alc-back" class="test-box"></div>
    <div id="container-crf-prem" class="test-box"></div>

    <script>
    {stores_code}
    window.APP_CONFIG = {{ imeiDatabase: window.REAL_STORES_DATA.imei_db }};
    {main_code}

    document.getElementById('container-alc-front').innerHTML = window.renderAlcampoTable3D('ALCAMPO VAGUADA');
    document.getElementById('container-alc-back').innerHTML = window.renderAlcampoTable3D('ALCAMPO VAGUADA');
    document.getElementById('container-crf-prem').innerHTML = window.renderCarrefourPremiumTable3D('CRF ALCOBENDAS');

    // Rotate the second one to 180deg
    setTimeout(() => {{
        window.setRetailTableAngle('alcampo-m1', 180);
    }}, 100);
    </script>
</body>
</html>
"""

with open('scratch/preview_test.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print("Saved preview_test.html")
