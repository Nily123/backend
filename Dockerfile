# 使用 Node 22 或你專案相符的版本
FROM node:22

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製專案全部內容
COPY . .

# 預設 port（Cloud Run 預設讀 PORT 環境變數）
EXPOSE 5000
ENV PORT 5000

# 啟動指令
CMD ["npm", "start"]
