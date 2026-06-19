FROM node:20-slim

# Install system dependencies for headless Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnss3 \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variable to tell puppeteer to use the system installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create the data directories in case they are needed
RUN mkdir -p /app/data

EXPOSE 5000

CMD ["npm", "start"]
