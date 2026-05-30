# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# VITE_API_URL is inlined into the bundle at build time. Railway/compose must
# supply it as a build arg pointing at the backend's public URL.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- serve stage ---
FROM nginx:1.27-alpine

# The official nginx entrypoint runs envsubst on *.template files, substituting
# only defined env vars (so $PORT is replaced; nginx's own $uri is preserved).
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Railway sets $PORT dynamically; default to 80 for local docker.
ENV PORT=80
EXPOSE 80
