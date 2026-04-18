import os

filepath = r'c:\Users\user\Desktop\IAFM\重新設計版面樣式\dm.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

dark_mode_css = '''
        /* ==== DARK MODE FIX FOR dm.html ==== */
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #0f172a !important;
                color: #f1f5f9 !important;
            }
            .policy-card {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #f8fafc !important;
            }
            .card-title {
                color: #f1f5f9 !important;
            }
            .card-summary {
                color: #cbd5e1 !important;
            }
            .btn-action {
                background: #334155 !important;
                border-color: #475569 !important;
                color: #f1f5f9 !important;
            }
            .btn-action:hover {
                background: #475569 !important;
                color: #20c997 !important;
            }
            .btn-action.active {
                background: rgba(32, 201, 151, 0.15) !important;
                color: #20c997 !important;
                border-color: #20c997 !important;
            }
            .modal-content {
                background: #1e293b !important;
                color: #f8fafc !important;
            }
        }
        
        [data-theme="dark"] .policy-card, body.dark-mode .policy-card {
            background: #1e293b !important;
            border-color: #334155 !important;
            color: #f8fafc !important;
        }
        [data-theme="dark"] .card-title, body.dark-mode .card-title {
            color: #f1f5f9 !important;
        }
        [data-theme="dark"] .card-summary, body.dark-mode .card-summary {
            color: #cbd5e1 !important;
        }
        [data-theme="dark"] .btn-action, body.dark-mode .btn-action {
            background: #334155 !important;
            border-color: #475569 !important;
            color: #f1f5f9 !important;
        }
'''

if 'DARK MODE FIX FOR dm.html' not in content:
    content = content.replace('</style>', dark_mode_css + '\n    </style>')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected dark mode CSS into dm.html")
else:
    print("Already injected.")
