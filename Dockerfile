FROM node:22-bookworm-slim

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all application code
COPY . .

# Build application
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5173

EXPOSE 5173

CMD ["node", "scripts/start-server.mjs"]
