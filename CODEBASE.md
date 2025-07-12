# ProDev Platform - Comprehensive Codebase Documentation

## 🚀 Platform Overview

ProDev is an AI-powered development platform that enables autonomous software development through intelligent agents. The platform integrates with GitHub for repository management, supports multiple deployment platforms, and uses advanced AI models (primarily Puter.js with Claude Sonnet 4 and GPT-4.1, with Gemini as fallback) for code generation and task implementation.

## 🏗️ Architecture

### Core Technologies
- **Frontend**: Next.js 14 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Neon PostgreSQL with direct SQL queries
- **AI Providers**: 
  - Primary: Puter.js (Claude Sonnet 4, GPT-4.1)
  - Fallback: Google Gemini 2.0 Flash
- **Version Control**: GitHub API integration
- **Deployment**: Vercel, Netlify, Cloudflare Pages
- **Authentication**: Custom session-based auth

### Key Features
1. **AI-Powered Development**: Autonomous task generation and implementation
2. **GitHub Integration**: Full repository management and file operations
3. **Multi-Platform Deployment**: Support for major hosting platforms
4. **Real-time Chat Interface**: Interactive AI agent communication
5. **Task Management**: Intelligent task creation, tracking, and implementation
6. **Code Preview**: Live file browsing and editing
7. **WebContainer Integration**: In-browser development environment

## 📁 Project Structure

