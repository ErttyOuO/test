"""
將json檔案合併成一個policy_data.json，避免重複項目
指令:cd C:\Users\sbt01\OneDrive\桌面\IAFM\保單搜尋
python merge_policies.py ..\其他資料夾\a.json ..\其他資料夾\subdir\b.json
"""
import json
import sys
import os
from pathlib import Path


def walk(dirpath):
    for root, dirs, files in os.walk(dirpath):
        for fname in files:
            if fname.lower().endswith('.json'):
                yield os.path.join(root, fname)


def load_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"failed to parse {path}: {e}")
        return None


def main():
    if len(sys.argv) < 2:
        print('Usage: python merge_policies.py <folder1> [<folder2> ...]')
        sys.exit(1)

    out_file = Path(__file__).parent / 'policy_data.json'
    existing = []
    if out_file.exists():
        data = load_json(out_file)
        if isinstance(data, list):
            existing = data

    merged = existing.copy()
    seen = {p.get('id') for p in existing if isinstance(p, dict)}

    for arg in sys.argv[1:]:
        p = Path(arg)
        if not p.exists():
            print('path not found:', p)
            continue

        # If user provided a single file, process it directly
        if p.is_file() and p.suffix.lower() == '.json':
            files = [str(p)]
        elif p.is_dir():
            files = list(walk(str(p)))
        else:
            print('skipping (not json or directory):', p)
            continue

        for fn in files:
            if Path(fn).name == 'policy_data.json':
                continue
            data = load_json(fn)
            if data is None:
                continue
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get('id') not in seen:
                        merged.append(item)
                        seen.add(item.get('id'))
            elif isinstance(data, dict):
                if data.get('id') not in seen:
                    merged.append(data)
                    seen.add(data.get('id'))

    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"merged {len(merged)-len(existing)} new item(s), total {len(merged)}")


if __name__ == '__main__':
    main()
