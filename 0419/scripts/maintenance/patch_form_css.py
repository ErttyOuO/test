import os

source_css = r'c:\Users\user\Desktop\IAFM\客服_留言按讚次數\style.css'
target_css = r'c:\Users\user\Desktop\IAFM\重新設計版面樣式\style.css'

with open(source_css, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract exactly from Contact Form Styles to the end of form css
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if '/* Contact Form Styles */' in line:
        start_idx = i
    if '/* AI Analysis Output Styling */' in line and start_idx != -1:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    faq_ext_css = ''.join(lines[start_idx:end_idx])
    
    with open(target_css, 'r', encoding='utf-8') as f:
        target_content = f.read()
        
    if '/* Contact Form Styles */' not in target_content:
        with open(target_css, 'a', encoding='utf-8') as f:
            f.write('\n\n/* ========= MISSING FAQ FORM CSS ========= */\n')
            f.write(faq_ext_css)
        print(f"Successfully appended {end_idx - start_idx} lines of CSS.")
    else:
        print("CSS already present.")
else:
    print(f"Could not find markers. start: {start_idx}, end: {end_idx}")
