FROM node:20-slim

# Instalar dependencias necesarias para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libxss1 \
    libasound2 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libgbm1 \
    xdg-utils \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Crear app
WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm install

# Copiar código
COPY . .

# Evitar que Puppeteer descargue Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Puerto
EXPOSE 3000

# Start
CMD ["node", "index.js"]