FROM node:22-alpine

WORKDIR /app

# Optional: mount .npmrc as a secret for GitHub Packages auth
# docker build --secret id=npmrc,src=.npmrc ...
COPY package.json package-lock.json* ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm install --omit=dev || npm install --omit=dev

COPY src ./src

ENV PORT=8787
ENV HOST=0.0.0.0
EXPOSE 8787

CMD ["node", "src/server.mjs"]
