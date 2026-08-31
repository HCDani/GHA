# GHA — Greenhouse Monitoring

A self-hosted monitoring platform for greenhouses. Sensor nodes publish temperature,
humidity and light readings over MQTT; the platform validates and stores them, and
presents them to each user as their own set of greenhouses with embedded Grafana
dashboards, alongside current outdoor weather for the greenhouse's location.

Built as a 7th-semester bachelor project at VIA University College.

![Architecture](Documentation/Architecture%20diagram/Architecture%20diagram.png)

## How data flows

1. A sensor node publishes a JSON payload to the `ghanode/sensor` topic on **Mosquitto**
   (authenticated; anonymous access is disabled).
2. **Filebeat** subscribes to that topic via its MQTT input and forwards messages to Logstash.
3. **Logstash** parses the JSON, normalises field names (`Sensor ID` to `sensor_id`,
   `temperature` to `temperature_c`, `humidity` to `humidity_pct`) and runs a validation
   step that checks every reading is present and numeric.
4. Valid documents are indexed into daily **OpenSearch** indices (`sensors-YYYY.MM.dd`).
   Invalid ones are routed to `sensors-errors-YYYY.MM.dd` with a `pipeline_errors` array
   naming what failed, and the raw values preserved, so bad input is never silently dropped.
5. **Grafana** queries OpenSearch and renders panels, which the React frontend embeds
   per greenhouse.

## Stack

**Frontend** — React 19 with React Router, PocketBase JS SDK for data and auth, Grafana
panels embedded as iframes with per-panel sizing.

**Ingestion and storage** — Eclipse Mosquitto, Filebeat, Logstash with a custom Ruby
validation filter, OpenSearch 2.15 with security enabled, plus OpenSearch Dashboards.

**Auth** — Keycloak 26.5.1 provides single sign-on. The frontend authenticates through
PocketBase; Grafana uses Keycloak directly over generic OAuth so embedded panels stay
inside the same session.

**Edge** — OpenResty/nginx reverse-proxies every service under one hostname: the React
build at `/`, PocketBase at `/pb/`, Grafana at `/grafana`, Keycloak at `/keycloak`,
OpenSearch Dashboards at `/opensearch`, and the Open-Meteo weather API at `/weather/`
so the browser never calls a third-party origin directly.

**Data model** — Each user's greenhouses live in a per-user PocketBase collection. A
greenhouse stores its Grafana panels as a JSON array of `{ grafanaURL, panel_width,
panel_height }`, so users add panels by pasting Grafana's iframe embed snippet.

## Repository layout

```
ghafrontend/        React application and Jest test suite
Docker-compose/     Full stack: Mosquitto, Filebeat, Logstash, OpenSearch,
                    Grafana, Keycloak, PocketBase, nginx
Documentation/      Architecture, class, sequence, activity and use-case
                    diagrams, plus the bachelor report
test_data/          Sample sensor payloads
```

## Running it

The stack expects an external Docker network and a few secrets in the environment
(`PASSWORD_OPENSEARCH`, `GF_OAUTH_CLIENT_SECRET`).

```bash
docker network create --subnet 172.19.0.0/16 network-gha_gha
cd Docker-compose && docker compose up -d --build
```

Frontend, from `ghafrontend/`:

```bash
npm ci
npm start
```

## Tests

**Frontend** — 87 tests across 13 suites covering routing, authentication, the
greenhouse ordering rules, Grafana URL parsing, the weather hook and the modal flows.

```bash
cd ghafrontend && npm test
```

**Integration** — Seven tests that exercise the real pipeline end to end. One publishes
a valid reading to MQTT and asserts the parsed document arrives in OpenSearch with the
right types. The other six publish deliberately broken payloads — missing sensor ID,
missing or non-numeric readings — and assert that nothing reaches the main index and
that a correctly tagged error document appears instead. Each test cleans up after itself.

```bash
cd Docker-compose && docker compose -f docker-compose-tests.yml run --rm integration-tests
```

## CI

Two GitHub Actions workflows run on every pull request to `main`. `frontend-tests.yml`
installs with `npm ci` and runs the Jest suite. `integration-tests.yml` builds and starts
the entire Docker Compose stack, waits for OpenSearch to become healthy, runs the
integration tests against it, dumps container logs on failure and tears the stack down.

## Documentation

The `Documentation/` directory contains the diagrams behind the design — architecture,
class, sequence, activity and use-case — along with the full bachelor report.

## Status

Completed and archived at graduation. Not under active development.
