import re

with open('consulting.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '靜音' in line or '結束' in line or '麥克風' in line or 'mic-btn' in line or 'mute-btn' in line or 'end-call' in line:
        print(f"Line {i+1}: {line.strip()}")
