import bs4

html = open('consulting.html', encoding='utf-8').read()
soup = bs4.BeautifulSoup(html, 'html.parser')

with open('out.txt', 'w', encoding='utf-8') as out:
    for b in soup.find_all('button'):
        parent_class = b.parent.get('class') if b.parent else None
        out.write(f"ID: {b.get('id')}, CLASS: {b.get('class')}, PARENT: {parent_class}, TEXT: {b.text.strip()}\n")
