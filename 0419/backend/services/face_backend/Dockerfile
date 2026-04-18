FROM python:3.10-slim

# 安裝 OpenCV 所需的系統依賴
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# 安裝依賴，如果發現 tf-keras 太大也可以換輕量模型或精簡配置
RUN pip install --no-cache-dir -r requirements.txt

# 複製其他程式碼
COPY . .

EXPOSE 8000

# 預設執行指令，由於多數雲端服務允許透過 PORT 變數指定連接埠
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
