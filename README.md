# 🌍 Smart Resource Allocation Platform

<div align="center">

![Build with AI](https://img.shields.io/badge/Build%20with-Google%20AI-4285F4?style=for-the-badge&logo=google)
![GDG Solution Challenge](https://img.shields.io/badge/GDG-Solution%20Challenge-EA4335?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)

**A unified AI-powered NGO field reporting and volunteer coordination platform**

[🚀 Live Demo](https://smart-resource-allocation-rho.vercel.app) · [📹 Demo Video](https://youtu.be/GPh1HGIElaY) · [📁 Repository](https://github.com/sidhant0802/Smart-Resource-Allocation)

</div>

---

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Demo Credentials](#demo-credentials)
- [Team](#team)

---

## 🎯 About the Project

NGOs in India face four critical problems: **scattered field data**, **no urgency prioritization**, **inefficient volunteer deployment**, and **lack of zone coordination**. Existing tools like Google Forms, WhatsApp groups, and generic CRMs don't solve these together.

**Smart Resource Allocation** is an end-to-end platform that connects field staff, committee members, volunteers, and NGO managers in one unified system — powered by Google Gemini AI and a custom ML pipeline.

### How it works

```
Issue in Village → Staff submits report (PDF/Image/Voice/Text)
       ↓
Google Gemini AI analyzes → Urgency Score 0-100 assigned
       ↓
Committee reviews AI-prioritized reports → Creates task
       ↓
Volunteers apply or receive email invitation (slot system)
       ↓
All 3 slots filled → Task ACTIVE → Volunteers marked BUSY
       ↓
Task complete → Volunteers marked FREE → Problem Solved ✅
```

---

## ✨ Key Features

### 🤖 AI-Powered Report Analysis
- Multi-format input: **PDF, Image, Voice, Text**
- **Google Gemini 2.0 Flash** as primary analyzer
- Assigns urgency score (0–100), severity level, key problems, and suggested actions
- **7-module custom ML fallback pipeline** ensures 100% uptime:
  - Category Detector, Sentiment Analyzer, Entity Extractor
  - Context Checker (spaCy NER), Urgency Scorer, Text Summarizer, Action Generator
- Hindi language support for Indian field workers

### 👥 5-Role Platform
| Role | Responsibilities |
|------|-----------------|
| **Super Admin** | Approve/reject NGOs, monitor platform-wide analytics |
| **NGO Manager** | Create zones, appoint committees, view all zone activity |
| **Committee Member** | Review reports, approve staff/volunteers, create tasks |
| **NGO Staff** | Submit field reports, chat with AI about reports |
| **Volunteer** | Apply for tasks, view map, receive email assignments |

### 📍 Zone-Based Hierarchy
- Manager creates geographic zones
- Each zone has a dedicated committee member
- Staff and volunteers belong to specific zones
- No overlap, no gap, full accountability

### 📬 Slot-Based Email Confirmation
- Committee assigns up to 3 volunteer slots per task
- Volunteers confirm YES/NO via email link
- 1/3 → 2/3 → 3/3 → Task auto-activates
- Volunteer marked BUSY, preventing double-booking
- Task complete → Volunteer marked FREE

### 🗺️ Real-Time Map View
- Geo-tagged reports, active tasks, volunteer locations
- Mapbox GL JS across all 5 dashboards
- Everything visible geographically in real time

---

## 🛠️ Tech Stack

### Frontend
- **React 18** + **Vite** + **Tailwind CSS**
- **Mapbox GL JS** for interactive maps
- **Axios** with JWT interceptor
- **React Router v6**

### Backend
- **Node.js 20** + **Express.js**
- **MongoDB Atlas** + **Mongoose**
- **JWT** authentication + **Bcrypt**
- **Multer** + **Cloudinary** for file uploads
- **Nodemailer** + Gmail SMTP for emails
- **CORS** with role-based access control

### AI & ML Service
- **Python 3.11** + **FastAPI** + **Uvicorn**
- **Google Gemini 2.0 Flash** (primary)
- **scikit-learn**, **spaCy**, **TextBlob**, **PyMuPDF** (ML pipeline)
- Deployed as Docker container

### External Services
- **Cloudinary** — PDF, image, audio storage
- **Gmail SMTP** — assignment and approval emails
- **Mapbox API** — GPS maps and geocoding
- **Google Gemini AI** — multimodal analysis

### Deployment
- **Vercel** — React frontend
- **Render** — Node.js backend + Python ML (Docker)
- **MongoDB Atlas** — cloud database

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              USERS (5 Roles)                │
│  Super Admin | Manager | Committee          │
│  NGO Staff   | Volunteer                   │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────┐
│         FRONTEND: React + Vite              │
│    5 Role Dashboards + Mapbox GL Maps       │
│    Axios HTTP Client + JWT + React Router   │
└──────────────────┬──────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────┐
│       BACKEND: Node.js + Express            │
│  JWT Auth | CORS | Multer/Cloudinary        │
│  Auth | Reports | Tasks | Assignments       │
└──────┬───────────────────────┬──────────────┘
       │ MongoDB               │ HTTP
┌──────▼───────┐   ┌───────────▼──────────────┐
│ MongoDB Atlas│   │  PYTHON ML: FastAPI       │
│ Users, NGOs  │   │  PRIMARY: Gemini 2.0 Flash│
│ Zones, Tasks │   │  FALLBACK: 7 ML Modules   │
│ Reports, etc │   │  Text | Image | PDF |Voice│
└──────────────┘   └──────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB Atlas account
- Git

### 1. Clone the repository
```bash
git clone https://github.com/sidhant0802/Smart-Resource-Allocation.git
cd Smart-Resource-Allocation
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env   # Fill in your environment variables
npm run seed:roles     # Seed roles
npm run seed:dummy     # Seed dummy data (optional)
npm start
```

### 3. Setup Frontend
```bash
cd frontend
npm install
cp .env.example .env   # Fill in your environment variables
npm run dev
```

### 4. Setup Python ML Service
```bash
cd python-ml
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn main:app --reload --port 8000
```

---

## 🔐 Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/smart-resource-allocation
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PYTHON_ML_URL=http://localhost:8000
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_MAPBOX_TOKEN=your_mapbox_token
```

### Python ML (`python-ml/.env`)
```env
GEMINI_API_KEY=your_gemini_api_key
PORT=8000
```

---

## ☁️ Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | https://smart-resource-allocation-rho.vercel.app |
| Backend | Render (Node) | https://smart-resource-allocation.onrender.com |
| ML Service | Render (Docker) | https://smart-resource-allocation-1.onrender.com |
| Database | MongoDB Atlas | Cloud |

### Deploy Frontend (Vercel)
1. Import repo on [vercel.com](https://vercel.com)
2. Set root directory to `frontend`
3. Add `VITE_API_URL` and `VITE_MAPBOX_TOKEN` environment variables
4. Deploy

### Deploy Backend (Render)
1. New Web Service on [render.com](https://render.com)
2. Root directory: `backend`, Runtime: Node, Start: `node app.js`
3. Add all backend environment variables
4. Deploy

### Deploy ML Service (Render)
1. New Web Service, same repo
2. Root directory: `python-ml`, Runtime: **Docker**
3. Add `GEMINI_API_KEY` environment variable
4. Deploy

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@platform.com | Admin@123456 |
| Volunteer | rahul.volunteer@gmail.com | password123 |
| Volunteer | priya.volunteer@gmail.com | password123 |

> **Live Demo:** https://smart-resource-allocation-rho.vercel.app/login

---

## 🌟 What Makes It Different

| Existing Tools | Our Platform |
|----------------|-------------|
| Google Forms (manual, no priority) | AI urgency scoring 0–100, auto-prioritized dashboard |
| WhatsApp Groups (unstructured) | Slot-based email confirmation, full audit trail |
| VolunteerMatch (task listing only) | Zone hierarchy + multi-format reports + map |
| KoBoToolbox (collect only) | End-to-end: report → AI → task → volunteer |
| Generic NGO CRMs (no AI) | Gemini Vision, voice support, Hindi NLP, geospatial matching |

---

## 👨‍💻 Team

**Team Name:** GDG Innovators  
**Team Leader:** Sidhant Nirupam  
**Challenge:** GDG Solution Challenge — Smart Resource Allocation  

---

## 📄 License

This project is built for the GDG Solution Challenge 2026.

---

<div align="center">
  <strong>Issue Reported → AI Analysis → Task Creation → Volunteer Assignment → Problem Solved ✅</strong>
</div>