\`\`\`
prodev-platform/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── chat/                 # AI chat interface
│   │   ├── credentials/          # User credentials management
│   │   ├── deploy/               # Deployment operations
│   │   ├── files/                # File operations
│   │   ├── projects/             # Project management
│   │   ├── repositories/         # Repository operations
│   │   ├── settings/             # User settings
│   │   ├── tasks/                # Task management
│   │   ├── tools/                # AI tools integration
│   │   └── user/                 # User operations
│   ├── agents/                   # AI agents dashboard
│   ├── analytics/                # Analytics dashboard
│   ├── projects/                 # Projects management UI
│   ├── repositories/             # Repository browser
│   ├── settings/                 # Settings page
│   ├── team/                     # Team management
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── auth-provider.tsx         # Authentication context
│   ├── chat-interface.tsx        # AI chat component
│   ├── code-preview.tsx          # Code viewer/editor
│   ├── credentials-setup.tsx     # Credentials configuration
│   ├── deployment-panel.tsx      # Deployment interface
│   ├── floating-chat.tsx         # Floating chat widget
│   ├── import-project-dialog.tsx # Project import modal
│   ├── login-form.tsx            # Login interface
│   ├── navigation.tsx            # Main navigation
│   ├── project-card.tsx          # Project display card
│   ├── project-details.tsx       # Project details view
│   ├── shell.tsx                 # Terminal shell component
│   ├── sprint-board.tsx          # Agile sprint board
│   ├── task-list.tsx             # Task management interface
│   ├── theme-provider.tsx        # Theme context
│   └── webcontainer-preview.tsx  # WebContainer integration
├── lib/                          # Core libraries
│   ├── ai-agent.ts               # AI agent implementation
│   ├── auth.ts                   # Authentication utilities
│   ├── database.ts               # Database operations
│   ├── deployment.ts             # Deployment services
│   ├── github.ts                 # GitHub API client
│   ├── github-service.ts         # GitHub service layer
│   ├── github-storage.ts         # GitHub-based storage
│   ├── utils.ts                  # Utility functions
│   ├── webcontainer.ts           # WebContainer integration
│   └── webcontainer-service.ts   # WebContainer service
├── scripts/                      # Database scripts
│   ├── init-database.sql         # Initial schema
│   ├── update-database.sql       # Schema updates
│   ├── update-database-v2.sql    # Version 2 updates
│   └── update-database-v3.sql    # Version 3 updates
├── public/                       # Static assets
└── styles/                       # Additional styles
\`\`\`

## 🗄️ Database Schema

### Core Tables

#### users
\`\`\`sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    timezone VARCHAR(100),
    language VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

#### credentials
\`\`\`sql
CREATE TABLE credentials (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    github_token TEXT,
    github_username VARCHAR(255),
    vercel_token TEXT,
    vercel_team_id VARCHAR(255),
    netlify_token TEXT,
    cloudflare_token TEXT,
    cloudflare_account_id VARCHAR(255),
    gemini_api_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);
\`\`\`

#### projects
\`\`\`sql
CREATE TABLE projects (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    framework VARCHAR(100) NOT NULL,
    repository VARCHAR(255) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    deployment_url TEXT,
    deployment_platform VARCHAR(50),
    last_deployment TIMESTAMP,
    autonomous_mode BOOLEAN DEFAULT true,
    auto_approve BOOLEAN DEFAULT false,
    code_quality VARCHAR(50) DEFAULT 'production',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

#### tasks
\`\`\`sql
CREATE TABLE tasks (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(50) DEFAULT 'medium',
    type VARCHAR(50) DEFAULT 'manual',
    estimated_time VARCHAR(100),
    assigned_agent VARCHAR(255),
    files JSONB DEFAULT '[]',
    dependencies JSONB DEFAULT '[]',
    implementation_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

#### user_settings
\`\`\`sql
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT false,
    task_updates BOOLEAN DEFAULT true,
    deployment_alerts BOOLEAN DEFAULT true,
    weekly_reports BOOLEAN DEFAULT false,
    theme VARCHAR(50) DEFAULT 'light',
    auto_save BOOLEAN DEFAULT true,
    code_completion BOOLEAN DEFAULT true,
    autonomous_mode BOOLEAN DEFAULT true,
    auto_approve BOOLEAN DEFAULT false,
    code_quality VARCHAR(50) DEFAULT 'production',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);
\`\`\`

#### agent_memory
\`\`\`sql
CREATE TABLE agent_memory (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
    memory_data JSONB DEFAULT '{}',
    chat_history JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id)
);
\`\`\`

## 🤖 AI Integration

### Primary AI Provider: Puter.js

The platform uses Puter.js as the primary AI provider with the following hierarchy:

1. **Claude Sonnet 4** (Primary) - Via Puter.js
2. **GPT-4.1** (Secondary) - Via Puter.js  
3. **Gemini 2.0 Flash** (Fallback) - Direct integration

#### AI Agent Implementation

\`\`\`typescript
// lib/ai-agent.ts
export class AIAgent {
  private async performAIRequest(prompt: string, options: any = {}): Promise<string> {
    // Try Puter Claude Sonnet 4 first
    try {
      return await this.chatWithPuter(prompt, { model: 'claude-sonnet-4', ...options })
    } catch (error) {
      // Try Puter GPT-4.1 as fallback
      try {
        return await this.chatWithGPT4(prompt, options)
      } catch (error) {
        // Try Gemini as final fallback
        return await this.chatWithGemini(prompt, options)
      }
    }
  }
}
\`\`\`

### AI Capabilities

1. **Task Generation**: Intelligent analysis of project requirements to create actionable tasks
2. **Code Implementation**: Full feature implementation with file creation/modification
3. **Deployment Fixing**: Automatic error analysis and resolution
4. **Chat Interface**: Interactive development assistance
5. **Terminal Commands**: Simulated command execution with intelligent responses

## 🔌 API Endpoints

### Authentication
- `POST /api/auth` - User authentication
- `GET /api/user` - Get current user info
- `POST /api/user` - Update user profile

### Project Management
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details
- `PUT /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project
- `GET /api/projects/[id]/download` - Download project files

### Task Management
- `GET /api/tasks?projectId=xxx` - Get project tasks
- `POST /api/tasks` - Create/implement tasks
  - Actions: `generate`, `create`, `implement`, `implement_all`

### File Operations
- `GET /api/files?projectId=xxx` - Get project files
- `POST /api/files` - Create/update files

### Repository Management
- `GET /api/repositories` - List user repositories
- `POST /api/repositories` - Create repository

### Deployment
- `POST /api/deploy` - Deploy project
- `POST /api/deploy/fix` - Auto-fix deployment errors

### AI Chat
- `GET /api/chat?projectId=xxx` - Get chat history
- `POST /api/chat` - Send chat message

### Settings & Credentials
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Update settings
- `GET /api/credentials` - Get credentials
- `POST /api/credentials` - Update credentials

