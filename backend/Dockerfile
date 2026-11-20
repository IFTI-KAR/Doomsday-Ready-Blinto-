FROM node:24-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/app/data/doomsday.db

EXPOSE 4000

CMD ["node", "dist/index.js"]
