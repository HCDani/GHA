FROM docker.elastic.co/logstash/logstash:8.15.0

RUN logstash-plugin remove logstash-output-elasticsearch || true

RUN logstash-plugin install logstash-output-opensearch
