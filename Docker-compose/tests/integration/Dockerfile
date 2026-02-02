FROM python:3.11-slim

WORKDIR /tests

COPY test_mqtt_to_opensearch.py .

RUN pip install --no-cache-dir pytest paho-mqtt opensearch-py

CMD ["pytest", "-m", "integration", "-q"]
