# Subject pages

## Table of contents
<!-- TOC -->
* [Subject pages](#subject-pages)
  * [Table of contents](#table-of-contents)
  * [What are subject pages?](#what-are-subject-pages)
* [Tutorial: how to set up subject pages?](#tutorial-how-to-set-up-subject-pages)
  * [1. Set up the RDF4J graph db](#1-set-up-the-rdf4j-graph-db)
    * [Docker compose config for the graph db container](#docker-compose-config-for-the-graph-db-container)
    * [Initialization of the graph db repository](#initialization-of-the-graph-db-repository)
    * [Configuration of the LDIO](#configuration-of-the-ldio)
  * [2. Set up the TRIFID subject pages](#2-set-up-the-trifid-subject-pages)
    * [Custom Dockerfile](#custom-dockerfile)
    * [Configuration template](#configuration-template)
    * [Dataset base url](#dataset-base-url)
    * [Middlewares](#middlewares)
      * [a. Rewrite](#a-rewrite)
      * [b. Entity Renderer](#b-entity-renderer)
      * [c. Welcome](#c-welcome)
      * [d. Sparql-handler](#d-sparql-handler)
      * [Middleware node modules](#middleware-node-modules)
    * [Server port](#server-port)
    * [Add Trifid to docker compose](#add-trifid-to-docker-compose)
<!-- TOC -->

## What are subject pages?

Subject pages are web pages that can display the information of an entity's that is part of a linked data event stream (
LDES).

# Tutorial: how to set up subject pages?

In this tutorial, we will set up subject pages for the LDES
of [GIPOD](https://www.vlaanderen.be/digitaal-vlaanderen/onze-oplossingen/generiek-informatieplatform-openbaar-domein-gipod).
To set these pages up, a graph db is required. Any graph db can be used, but in this tutorial, we are
using [RDF4J from Eclips](https://rdf4j.org/). If you already have a graph db, or you want to use another one, you can
directly go to [step 2](#2-set-up-the-trifid-subject-pages).

## 1. Set up the RDF4J graph db

To set up the graph db, we will be using
the [LDI Orchestrator (LDIO)](https://informatievlaanderen.github.io/VSDS-Linked-Data-Interactions/ldio/index),
where we will use
the [LDES Client](https://informatievlaanderen.github.io/VSDS-Linked-Data-Interactions/ldio/ldio-inputs/ldio-ldes-client)
as input component
and
the [Repository Materialiser](https://informatievlaanderen.github.io/VSDS-Linked-Data-Interactions/ldio/ldio-outputs/ldio-repository-materialiser)
as output component.

### Docker compose config for the graph db container

Create a folder where all files for setting up the

```shell
mkdir subject-pages
```

Add a `docker-compose.yml` file to this directory and add the following config to that file

```yaml
version: '3.5'

services:
  graph-db:
    image: eclipse/rdf4j-workbench:latest
    container_name: rdf4j-server
    environment:
      - "JAVA_OPTS=-Xms1g -Xmx4g"
    ports:
      - "8080:8080"
    networks:
      - subject-pages-network

networks:
  subject-pages-network:
    driver: bridge
    name: subject-pages-network

```

### Initialization of the graph db repository

We want our repository to be initialized when we spin up our containers. Therefor, we use a simple ubuntu container that
will execute an initialization script.

```shell
mkdir repository-intializer
```

Add a file to this folder named `test.config.ttl` with the following content:

```text
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix config: <tag:rdf4j.org,2023:config/>.

[] a config:Repository ;
   config:rep.id "test" ;
   config:rep.impl [
      config:rep.type "openrdf:SailRepository" ;
      config:sail.impl [
         config:sail.type "openrdf:MemoryStore" ;
         config:mem.persist true ;
      ]
   ].
```

Add a script file with the name `initialize.sh` to the same folder and add following commands:

```shell
apt-get update && apt-get install curl -y && apt-get clean
curl -X PUT http://graph-db:8080/rdf4j-server/repositories/test -H "Content-Type: text/turtle" -d "@/initializer/test.config.ttl"
```

The above script and turtle file will add a repository to the graph db with the name `test`, if another id is desired,
you will have to change two things.

First of all, change in the curl command to this
`http://graph-db:8080/rdf4j-server/repositories/[NAME_OF_YOUR_REPO]`

Secondly, change in the turtle file line 5 to this: `config:rep.id "[NAME_OF_YOUR_REPO]"`

Now go back to the `docker-compose.yml` file and add the following service:

```yaml
  repository-initializer:
    image: ubuntu
    command: "/bin/sh /initializer/initialize.sh"
    container_name: rdf4j-server-repo-initializer
    volumes:
      - ./repository-initializer:/initializer:ro
    depends_on:
      graph-db:
        condition: service_started
    networks:
      - subject-pages-network
```

### Configuration of the LDIO

Now the setup for the RDF4J repository is done, we need to provide config for the LDI Orchestrator, so that the
repository can be filled up with data.
In the directory `subject-pages`, we make a file `ldio.config.yaml` with the following config:

```yaml
orchestrator:
  pipelines:
    - name: gipod
      input:
        name: be.vlaanderen.informatievlaanderen.ldes.ldi.client.LdioLdesClient
        config:
          url: https://private-api.gipod.vlaanderen.be/api/v1/ldes/mobility-hindrances?generatedAtTime=2024-10-05T10:28:37.923Z
          sourceFormat: application/ld+json
      outputs:
        - name: be.vlaanderen.informatievlaanderen.ldes.ldi.RepositoryMaterialiser
          config:
            sparql-host: http://graph-db:8080/rdf4j-server
            repository-id: test
            named-graph: http://gipod
 ```

With this config, we have added one pipeline to the orchestrator with two components, an input component, the
LdesClient,
which usually follows an LDES. As second, one output component is provided, namely the Repository Materialiser,
which will send the output to a provided sparql host and repository. In this case, there is also a named graph provided.

If this is set up, we can add the ldio as a service to the `docker-compose`. Add the following to
the `docker-compose.yml` file:

```yaml
  ldi-orchestrator:
    image: ldes/ldi-orchestrator:1.12.0-SNAPSHOT
    container_name: ldi-orchestrator
    ports:
      - "8082:8080"
    volumes:
      - ./ldio.config.yaml:/ldio/application.yaml:ro
    depends_on:
      repository-initializer:
        condition: service_completed_successfully
    networks:
      - subject-pages-network
```

Now, you can already test this. First, we will spin up our services by executing the following:

```shell
docker compose up 
```

If all the containers are started, you can go
to [http://localhost:8080/rdf4j-workbench/repositories/test/summary](http://localhost:8080/rdf4j-workbench/repositories/test/summary),
and you should see that there a property **Number of Statements** with a certain number next to.

## 2. Set up the TRIFID subject pages

To set up the subject pages, we will use [Trifid](https://github.com/zazuko/trifid), with image
tag [ghcr.io/zazuko/trifid:v4.1.1](https://github.com/zazuko/trifid/pkgs/container/trifid/156744021?tag=v4.1.1)

### Custom Dockerfile

While setting up this tutorial, we experienced some issues with one of the plugins of Trifid together with the RDF4J
graph db.
This plugin has been fixed and released, but this plugin is not plugged in the Trifid core package.

To solve this issue, we suggest to create a local Dockerfile.

```shell
mkdir trifid
```

Add a `Dockerfile` to this folder with the following:

```dockerfile
FROM ghcr.io/zazuko/trifid:v4.1.1

# root privileges are required to install additional npm packages
USER root
RUN npm install @zazuko/trifid-entity-renderer@0.6.3 && npm install --omit=dev && npm cache clean --force
# run as node user

ENTRYPOINT ["tini", "--", "/app/server.js"]

# use the same health check as the base image
HEALTHCHECK CMD wget -q -O- http://localhost:8080/health 
```

> **Note**: we expect that this issue will be resolved in the next release of the trifid image.
> If this is the case, the steps to create a local docker image will be deleted, and we will suggest then to use
> the original Trifid image in the compose file.

### Configuration template

Now add to the same `trifid` folder the file `config.yaml` and add the following template to the file.

```yaml
globals:
  datasetBaseUrl: https://private-api.gipod.vlaanderen.be/api/v1/

middlewares:
  rewrite:

  welcome:

  entitiy-renderer:

  sparql-handler:
```

### Dataset base url

As you can see in the `trifid/config.yaml` file, there is a `globals.datasetBaseUrl` key provided. The database base url
will be used to replace the trifid host url (which will be `http://localhost:8888/` in our case) when making a query
requests to the graph db.

The following subject will match with the following call to the subject pages (with host `http://localhost:8888/`):

|  **Graph db subject**  | `https://private-api.gipod.vlaanderen.be/api/v1/mobility-hindrances/15732676/33382013` |
|:----------------------:|---------------------------------------------------------------------------------------:|
| **Subject pages call** |                          `http://localhost:8888/mobility-hindrances/15732676/33382013` | 

### Middlewares

There are four middlewares to configure to set up the subject pages. We will configure them one by one.

#### a. Rewrite

As described above, the url from the subject pages is rewritten to make a valid request to the graph db. And it is the
rewrite middleware that is responsible for doing that.

This can easily be enabled by setting a node module in the following config to the middlewares object in
the `config.yaml` file:

```yaml
  rewrite:
    module: trifid-core/middlewares/rewrite.js
```

With this config, the default rewrite middleware from Trifid is active.

#### b. Entity Renderer

The entity renderer is responsible to render an UI for the fetched entity.

An entity renderer can be set by configuring which node module must be used. In this case,
we will use the [default entity renderer](https://github.com/zazuko/trifid/tree/main/packages/entity-renderer) from
Trifid will be used. This can be achieved with the following config under the `middlewares` key:

```yaml
  entitiy-renderer:
    module: "@zazuko/trifid-entity-renderer"
```

Additional configuration or customization to this default renderer can be added, more info about this can be
found [here](https://github.com/zazuko/trifid/tree/main/packages/entity-renderer)

#### c. Welcome

You mostly want to set up a welcome page, and this can be done by setting the welcome object under the middlewares in
the `config.yaml` file to the following:

```yaml
  welcome:
    module: trifid-core/middlewares/view.js
    paths:
      - /
      - /index
    methods: GET
    config:
      path: file:./welcome.hbs
```

- module: just like the previous middleware, we take the default node module to activate this middleware, but this can
  also be customized.
- paths: on which paths the welcome page should be rendered, in this `/` and `/index`.
- methods: with which http methods can the welcome page be reached, in this case with a `GET` method
- config.path: path to the file that should be used for the rendering of the welcome page, an example can be
  found [here](trifid/welcome.hbs).

#### d. Sparql-handler

As last, the only thing that is left to configure, is the sparql-handler. This middleware is responsible for which query
is sent to the graph db and can be configured as follows:

```yaml
  sparql-handler:
    module: trifid-handler-sparql
    config:
      endpointUrl: http://graph-db:8080/rdf4j-server/repositories/test
      resourceExistsQuery: "ASK { <${iri}> ?p ?o . }"
      resourceGraphQuery: "DESCRIBE <${iri}>"
      containerExistsQuery: "ASK { ?s a ?o. FILTER REGEX(STR(?s), \"^${iri}\") }"
      containerGraphQuery: "CONSTRUCT { ?s a ?o. } WHERE { ?s a ?o. FILTER REGEX(STR(?s), \"^${iri}\") }"
```

In this case, the [default](https://github.com/zazuko/trifid/blob/main/packages/handler-sparql/README.md) module from
Trifid is used. More information about how to configure this, can be found
on [their GitHub repo](https://github.com/zazuko/trifid/blob/main/packages/handler-sparql/README.md#examples).

> **NOTE**: Most of the graph dbs can handle the following sparql query:
> ```
> ASK { <${iri}> ?p ?o }
> ``` 
> However, RDF4J
> requires an additional dot before the closing curly bracket in this sparql query, which results in the following
> query:
> ```
> ASK { <${iri}> ?p ?o . }
> ```

#### Middleware node modules

In our case, we always used the default node modules provided by Trifid. But maybe, another node module is desired.
This can be achieved via two ways:

1. A module or file is mounted to the container and the right file path is set to the module property. \
   e.g.: a custom `rewrite.js` is mounted in the container with the following path: `/app/custom/rewrite.js`, then must
   the following config be provided in the `config.yaml` file: `middlewares.rewrite.module: ./custom/rewrite.js`
2. A npm package is installed \
   A custom docker image is required, but can easily be achieved by creating a custom `Dockerfile`. Don't forget to
   update your `docker-compose.yml` file to use the custom build and image! A custom docker file would look like this:

```dockerfile
FROM ghcr.io/zazuko/trifid:v4.1.1

# root privileges are required to install additional npm packages
USER root
RUN npm install <NPM_PACKAGE_TO_INSTALL> && npm install --omit=dev && npm cache clean --force
# run as node user

ENTRYPOINT ["tini", "--", "/app/server.js"]

# use the same health check as the base image
HEALTHCHECK CMD wget -q -O- http://localhost:8080/health
```

### Server port
By default, the Trifid server run listens internally on port 8080. If for some reason another port is desired, add to following to the `trifid/config.yaml` file:
```yaml
server:
  listener:
    port: 8888
```
If the port has changed, don't forget to update the `docker-compose.yml` with the modified port!

### Add Trifid to docker compose
To wrap up the Trifid configuration, add the following service to `docker-compose`
```yaml
  trifid:
    image: vsds/trifid
    build: # custom build as long as the updated plugin is not plugged in the image yet
      context: ./trifid
    container_name: trifid
    ports:
      - "8888:8080"
    volumes:
      - ./trifid/config.yaml:/app/config.yaml:ro
      - ./trifid/welcome.hbs:/app/welcome.hbs:ro
    environment:
      - TRIFID_CONFIG=./config.yaml # required to point where the config is located
    networks:
      - subject-pages-network
    depends_on:
      repository-initializer:
        condition: service_completed_successfully
```

The only thing left to do, is spin everything up:
```shell
docker compose up
```