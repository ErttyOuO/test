import os, glob, re

search_dir = r"c:\Users\user\Desktop\IAFM\重新設計版面樣式"
html_files = glob.glob(os.path.join(search_dir, "*.html"))

pattern = r'<div class="float-btn emergency".*?</div>'
new_btn = '''<div class="float-btn faq-btn" onclick="openFaqModal()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span class="float-tooltip">常見問題與教學</span>
        </div>'''

for file_path in html_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content, count = re.subn(pattern, new_btn, content, flags=re.DOTALL)
    if count > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {os.path.basename(file_path)}")

# Also fix the agent_profile.html header issue!
with open(os.path.join(search_dir, "agent_profile.html"), "r", encoding="utf-8") as f:
    agent = f.read()
agent_new, count1 = re.subn(r'<nav class="global-nav">.*?</nav>', '', agent, flags=re.DOTALL)
agent_new, count2 = re.subn(r'<body style="padding-top: 60px;">', '<body>', agent_new)
if count1 > 0 or count2 > 0:
    with open(os.path.join(search_dir, "agent_profile.html"), "w", encoding="utf-8") as f:
        f.write(agent_new)
    print("Fixed agent_profile.html header and padding")
