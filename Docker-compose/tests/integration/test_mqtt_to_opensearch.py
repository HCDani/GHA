import json
import os
import time
import uuid
from pprint import pprint

import pytest
import paho.mqtt.client as mqtt
from opensearchpy import OpenSearch


def publish_mqtt(host, port, username, password, topic, payload, timeout=10):
    done = {"ok": False, "err": None}

    def on_connect(client, userdata, flags, rc):
        if rc != 0:
            done["err"] = RuntimeError(f"MQTT connect failed rc={rc}")
            return
        client.publish(topic, payload, qos=1)
        done["ok"] = True
        client.disconnect()

    client = mqtt.Client()
    client.username_pw_set(username, password)
    client.on_connect = on_connect

    client.connect(host, int(port), keepalive=30)
    client.loop_start()

    t0 = time.time()
    while time.time() - t0 < timeout and not done["ok"] and not done["err"]:
        time.sleep(0.1)

    client.loop_stop()

    if done["err"]:
        raise done["err"]
    if not done["ok"]:
        raise TimeoutError("MQTT publish did not complete in time")


def make_opensearch_client(host, port, username, password):
    return OpenSearch(
        hosts=[{"host": host, "port": int(port)}],
        http_auth=(username, password),
        use_ssl=True,
        verify_certs=False,
        ssl_show_warn=False,
    )

def assert_not_indexed(client, index_pattern, query, timeout_seconds=20):
    deadline = time.time() + timeout_seconds
    last_err = None
    while time.time() < deadline:
        try:
            res = client.search(index=index_pattern, body=query)
            hits = res.get("hits", {}).get("hits", [])
            if hits:
                hit = hits[0]
                raise AssertionError(
                    f"Expected NO document, but found one in index {hit.get('_index')} id={hit.get('_id')}"
                )
            return
        except Exception as e:
            last_err = e
        time.sleep(2)
    if last_err:
        raise AssertionError(f"Search kept failing for {index_pattern}. Last error: {last_err}")



def delete_test_docs_everywhere(client: OpenSearch, sensor_id: str) -> None:
    for index_pat in ["it-sensors-*", "sensors-errors-*"]:
        try:
            resp = client.delete_by_query(
                index=index_pat,
                body={"query": {"match_phrase": {"sensor_id": sensor_id}}},
                conflicts="proceed",
                refresh=True,
            )
            print(f"\n[cleanup] index={index_pat} sensor_id={sensor_id}")
            print(f"[cleanup] Response: {resp}\n")
        except Exception as e:
            print(f"\n[cleanup] WARNING index={index_pat} sensor_id={sensor_id}: {e}\n")



@pytest.mark.integration
def test_end_to_end_mqtt_to_opensearch():
    mqtt_host = os.getenv("IT_MQTT_HOST", "mqtt")
    mqtt_port = os.getenv("IT_MQTT_PORT", "1883")
    mqtt_user = os.getenv("IT_MQTT_USER", "ghasensor")
    mqtt_pass = os.getenv("IT_MQTT_PASS", "*****")
    mqtt_topic = os.getenv("IT_MQTT_TOPIC", "ghanode/sensor")

    os_host = os.getenv("IT_OS_HOST", "opensearch")
    os_port = os.getenv("IT_OS_PORT", "9200")
    os_user = os.getenv("IT_OS_USER", "admin")
    os_pass = os.getenv("IT_OS_PASS", os.getenv("PASSWORD_OPENSEARCH", ""))

    sensor_id = f"it-sensors-{uuid.uuid4().hex[:10]}"
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    payload_obj = {
        "Sensor ID": sensor_id,
        "temperature": 21.5,
        "humidity": 45.2,
        "light": 123.0,
    }

    client = make_opensearch_client(os_host, os_port, os_user, os_pass)

    index_pattern = "it-sensors-*"
    query = {
        "query": {"match_phrase": {"sensor_id": sensor_id}},
        "sort": [{"@timestamp": {"order": "desc"}}],
        "size": 1,
    }

    try:
        print("\n===== MQTT payload sent =====")
        pprint(payload_obj)
        print("============================\n")

        publish_mqtt(mqtt_host, mqtt_port, mqtt_user, mqtt_pass, mqtt_topic, json.dumps(payload_obj))

        deadline = time.time() + 60
        last_err = None

        while time.time() < deadline:
            try:
                res = client.search(index=index_pattern, body=query)
                hits = res.get("hits", {}).get("hits", [])
                if hits:
                    hit = hits[0]
                    doc = hit["_source"]

                    print("\n===== OpenSearch document found =====")
                    print(f"Index: {hit.get('_index')}")
                    print(f"Document ID: {hit.get('_id')}")
                    pprint(doc)
                    print("====================================\n")

                    assert doc["sensor_id"] == sensor_id
                    assert isinstance(doc["temperature_c"], float)
                    assert isinstance(doc["humidity_pct"], float)
                    assert isinstance(doc["light"], float)
                    return
            except Exception as e:
                last_err = e

            time.sleep(2)

        raise AssertionError(f"Document not found in OpenSearch within timeout. Last error: {last_err}")

    finally:
        delete_test_docs_everywhere(client, sensor_id)




