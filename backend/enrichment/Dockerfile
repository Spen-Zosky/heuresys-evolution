FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --omit=optional
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S -G app app
COPY package.json ./
RUN npm install --omit=dev --omit=optional
COPY --from=builder /app/dist ./dist
RUN chown -R app:app /app
USER app
EXPOSE 8020
CMD ["node", "dist/index.js"]
