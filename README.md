# 🛡️ VoteShield — The Election Guardian Platform

**VoteShield** is an AI-powered, proactive voter protection platform designed to safeguard democratic integrity. It features a suite of tools for monitoring ECI voter rolls, accepting anonymous incident reports, providing multilingual AI-driven first-time voter guidance, and tracking live election anomalies across India.

![VoteShield Dashboard](https://github.com/user-attachments/assets/dashboard-preview.png)

## 🚀 Features

- **🛡️ Live Incident Mapping:** Real-time visualization of election violations (Booth Capturing, Cash-for-Votes, Intimidation) on an interactive Leaflet map.
- **🤖 Multilingual AI Chatbot:** Built-in WhatsApp webhook powered by Anthropic's Claude 3.5 Sonnet to automatically triage incident reports, fact-check misinformation, and guide first-time voters in **12+ Indian languages**.
- **🔍 Automated Voter Roll Auditing:** Daily background jobs that detect mass deletions or unauthorized additions in specific constituencies.
- **⚡ Priority Queue System:** Redis-backed dispatcher to route high-urgency incidents to rapid-response flying squads.
- **🕵️ Data Privacy:** All reporter personal identifiable information (PII) is securely hashed (SHA-256) to ensure absolute anonymity.

---

## 🛠️ Tech Stack

### Frontend (Dashboard)
- **React (Vite)** + **TypeScript**
- **Tailwind CSS** + **Lucide Icons**
- **Leaflet.js** (for Geo-spatial mapping)
- **React Router**

### Backend (API Engine)
- **Node.js** + **Express** + **TypeScript**
- **Drizzle ORM**
- **BullMQ** (Redis Queue for job processing)
- **Anthropic SDK** (Claude Sonnet for Intent Classification)
- **Twilio SDK** (WhatsApp/SMS Interface)

### Infrastructure
- **PostgreSQL 15** (Primary Database)
- **Redis** (Queue & Rate Limiting)
- **Docker Compose** (Container Orchestration)

---

## 📦 Getting Started (Local Development)

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/) installed
- [Node.js 20+](https://nodejs.org/) (if running natively)

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/yourusername/voteshield.git
cd voteshield
\`\`\`

### 2. Environment Setup
Create an \`.env\` file in \`apps/api/.env\`:
\`\`\`env
# Infrastructure
DATABASE_URL="postgresql://voteshield:password@postgres:5432/voteshield"
REDIS_URL="redis://redis:6379"

# Security & AI
ANTHROPIC_API_KEY="your-claude-api-key"
JWT_SECRET="your-super-secret-key"

# Demo settings
DEMO_MODE="true"
\`\`\`

### 3. Build and Run Containers
\`\`\`bash
docker-compose up --build
\`\`\`
This single command spins up PostgreSQL, Redis, the Node.js API, and the React Dashboard.

### 4. Seed the Database
To populate the database with 500+ realistic demo incidents, run:
\`\`\`bash
docker exec -it voteshield-api node -e "require('./dist/db/seed.js')"
\`\`\`

### 5. Access the Platform
- **Dashboard:** [http://localhost:5173](http://localhost:5173)
- **API Health:** [http://localhost:3000/health](http://localhost:3000/health)

---

## 📱 Testing the AI Chatbot
The platform includes an **in-browser WhatsApp Simulator**. You do not need Twilio to test it.
1. Open the dashboard.
2. Click the floating **💬 Test the AI Bot!** widget in the bottom right corner.
3. Select your language (Hindi, Tamil, Telugu, Bengali, or English) from the dropdown.
4. Type \`REPORT\` or \`2\` to simulate a booth violation.

---

## 🚀 Deployment Guide
To deploy VoteShield in a production environment:

1. **Database:** Provision a managed PostgreSQL instance (e.g., Supabase, RDS) and a Redis instance (e.g., Upstash).
2. **Backend:** Deploy \`apps/api\` using a PaaS like Render or Railway. Set your \`DATABASE_URL\` and \`REDIS_URL\` environment variables.
3. **Frontend:** Deploy \`apps/dashboard\` to Vercel or Firebase Hosting. Update the \`VITE_API_URL\` to point to your live backend.
4. **Webhooks:** In your Twilio console, point the WhatsApp Webhook URL to \`https://your-api.com/api/whatsapp\`.

---

*Built for democracy. Designed for scale.* 🇮🇳
