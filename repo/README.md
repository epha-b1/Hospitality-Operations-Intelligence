# Hospitality Operations Intelligence

Offline-first backend API for hotel group itinerary coordination, operational reporting, staffing imports, and face enrollment.

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

## Ports

| Service | URL |
|---------|-----|
| API     | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |
| MySQL   | localhost:3306 |

## Test Credentials

| Username | Password      | Role        |
|----------|---------------|-------------|
| admin    | Admin1!pass   | hotel_admin |

## Run Tests

```bash
# Inside the container
docker compose exec api sh run_tests.sh

# Or individually
docker compose exec api npm run test:unit
docker compose exec api npm run test:api
```
