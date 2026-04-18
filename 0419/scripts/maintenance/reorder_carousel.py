import os

target_html = r'c:\Users\user\Desktop\IAFM\重新設計版面樣式\index.html'

with open(target_html, 'r', encoding='utf-8') as f:
    html = f.read()

start_marker = '<section class="home-ad-carousel" id="home-ad-carousel"'
end_marker = '            </section>\n\n\n            <!-- Redesigned Feature Grid -->'

start_idx = html.find(start_marker)
end_idx = html.find(end_marker) + len('            </section>')

if start_idx != -1 and end_idx != -1:
    carousel_block = html[start_idx:end_idx].strip()
    
    # Remove from original location
    html = html[:start_idx] + html[end_idx:]
    
    insert_marker = '        <!-- Wrapper for page content -->'
    insert_idx = html.find(insert_marker)
    
    if insert_idx != -1:
        # Before the wrapper, add a container
        carousel_wrapped = '\n        <!-- Carousel moved under Hero -->\n        <div style="max-width: 1200px; margin: 0 auto; padding: 0 2rem; margin-top: 20px;">\n            ' + carousel_block + '\n        </div>\n\n'
        html = html[:insert_idx] + carousel_wrapped + html[insert_idx:]
        
        with open(target_html, 'w', encoding='utf-8') as f:
            f.write(html)
        print('Successfully moved carousel up.')
    else:
        print('Could not find insertion marker')
else:
    print('Could not find carousel block markers')
