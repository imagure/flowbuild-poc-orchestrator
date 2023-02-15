FROM node:18

# Create app directory
WORKDIR /usr/src/app

COPY . .

RUN npm install -g pnpm
RUN npm install -g typescript
RUN pnpm install
RUN pnpm run build
# If you are building your code for production
# RUN npm ci --only=production

ENV BROKER_HOST=$BROKER_HOST
ENV REDIS_HOST=$REDIS_HOST

CMD [ "pnpm", "run", "start" ]