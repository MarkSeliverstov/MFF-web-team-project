FROM node:20

WORKDIR /app

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENV TZ=Europe/Prague

COPY svelte.config.js vite.config.ts tsconfig.json ./
COPY package.json package-lock.json ./
RUN npm install

COPY swaggerSpecification.json ./

COPY static ./static
COPY src ./src

EXPOSE 5173
# VITE HMR
EXPOSE 24678
# Dirty hack to make it possible to keep swagger.html
# without being overwritten by volumes
CMD [ "/bin/bash", "/app/entrypoint.sh" ]