@pytest.mark.integration
def test_payload_without_temperature():
    mqtt_host = os.getenv("IT_MQTT_HOST", "mqtt")
    mqtt_port = os.getenv("IT_MQTT_PORT", "1883")
    mqtt_user = os.getenv("IT_MQTT_USER", "ghasensor")
    mqtt_pass = os.getenv("IT_MQTT_PASS", "*****")
    mqtt_topic = os.getenv("IT_MQTT_TOPIC", "ghanode/sensor")

    os_host = os.getenv("IT_OS_HOST", "opensearch")
    os_port = os.getenv("IT_OS_PORT", "9200")
    os_user = os.getenv("IT_OS_USER", "admin")
    os_pass = os.getenv("IT_OS_PASS", os.getenv("PASSWORD_OPENSEARCH", ""))

    sensor_id = f"it-sensors-{uuid.uuid4().hex[:10]}"
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    payload_obj = {
        "Sensor ID": sensor_id,
        "humidity": 45.2,
        "light": 123.0,
    }

    client = make_opensearch_client(os_host, os_port, os_user, os_pass)

    normal_query = {"query": {"match_phrase": {"sensor_id": sensor_id}}, "size": 1}

    error_index_pattern = "sensors-errors-*"
    error_query = {
        "query": {
            "bool": {
                "must": [
                    {"match_phrase": {"sensor_id": sensor_id}},
                    {"match_phrase": {"pipeline_errors": "missing_temperature"}},
                ]
            }
        },
        "size": 1,
        "sort": [{"@timestamp": {"order": "desc"}}],
    }

    try:
        print("\n===== MQTT invalid payload sent (missing temperature) =====")
        pprint(payload_obj)
        print("==========================================================\n")

        publish_mqtt(mqtt_host, mqtt_port, mqtt_user, mqtt_pass, mqtt_topic, json.dumps(payload_obj))

        assert_not_indexed(client, "it-sensors-*", normal_query, timeout_seconds=25)
        assert_not_indexed(client, "sensors-*", normal_query, timeout_seconds=25)

        deadline = time.time() + 30
        last_err = None
        while time.time() < deadline:
            try:
                res = client.search(index=error_index_pattern, body=error_query)
                hits = res.get("hits", {}).get("hits", [])
                if hits:
                    doc = hits[0]["_source"]
                    print("\n===== Error document found in sensors-errors-* =====")
                    pprint(doc)
                    print("===================================================\n")
                    assert doc["sensor_id"] == sensor_id
                    assert "pipeline_errors" in doc
                    assert "missing_temperature" in doc["pipeline_errors"]
                    assert "message" in doc or "event" in doc
                    return
            except Exception as e:
                last_err = e
            time.sleep(2)

        raise AssertionError(
            f"Expected error doc not found in {error_index_pattern}. Last error: {last_err}"
        )

    finally:
        delete_test_docs_everywhere(client, sensor_id)



