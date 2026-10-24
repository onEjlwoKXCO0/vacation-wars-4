# Works on Fly.io, Railway, any Docker host. Saved games go to /data (mount a volume there).
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=3000 DATA_DIR=/data
EXPOSE 3000
CMD ["node", "server/index.js"]
