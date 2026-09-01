FROM node:20-slim

# ffmpeg for merging/trimming, python3-pip to install yt-dlp, curl for the
# occasional debug/health check from inside the container.
RUN apt-get update && apt-get install -y ffmpeg python3-pip curl \
  && pip3 install --break-system-packages -U yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.js"]
