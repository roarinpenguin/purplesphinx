# Purple Sphinx

<div align="center">
  <img src="assets/logo.png" alt="Purple Sphinx Logo" width="200" style="border-radius: 16px;">
  <p><em>Quiz game and voting platform</em></p>
</div>

## Quick start

1. Build and run

```bash
docker compose up --build
```

2. Open http://localhost:4000

## Default Credentials

Access Host or Admin via the **"Privileged Access"** dropdown in the top-right corner.

| Role  | Default Password |
|-------|------------------|
| Host  | `host123`        |
| Admin | `admin123`       |

> **Important:** Change these passwords in Admin → Users after first login.

## Access Levels

- **Players**: Main URL (http://localhost:4000) — join games with room code
- **Host**: Create and run quiz sessions, manage questions during games
- **Admin**: Full access — manage branding, questions, question sets, users, and player archive

## Features

### Quiz & Voting
- Question types: True/False, multiple choice, open text (max 1000 chars)
- Question sets/categories for organizing questions
- Rich text editor with image upload for questions
- Countdown timer for answers
- Real-time results and voting statistics
- Points per answer + live leaderboard
- Separate leaderboard window for display screens

### Administration
- **Branding**: Customize theme and banner
- **Questions**: CRUD with rich text editor, organize by question sets
- **Users**: Create host/admin accounts with custom passwords
- **Player Archive**: View all players who joined sessions (name + email)

### Host Features
- Create rooms with unique codes
- Filter questions by set during sessions
- Start/finish questions manually or with timer
- View live answers and scores
- Open leaderboard in separate window

## Architecture

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + Socket.IO
- **Data**: JSON file persistence (in `data/` volume)

Backend API + WebSocket: http://localhost:8882
