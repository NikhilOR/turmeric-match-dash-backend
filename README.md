# Turmeric Dashboard Backend

Production-ready NestJS backend for a real-time turmeric trading matching dashboard.

## Features

- NestJS modular backend with Prisma + PostgreSQL
- Google Sheets polling every 15 seconds
- Weighted supplier/buyer/exporter matching engine
- Match storage, filtering, pagination, and summary APIs
- Swagger docs at `/docs`
- Optional WebSocket broadcast for new matches

## Quick Start

1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations: `npm run prisma:migrate`
5. Seed sample data: `npm run prisma:seed`
6. Start dev server: `npm run start:dev`

## Google Sheets Notes

- Share the Google Sheet with the configured service account email.
- The parser uses header names where available and falls back to column positions.
- Row processing state is tracked per sheet in the `sync_states` table.

## API

- `GET /matches`
- `GET /matches/:id`
- `GET /dashboard/summary`
- Swagger: `GET /docs`
