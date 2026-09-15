FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
COPY miniprogram/utils ./miniprogram/utils
COPY miniprogram/assets ./miniprogram/assets
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