## 🔧 Core Services

### GitHubService
Handles all GitHub API interactions:
- Repository management
- File operations (CRUD)
- Branch management
- Commit operations

### GitHubStorageService
GitHub-based storage abstraction:
- Task persistence
- Project metadata
- Agent memory
- Deployment logs

### DeploymentService
Multi-platform deployment:
- Vercel integration
- Netlify integration
- Cloudflare Pages integration

### AIAgent
Core AI functionality:
- Multi-provider AI requests
- Task generation and implementation
- Chat responses
- Code analysis

## 🎨 UI Components

### Core Components
- `FloatingChat`: Persistent AI chat interface
- `TaskList`: Task management with drag-drop
- `CodePreview`: File browser and editor
- `DeploymentPanel`: Deployment status and controls
- `ProjectCard`: Project overview cards
- `SprintBoard`: Agile project management

### UI Framework
- **shadcn/ui**: Component library
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon system
- **React Hook Form**: Form management
- **Sonner**: Toast notifications

## 🚀 Deployment & Environment

### Environment Variables
\`\`\`env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
\`\`\`

### Deployment Platforms
1. **Vercel** (Primary)
2. **Netlify** 
3. **Cloudflare Pages**

## 🔒 Security & Authentication

### Authentication Flow
1. User login with email/password
2. Session stored in HTTP-only cookie
3. Session validation on protected routes
4. Automatic token refresh

### Data Security
- All API keys encrypted at rest
- GitHub tokens scoped to minimum permissions
- User data isolated by user ID
- CORS protection on all endpoints

## 🧪 Testing & Development

### Development Setup
\`\`\`bash
npm install
npm run dev
\`\`\`

### Database Setup
\`\`\`bash
# Run migration scripts in order
psql $DATABASE_URL -f scripts/init-database.sql
psql $DATABASE_URL -f scripts/update-database.sql
psql $DATABASE_URL -f scripts/update-database-v2.sql
psql $DATABASE_URL -f scripts/update-database-v3.sql
\`\`\`

## 📊 Performance & Monitoring

### Optimization Strategies
- File content caching in GitHubStorageService
- Lazy loading of components
- API response caching
- Efficient database queries

### Error Handling
- Comprehensive try-catch blocks
- Graceful AI provider fallbacks
- User-friendly error messages
- Detailed logging for debugging

## 🔄 Data Flow

### Task Implementation Flow
1. User requests task implementation
2. AI Agent analyzes task requirements
3. Code generation via AI providers (Puter.js → Gemini)
4. File modifications committed to GitHub
5. Task status updated in storage
6. User notified of completion

### Deployment Flow
1. User triggers deployment
2. Files fetched from GitHub
3. Platform-specific deployment initiated
4. Error monitoring and auto-fixing
5. Deployment status updated
6. User notified of results

## 🛠️ Maintenance & Updates

### Regular Maintenance
- Monitor AI provider usage and costs
- Update dependencies regularly
- Review and optimize database queries
- Clean up old deployment logs

### Feature Development
- All new features must maintain backward compatibility
- AI provider fallbacks must be tested
- Database migrations must be reversible
- UI components should follow existing patterns

## 📚 Usage Examples

### Creating a New Project
\`\`\`typescript
const project = await db.createProject({
  id: generateId(),
  user_id: userId,
  name: "My App",
  description: "A web application",
  framework: "Next.js",
  repository: "user/repo",
  owner: "user",
  status: "active",
  progress: 0,
  autonomous_mode: true,
  auto_approve: false,
  code_quality: "production"
})
\`\`\`

### Implementing Tasks with AI
\`\`\`typescript
const aiAgent = new AIAgent(apiKey, githubStorage, github)
const implementation = await aiAgent.implementTask(task, projectContext)
\`\`\`

### Deploying to Vercel
\`\`\`typescript
const deploymentService = new DeploymentService()
const result = await deploymentService.deployToVercel(config, files)
\`\`\`

This documentation provides a comprehensive overview of the ProDev platform codebase, enabling AI assistants and developers to understand, maintain, and extend the platform effectively while preserving all existing functionality and maintaining high code quality standards.
