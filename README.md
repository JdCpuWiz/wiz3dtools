# WizQueue - 3D Printing Queue Generator

Self-hosted web application for managing 3D printing queues with automated PDF invoice processing.

## Features

- 📄 PDF invoice upload and automated product extraction
- 🤖 AI-powered extraction using Ollama vision LLM
- 📋 Drag-and-drop queue management
- ✏️ Edit and delete queue items
- 🗄️ PostgreSQL database storage
- 🎨 Clean, responsive UI with Tailwind CSS

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **AI**: Ollama (llava or llama3.2-vision)
- **Deployment**: Docker + Docker Compose

## Project Structure

```
wizqueue/
├── packages/
│   ├── backend/       # Express API server
│   ├── frontend/      # React application
│   └── shared/        # Shared TypeScript types
└── infrastructure/    # Docker and deployment configs
```

## Getting Started

### Prerequisites

- Node.js >= 20.0.0 (LTS)
- PostgreSQL >= 14
- Ollama with vision model

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd wizqueue
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up database:
```bash
npm run migrate
```

5. Start Ollama and pull vision model:
```bash
ollama serve
ollama pull minicpm-v:8b  # Recommended for invoice processing
# Or use: ollama pull llava
```

6. Start development servers:
```bash
npm run dev
```

The frontend will be available at http://localhost:5173 and the backend at http://localhost:3000.

## Development

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both packages for production
- `npm run migrate` - Run database migrations

## Deployment

See [infrastructure/README.md](infrastructure/README.md) for deployment instructions.

## License

MIT
