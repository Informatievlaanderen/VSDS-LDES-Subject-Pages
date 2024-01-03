apt-get update && apt-get install curl -y && apt-get clean
curl -X PUT http://sparql-host:8080/rdf4j-server/repositories/query -H "Content-Type: text/turtle" -d "@/initializer/test.config.ttl"