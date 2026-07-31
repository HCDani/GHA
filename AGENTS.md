# GHA

Greenhouse monitoring. React frontend in `ghafrontend/`, infrastructure in
`Docker-compose/`: Mosquitto -> Logstash -> OpenSearch, plus Filebeat, nginx and Grafana.

## Commands

- Frontend tests: `cd ghafrontend && npm test`
- Integration tests: `cd Docker-compose && docker compose -f docker-compose-tests.yml run --rm integration-tests`

## Backend facts you cannot see

PocketBase is not in this repository. Do not guess its schema.

- Greenhouses live in a per-user collection named `<user.id>_greenhouses`
- Greenhouse fields: `Title`, `Description`, `Order`, `grafanadata`
- `grafanadata` is a JSON array of `{ grafanaURL, panel_width, panel_height }`
- User coordinates come from `user.preferences` as `{ lat, lon }`

PocketBase silently discards fields that are not in the collection schema, and the
update call still returns success. If a value fails to persist, suspect a missing
field before suspecting the client code.

## Rules

- Use the exact field names above. Never write fallback chains such as
  `record.grafanadata ?? record.grafanaData ?? record.Grafana_data`. If a name is
  uncertain, ask instead of covering every spelling.
- When the task is fixing or updating tests, do not modify anything outside
  `ghafrontend/src/__tests__/` (frontend) or `Docker-compose/tests/integration/`
  (integration). If a test can only pass by changing source code, stop and say so.
- Fix causes, not symptoms. Do not add compensating code downstream for a value that
  was mangled upstream.
- Implement what was asked. No extra validation, defaults, or error handling unless requested.
