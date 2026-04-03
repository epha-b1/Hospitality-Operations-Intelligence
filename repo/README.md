# Hospitality Operations Intelligence

Offline-first backend API for hotel group itinerary coordination, operational reporting, staffing imports, and face enrollment.

## Quick Start

```bash
docker compose up --build
```

No `.env` file needed — all configuration is inline in `docker-compose.yml`.

## Ports

| Service | URL |
|---------|-----|
| API     | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |
| MySQL   | localhost:3306 |

## Test Credentials

| Username  | Password        | Role        |
|-----------|-----------------|-------------|
| admin     | Admin1!pass     | hotel_admin |
| manager1  | Manager1!pass   | manager     |
| analyst1  | Analyst1!pass   | analyst     |
| member1   | Member1!pass    | member      |

## Run Tests

```bash
# From the project root — starts containers, waits for health, runs all tests
./run_tests.sh
```