@pytest.mark.integration
def test_payload_without_humidity():
    mqtt_host = os.getenv("IT_MQTT_HOST", "mqtt")
    mqtt_port = os.getenv("IT_MQTT_PORT", "1883")
    mqtt_user = os.getenv("IT_MQTT_USER", "ghasensor")
    mqtt_pass = os.getenv("IT_MQTT_PASS", "*****")
    mqtt_topic = os.getenv("IT_MQTT_TOPIC", "ghanode/sensor")

    os_host = os.getenv("IT_OS_HOST", "opensearch")
    os_port = os.getenv("IT_OS_PORT", "9200")
    os_user = os.getenv("IT_OS_USER", "admin")
    os_pass = os.getenv("IT_OS_PASS", os.getenv("PASSWORD_OPENSEARCH", ""))

    sensor_id = f"it-sensors-{uuid.uuid4().hex[:10]}"
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    payload_obj = {
        "Sensor ID": sensor_id,
        "temperature": 21.5,
        "light": 123.0,
    }

    client = make_opensearch_client(os_host, os_port, os_user, os_pass)

    normal_query = {"query": {"match_phrase": {"sensor_id": sensor_id}}, "size": 1}

    error_index_pattern = "sensors-errors-*"
    error_query = {
        "query": {
            "bool": {
                "must": [
                    {"match_phrase": {"sensor_id": sensor_id}},
                    {"match_phrase": {"pipeline_errors": "missing_humidity"}},
                ]
            }
        },
        "size": 1,
        "sort": [{"@timestamp": {"order": "desc"}}],
    }

    try:
        print("\n===== MQTT invalid payload sent (missing humidity) =====")
        pprint(payload_obj)
        print("=======================================================\n")

        publish_mqtt(mqtt_host, mqtt_port, mqtt_user, mqtt_pass, mqtt_topic, json.dumps(payload_obj))

        assert_not_indexed(client, "it-sensors-*", normal_query, timeout_seconds=25)
        assert_not_indexed(client, "sensors-*", normal_query, timeout_seconds=25)

        deadline = time.time() + 30
        last_err = None
        while time.time() < deadline:
            try:
                res = client.search(index=error_index_pattern, body=error_query)
                hits = res.get("hits", {}).get("hits", [])
                if hits:
                    doc = hits[0]["_source"]
                    print("\n===== Error document found in sensors-errors-* =====")
                    pprint(doc)
                    print("===================================================\n")
                    assert doc["sensor_id"] == sensor_id
                    assert "pipeline_errors" in doc
                    assert "missing_humidity" in doc["pipeline_errors"]
                    assert "message" in doc or "event" in doc
                    return
            except Exception as e:
                last_err = e
            time.sleep(2)

        raise AssertionError(
            f"Expected error doc not found in {error_index_pattern}. Last error: {last_err}"
        )

    finally:
        delete_test_docs_everywhere(client, sensor_id)


@pytest.mark.integration
def test_payload_without_light():
    mqtt_host = os.getenv("IT_MQTT_HOST", "mqtt")
    mqtt_port = os.getenv("IT_MQTT_PORT", "1883")
    mqtt_user = os.getenv("IT_MQTT_USER", "ghasensor")
    mqtt_pass = os.getenv("IT_MQTT_PASS", "*****")
    mqtt_topic = os.getenv("IT_MQTT_TOPIC", "ghanode/sensor")

    os_host = os.getenv("IT_OS_HOST", "opensearch")
    os_port = os.getenv("IT_OS_PORT", "9200")
    os_user = os.getenv("IT_OS_USER", "admin")
    os_pass = os.getenv("IT_OS_PASS", os.getenv("PASSWORD_OPENSEARCH", ""))

    sensor_id = f"it-sensors-{uuid.uuid4().hex[:10]}"
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    payload_obj = {
        "Sensor ID": sensor_id,
        "temperature": 21.5,
        "humidity": 45.2,
    }

    client = make_opensearch_client(os_host, os_port, os_user, os_pass)

    normal_query = {"query": {"match_phrase": {"sensor_id": sensor_id}}, "size": 1}

    error_index_pattern = "sensors-errors-*"
    error_query = {
        "query": {
            "bool": {
                "must": [
                    {"match_phrase": {"sensor_id": sensor_id}},
                    {"match_phrase": {"pipeline_errors": "missing_light"}},
                ]
            }
        },
        "size": 1,
        "sort": [{"@timestamp": {"order": "desc"}}],
    }


    try:
        print("\n===== MQTT invalid payload sent (missing light) =====")
        pprint(payload_obj)
        print("=====================================================\n")

        publish_mqtt(mqtt_host, mqtt_port, mqtt_user, mqtt_pass, mqtt_topic, json.dumps(payload_obj))

        assert_not_indexed(client, "it-sensors-*", normal_query, timeout_seconds=25)
        assert_not_indexed(client, "sensors-*", normal_query, timeout_seconds=25)

        deadline = time.time() + 30
        last_err = None
        while time.time() < deadline:
            try:
                res = client.search(index=error_index_pattern, body=error_query)
                hits = res.get("hits", {}).get("hits", [])
                if hits:
                    doc = hits[0]["_source"]
                    print("\n===== Error document found in sensors-errors-* =====")
                    pprint(doc)
                    print("===================================================\n")
                    assert doc["sensor_id"] == sensor_id
                    assert "pipeline_errors" in doc
                    assert "missing_light" in doc["pipeline_errors"]
                    assert "message" in doc or "event" in doc
                    return
            except Exception as e:
                last_err = e
            time.sleep(2)

        raise AssertionError(f"Expected error doc not found in {error_index_pattern}. Last error: {last_err}")

    finally:
        delete_test_docs_everywhere(client, sensor_id)



