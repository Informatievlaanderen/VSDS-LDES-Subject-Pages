FROM ghcr.io/zazuko/trifid:v4.1.1

ENV SPARQL_RESOURCE_EXISTS_QUERY="ASK { <\${iri}> ?p ?o . }"
ENV WELCOME_PATH=./custom/entity-renderer.welcome.hbs

USER root
RUN npm install @zazuko/trifid-entity-renderer@0.6.3 && npm install --omit=dev && npm cache clean --force
USER 1000:1000

ENTRYPOINT ["tini", "--", "/app/server.js"]

HEALTHCHECK CMD wget -q -O- http://localhost:8080/health