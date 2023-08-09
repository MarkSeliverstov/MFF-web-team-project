FROM node:latest

WORKDIR /app
COPY . .
RUN npm install


EXPOSE 5173
# VITE HMR
EXPOSE 24678
CMD [ "npm", "run", "dev", "--", "--host", "0.0.0.0" ]