@pytest.mark.integration
def test_payload_without_sensor_id():
    mqtt_host = os.getenv("IT_MQTT_HOST", "mqtt")
    mqtt_port = os.getenv("IT_MQTT_PORT", "1883")
    mqtt_user = os.getenv("IT_MQTT_USER", "ghasensor")
    mqtt_pass = os.getenv("IT_MQTT_PASS", "*****")
    mqtt_topic = os.getenv("IT_MQTT_TOPIC", "ghanode/sensor")

    os_host = os.getenv("IT_OS_HOST", "opensearch")
    os_port = os.getenv("IT_OS_PORT", "9200")
    os_user = os.getenv("IT_OS_USER", "admin")
    os_pass = os.getenv("IT_OS_PASS", os.getenv("PASSWORD_OPENSEARCH", ""))

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    test_case_id = uuid.uuid4().hex

    payload_obj = {
        "temperature": 21.5,
        "humidity": 45.2,
        "light": 123.0,
        "test_case_id": test_case_id,
    }

    client = make_opensearch_client(os_host, os_port, os_user, os_pass)

    error_index_pattern = "sensors-errors-*"
    error_query = {
        "query": {
            "bool": {
                "must": [
                    {"match_phrase": {"pipeline_errors": "missing_sensor_id"}},
                    {"match_phrase": {"test_case_id": test_case_id}},
                ]
            }
        },
        "size": 1,
        "sort": [{"@timestamp": {"order": "desc"}}],
    }

    try:
        print("\n===== MQTT invalid payload sent (missing sensor id) =====")
        pprint(payload_obj)
        print("=========================================================\n")

        publish_mqtt(mqtt_host, mqtt_port, mqtt_user, mqtt_pass, mqtt_topic, json.dumps(payload_obj))

        deadline = time.time() + 30
        last_err = None
        while time.time() < deadline:
            try:
                res = client.search(index=error_index_pattern, body=error_query)
                hits = res.get("hits", {}).get("hits", [])
                if hits:
                    doc = hits[0]["_source"]
                    print("\n===== Error document found in sensors-errors-* =====")
                    pprint(doc)
                    print("===================================================\n")
                    assert "pipeline_errors" in doc
                    assert "missing_sensor_id" in doc["pipeline_errors"]
                    assert doc["test_case_id"] == test_case_id
                    assert "message" in doc or "event" in doc
                    return
            except Exception as e:
                last_err = e
            time.sleep(2)

        raise AssertionError(
            f"Expected error doc not found in {error_index_pattern}. Last error: {last_err}"
        )

    finally:
        try:
            client.delete_by_query(
                index="sensors-errors-*",
                body={"query": {"match_phrase": {"test_case_id": test_case_id}}},
                conflicts="proceed",
                refresh=True,
            )
        except Exception:
            pass


