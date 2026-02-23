<img width="1326" height="683" alt="image" src="https://github.com/user-attachments/assets/bf211603-e61a-4ef3-a8ac-1f0f8265b46d" /># Tars Web Chat

A modern, production-ready real-time chat web application built with Next.js 14+ (App Router), Convex, Clerk, and Tailwind CSS.

## Features

- **Authentication**: Clerk (email + social login).
- **User Directory**: List all users except current user, real-time search.
- **Real-Time Messaging**: 1-on-1 private messaging, real-time updates via Convex.
- **Modern Message UI**: Clean chat bubbles, date-time formatting for today, older, and last year.
- **Empty & Loading States**: Skeletons for UI components.
- **Responsive Design**: Mobile-friendly conversation list and full-screen chat. Desktop sidebar layout.
- **Delete Messages**: Soft delete functionality for your own messages.
- **Unread Messages**: Badge count and auto-clearing logic on open.
- **Smart Auto Scroll**: Automatically jumps to the newest message, scroll to read history without snapping.

## Architecture Decisions

1. **Frontend**: Next.js 14+ with App Router for server-safe, modern fetching patterns.
2. **Database & Realtime Backend**: Convex replaces standard REST + Postgres. It offers automatic websocket subscriptions where components instantly re-render on data modification without needing manual WebSockets.
3. **Auth**: Clerk integration automatically issues identity tokens which Convex maps natively into database permissions.
4. **Styling**: Tailwind CSS + Shadcn/ui for headless accessible components wrapped in standard styling tags.

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- npm or yarn

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env.local` file with the following variables:
```
NEXT_PUBLIC_CONVEX_URL=your_convex_url
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_ISSUER_URL=your_clerk_issuer_url
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret
```

### 4. Setup Convex
Initialize Convex backend:
```bash
npx convex dev
```

### 5. Start Development Server
```bash
npm run dev
```

Navigate to `http://localhost:3000` to preview the app.

## Deployment Steps

1. Push your repository to GitHub.
2. Connect the repository to Vercel.
3. Set the build command to `npm run build` and install command to `npm install`.
4. Ensure all environment variables listed in `.env.local` are copied over to Vercel Environment Variables.
5. Provide your *Production Convex Deployment URL* to your Production Vercel App environment.
6. Deploy!


## Vercel Link
https://tars-webchat.vercel.app
