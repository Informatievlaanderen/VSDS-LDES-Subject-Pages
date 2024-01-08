FROM ghcr.io/zazuko/trifid:v4.1.1

# root privileges are required to install additional npm packages
USER root
RUN npm install @zazuko/trifid-entity-renderer@0.6.3 && npm install --omit=dev && npm cache clean --force
# run as node user
USER 1000:1000

ENTRYPOINT ["tini", "--", "/app/server.js"]

# use the same health check as the base image
HEALTHCHECK CMD wget -q -O- http://localhost:8080/health