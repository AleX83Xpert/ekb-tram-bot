FROM library/node:18-alpine
ENV NODE_ENV=production
RUN mkdir /app
WORKDIR /app
RUN chown -R node:node /app
COPY package*.json /app/
RUN npm ci --omit=dev
RUN npm cache clean --force
COPY . /app
RUN npm run build
USER node
CMD [ "npm", "start" ]
