FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8787
ENV HOST=0.0.0.0
EXPOSE 8787

CMD ["node", "src/server.mjs"]