@pytest.mark.integration
def test_payload_missing_temperature_humidity_light():
    mqtt_host = os.getenv("IT_MQTT_HOST", "mqtt")
    mqtt_port = os.getenv("IT_MQTT_PORT", "1883")
    mqtt_user = os.getenv("IT_MQTT_USER", "ghasensor")
    mqtt_pass = os.getenv("IT_MQTT_PASS", "*****")
    mqtt_topic = os.getenv("IT_MQTT_TOPIC", "ghanode/sensor")

    os_host = os.getenv("IT_OS_HOST", "opensearch")
    os_port = os.getenv("IT_OS_PORT", "9200")
    os_user = os.getenv("IT_OS_USER", "admin")
    os_pass = os.getenv("IT_OS_PASS", os.getenv("PASSWORD_OPENSEARCH", ""))

    sensor_id = f"it-sensors-{uuid.uuid4().hex[:10]}"

    payload_obj = {
        "Sensor ID": sensor_id
    }

    client = make_opensearch_client(os_host, os_port, os_user, os_pass)

    normal_query = {"query": {"match_phrase": {"sensor_id": sensor_id}}, "size": 1}

    error_query = {
        "query": {
            "bool": {
                "must": [
                    {"match_phrase": {"sensor_id": sensor_id}},
                    {"match_phrase": {"pipeline_errors": "missing_temperature"}},
                    {"match_phrase": {"pipeline_errors": "missing_humidity"}},
                    {"match_phrase": {"pipeline_errors": "missing_light"}},
                ]
            }
        },
        "size": 1,
        "sort": [{"@timestamp": {"order": "desc"}}],
    }

    try:
        print("\n===== MQTT invalid payload sent (missing temp + humidity + light) =====")
        pprint(payload_obj)
        print("=======================================================================\n")

        publish_mqtt(mqtt_host, mqtt_port, mqtt_user, mqtt_pass, mqtt_topic, json.dumps(payload_obj))

        assert_not_indexed(client, "it-sensors-*", normal_query, timeout_seconds=25)
        assert_not_indexed(client, "sensors-*", normal_query, timeout_seconds=25)

        deadline = time.time() + 30
        last_err = None
        while time.time() < deadline:
            try:
                res = client.search(index="sensors-errors-*", body=error_query)
                hits = res.get("hits", {}).get("hits", [])
                if hits:
                    doc = hits[0]["_source"]

                    print("\n===== Error document found in sensors-errors-* =====")
                    pprint(doc)
                    print("===================================================\n")

                    assert doc["sensor_id"] == sensor_id

                    assert "pipeline_errors" in doc
                    errs = doc["pipeline_errors"]
                    assert "missing_temperature" in errs
                    assert "missing_humidity" in errs
                    assert "missing_light" in errs
                    return
            except Exception as e:
                last_err = e

            time.sleep(2)

        raise AssertionError(
            f"Expected multi-missing error doc not found. Last error: {last_err}"
        )

    finally:
        delete_test_docs_everywhere(client, sensor_id)



@pytest.mark.integration
def test_payload_with_invalid_temperature():
    mqtt_host = os.getenv("IT_MQTT_HOST", "mqtt")
    mqtt_port = os.getenv("IT_MQTT_PORT", "1883")
    mqtt_user = os.getenv("IT_MQTT_USER", "ghasensor")
    mqtt_pass = os.getenv("IT_MQTT_PASS", "*****")
    mqtt_topic = os.getenv("IT_MQTT_TOPIC", "ghanode/sensor")

    os_host = os.getenv("IT_OS_HOST", "opensearch")
    os_port = os.getenv("IT_OS_PORT", "9200")
    os_user = os.getenv("IT_OS_USER", "admin")
    os_pass = os.getenv("IT_OS_PASS", os.getenv("PASSWORD_OPENSEARCH", ""))

    sensor_id = f"it-sensors-{uuid.uuid4().hex[:10]}"

    payload_obj = {
        "Sensor ID": sensor_id,
        "temperature": "NOT_A_NUMBER",
        "humidity": 45.2,
        "light": 123.0,
    }

    client = make_opensearch_client(os_host, os_port, os_user, os_pass)

    normal_query = {"query": {"match_phrase": {"sensor_id": sensor_id}}, "size": 1}

    error_query = {
        "query": {
            "bool": {
                "must": [
                    {"match_phrase": {"sensor_id": sensor_id}},
                    {"match_phrase": {"pipeline_errors": "invalid_temperature"}},
                ]
            }
        },
        "size": 1,
        "sort": [{"@timestamp": {"order": "desc"}}],
    }

    try:
        print("\n===== MQTT invalid payload sent (invalid temperature) =====")
        pprint(payload_obj)
        print("===========================================================\n")

        publish_mqtt(mqtt_host, mqtt_port, mqtt_user, mqtt_pass, mqtt_topic, json.dumps(payload_obj))

        assert_not_indexed(client, "it-sensors-*", normal_query, timeout_seconds=25)
        assert_not_indexed(client, "sensors-*", normal_query, timeout_seconds=25)

        deadline = time.time() + 30
        last_err = None
        while time.time() < deadline:
            try:
                res = client.search(index="sensors-errors-*", body=error_query)
                hits = res.get("hits", {}).get("hits", [])
                if hits:
                    doc = hits[0]["_source"]

                    print("\n===== Error document found in sensors-errors-* =====")
                    pprint(doc)
                    print("===================================================\n")

                    assert doc["sensor_id"] == sensor_id
                    assert "pipeline_errors" in doc
                    assert "invalid_temperature" in doc["pipeline_errors"]
                    return
            except Exception as e:
                last_err = e
            time.sleep(2)

        raise AssertionError(f"Expected invalid_temperature error doc not found. Last error: {last_err}")

    finally:
        delete_test_docs_everywhere(client, sensor_id)
