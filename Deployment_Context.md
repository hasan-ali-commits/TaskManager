# Yoga-Do Deployment Context

## Project Overview

Yoga-Do is a full-stack task management web application developed as a BE Mini Project.

The application allows users to:

- Register and Login
- Create, Edit and Delete Tasks
- Create Recurring Tasks
- Calendar Views (Month / Week / Day)
- Dashboard Analytics
- Focus Timer
- User Authentication

The project is built primarily as a Web Development application with integrated DevOps practices.

---

# Technology Stack

Frontend
- React
- TypeScript
- Vite

Backend
- Django
- Django REST Framework

Database
- SQLite

Authentication
- Django Session Authentication
- CSRF Protection

DevOps
- Git
- GitHub
- Docker
- GitHub Actions
- Render
- Vercel

Testing
- Playwright
- Django Tests

---

# Repository Structure

frontend/
backend/

Frontend and Backend are independent applications communicating through REST APIs.

---

# Current Status

Frontend:
Runs successfully using

npm run dev

Backend:
Runs successfully using

python manage.py runserver

Localhost is fully functional.

---

# Local Development URLs

Frontend

http://localhost:5173

Backend

http://localhost:8000

---

# Deployment Goal

Frontend:
Deploy to Vercel

Backend:
Deploy to Render

Both deployments should work exactly like localhost.

---

# Previous Deployment Attempts

Deployment was partially successful.

Render backend became accessible.

Vercel frontend deployed successfully.

However authentication failed because of session/cookie/CORS configuration.

Later localhost stopped working because api.ts was pointing to the Render backend.

Changing

const API_BASE = "http://localhost:8000"

fixed localhost completely.

---

# Current Known Working Configuration

api.ts

Development

const API_BASE = "http://localhost:8000"

Backend

Runs correctly on localhost.

GitHub Actions

Passing.

Docker

Working.

---

# What MUST NOT be changed

Do NOT redesign the project.

Do NOT rewrite authentication.

Do NOT migrate the database.

Do NOT change the project structure.

Do NOT replace Session Authentication with JWT.

Do NOT introduce unnecessary libraries.

Only make the minimum deployment-related changes.

---

# Deployment Requirements

The deployed application should:

- Register users
- Login users
- Create Tasks
- Edit Tasks
- Delete Tasks
- Create Recurring Tasks
- Logout

All functionality available on localhost should work identically after deployment.

---

# Branch Strategy

Deployment work will be done in a dedicated deploy branch.

Only after successful testing should changes be merged into main.
