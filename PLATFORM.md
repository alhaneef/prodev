# ProDev Platform - Comprehensive Documentation

## Overview

ProDev Platform is an AI-powered autonomous development platform that provides comprehensive software development capabilities with full GitHub integration, long-term memory, bidirectional synchronization, and intelligent deployment management. The platform enables developers to create, manage, and deploy projects with AI agents that have full context awareness, persistent memory, and autonomous task execution capabilities.

## Architecture

### Core Components

#### 1. Authentication System (`components/auth-provider.tsx`, `app/api/auth/route.ts`)
- **Session-based authentication** with 30-day persistence
- **localStorage backup** for offline scenarios
- **Automatic session refresh** and recovery
- **Secure cookie management** with HttpOnly flags


#### 2. Database Layer (`lib/database.ts`)
- **Neon PostgreSQL** integration with serverless functions
- **Comprehensive data models** for users, projects, credentials
- **Real-time synchronization** with GitHub storage
- **ACID transactions** for data integrity
- **Optimized for free tier hosting** (Vercel/Cloudflare)

#### 3. GitHub Integration (`lib/github.ts`, `lib/github-storage.ts`)
- **Bidirectional synchronization** between platform and GitHub
- **Repository management** with full CRUD operations
- **File system operations** with nested folder support
- **Project metadata storage** in `.prodev/` directory
- **Agent memory persistence** in repository
- **File locking and read-only protection** system
- **Live file operation tracking** and updates

#### 4. AI Agent System (`lib/ai-agent.ts`)
- **Google Gemini AI** integration for code generation
- **Long-term memory** with context persistence
- **Autonomous task execution** with full project awareness
- **Conversation history** and learning accumulation
- **Code context understanding** across project lifecycle
- **Full CRUD operations** on project files and folders
- **Diff-based editing** for token efficiency
- **Real-time feedback loop** with status updates
- **Web search integration** for information gathering
- **Deployment error fixing** capabilities

#### 5. GitHub Storage Service (`lib/github-storage.ts`)
- **Project metadata management** in `.prodev/project.json`
- **Agent memory storage** in `.prodev/agent-memory.json`
- **Task and sprint management** in `.prodev/tasks.json` and `.prodev/sprints.json`
- **Bidirectional sync** between database and GitHub
- **Project structure initialization** with proper organization
- **File protection settings** in `.prodev/file-locks.json`

#### 6. Task Management System (`components/task-list.tsx`, `app/api/tasks/route.ts`)
- **GitHub-based task storage** (not database)
- **Full CRUD operations** via GitHub API
- **Bidirectional updates** between chat, tasks, and sprints
- **Manual editing and deletion** support
- **AI-autonomous task creation** and implementation
- **Sprint integration** with agile methodology

#### 7. Deployment System (`components/deployment-panel.tsx`, `app/api/deploy/route.ts`)
- **Multi-platform support** (Vercel, Netlify, Cloudflare)
- **Real-time deployment logs** and progress tracking
- **AI-powered error fixing** and retry mechanisms
- **Live preview functionality**
- **Framework-specific optimization**
- **Deployment status monitoring**

#### 8. Code Management (`components/code-preview.tsx`, `app/api/files/route.ts`)
- **Nested folder support** with expandable tree view
- **Live file editing** with real-time updates
- **File protection system** (read-only, no-CRUD flags)
- **Diff-based editing** for efficient updates
- **Live operation tracking** in both chat and code view
- **Multi-file operations** support

#### 9. Web Search Integration (`lib/web-search.ts`)
- **DuckDuckGo API integration** for free web search
- **Automatic information gathering** when needed
- **Search result integration** into AI responses
- **No paid API dependencies**

#### 10. Terminal Simulation (`lib/terminal-simulator.ts`)
- **Simulated terminal commands** for common operations
- **Support for curl, npm, git** and other commands
- **Helpful responses** for unsupported commands
- **Command history** and context awareness

### Data Flow

\`\`\`
User Action → Platform → GitHub Storage → AI Agent → Code Generation → Live Updates → GitHub Commit → Platform Sync → Deployment
\`\`\`

## Key Features

### 1. Autonomous Project Management
- **Real project data** loaded from GitHub storage
- **Progress tracking** with automated updates
- **AI-driven task management** with autonomous execution
- **Sprint planning** with agile methodology support
- **Live deployment** with error recovery
- **Bidirectional component communication**

### 2. Advanced AI Agent Capabilities
- **Full project context** awareness from GitHub storage
- **Long-term memory** with learning accumulation
- **Autonomous task execution** with intelligent prioritization
- **Code generation** with framework-specific best practices
- **Conversation continuity** across sessions
- **Error recovery** and deployment fixing
- **Web search** for information gathering
- **Real-time feedback** and status updates
- **Diff-based editing** for efficiency
- **File protection** respect and management

### 3. Enhanced GitHub Integration
- **Repository creation** and management
- **Nested folder operations** with full tree support
- **File locking system** for protection
- **Commit management** with descriptive messages
- **Branch operations** and merge capabilities
- **Live file tracking** and updates
- **Project structure** with comprehensive `.prodev/` management

### 4. Comprehensive Storage Architecture
\`\`\`
GitHub Repository Structure:
├── .prodev/
│   ├── project.json          # Project metadata and settings
│   ├── agent-memory.json     # AI agent memory and context
│   ├── tasks.json           # Task management data
│   ├── sprints.json         # Sprint planning data
│   ├── file-locks.json      # File protection settings
│   ├── deployment-logs.json # Deployment history and logs
│   └── chat-history.json    # Conversation persistence
├── src/                     # Source code
├── docs/                    # Documentation
├── tests/                   # Test files
├── .github/                 # GitHub workflows
└── README.md               # Auto-generated project info
\`\`\`

### 5. Multi-Platform Deployment
- **Vercel integration** with proper framework mapping
- **Netlify support** with build optimization
- **Cloudflare Pages** deployment capability
- **Real-time logs** and deployment tracking
- **Error detection** and AI-powered fixing
- **Preview environments** and staging support

### 6. Live Collaboration Features
- **Real-time file updates** across all interfaces
- **Live deployment tracking** with logs
- **Bidirectional task management** (chat ↔ tasks ↔ sprints)
- **Live agent feedback** during operations
- **Multi-component synchronization**

## API Endpoints

### Authentication
- `POST /api/auth` - Login/logout with session management
- `GET /api/user` - Get current user information
- `PATCH /api/user` - Update user profile

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project with AI setup
- `GET /api/projects/[id]` - Get specific project details
- `PATCH /api/projects/[id]` - Update project settings
- `GET /api/projects/[id]/download` - Download project as ZIP

### Tasks (GitHub-based)
- `GET /api/tasks` - Get project tasks from GitHub
- `POST /api/tasks` - Create, implement, or generate tasks
- `PATCH /api/tasks/[id]` - Update task status
- `DELETE /api/tasks/[id]` - Delete task

### Files
- `GET /api/files` - Get project file tree and content
- `POST /api/files` - Create or update files
- `DELETE /api/files` - Delete files or folders
- `GET /api/files/live-updates` - Live file operation tracking

### Chat
- `GET /api/chat` - Get conversation history
- `POST /api/chat` - Send message or implement request
- `GET /api/chat/status` - Get agent status and feedback

### Deployment
- `POST /api/deploy` - Deploy project to platform
- `GET /api/deploy/logs/[id]` - Get deployment logs
- `POST /api/deploy/fix` - Fix deployment errors
- `GET /api/preview` - Get preview URL

### Settings
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Update user preferences
- `GET /api/credentials` - Get API credentials
- `POST /api/credentials` - Save API credentials

### Web Search
- `GET /api/search` - Perform web search
- `POST /api/search/context` - Search with context

### Terminal
- `POST /api/terminal` - Execute simulated commands

## Database Schema

### Users Table
\`\`\`sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  timezone VARCHAR(100),
  language VARCHAR(10),
  github_username VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### Projects Table
\`\`\`sql
CREATE TABLE projects (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  framework VARCHAR(100) NOT NULL,
  repository VARCHAR(255) NOT NULL,
  owner VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  progress INTEGER DEFAULT 0,
  deployment_url TEXT,
  deployment_platform VARCHAR(50),
  github_repo_id INTEGER,
  last_deployment TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### Credentials Table
\`\`\`sql
CREATE TABLE credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  github_token TEXT,
  vercel_token TEXT,
  netlify_token TEXT,
  cloudflare_token TEXT,
  gemini_api_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
\`\`\`

### Deployment Logs Table
\`\`\`sql
CREATE TABLE deployment_logs (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) REFERENCES projects(id),
  platform VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  logs TEXT,
  deployment_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## Environment Variables

### Required Environment Variables
\`\`\`env
# Database
DATABASE_URL=postgresql://username:password@host:port/database
POSTGRES_URL=postgresql://username:password@host:port/database

# Authentication
JWT_SECRET=your-jwt-secret-key

# Firebase (Optional - for enhanced auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=your-service-account-json

# AI Integration
GOOGLE_AI_API_KEY=your-gemini-api-key

# Deployment Platforms (Optional)
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id

# Platform Optimization
NODE_ENV=production
VERCEL=1 # Auto-set by Vercel
\`\`\`

## File Structure

\`\`\`
prodev-platform/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── projects/             # Project management
│   │   ├── tasks/                # GitHub-based task management
│   │   ├── chat/                 # AI chat interface with status
│   │   ├── files/                # File operations with live updates
│   │   ├── deploy/               # Deployment with logs and fixing
│   │   ├── preview/              # Preview functionality
│   │   ├── search/               # Web search integration
│   │   ├── terminal/             # Terminal simulation
│   │   ├── settings/             # User settings
│   │   └── credentials/          # API credentials
│   ├── projects/                 # Project pages with deployment
│   ├── agents/                   # AI agents page
│   ├── repositories/             # GitHub repositories
│   ├── analytics/                # Analytics dashboard
│   ├── team/                     # Team management
│   ├── settings/                 # Settings page
│   └── layout.tsx                # Root layout
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── auth-provider.tsx         # Authentication context
│   ├── navigation.tsx            # Main navigation
│   ├── project-card.tsx          # Project display
│   ├── task-list.tsx             # GitHub-based task management
│   ├── chat-interface.tsx        # AI chat with live feedback
│   ├── code-preview.tsx          # Code viewer with nested folders
│   ├── sprint-board.tsx          # Agile board
│   ├── deployment-panel.tsx      # Deployment with live logs
│   └── credentials-setup.tsx     # API setup
├── lib/                          # Utility libraries
│   ├── database.ts               # Database operations
│   ├── github.ts                 # GitHub API client
│   ├── github-storage.ts         # GitHub storage service
│   ├── ai-agent.ts               # AI agent system with memory
│   ├── auth.ts                   # Authentication utilities
│   ├── deployment.ts             # Multi-platform deployment
│   ├── web-search.ts             # Web search integration
│   ├── terminal-simulator.ts     # Terminal command simulation
│   └── storage.ts                # File storage with protection
├── scripts/                      # Database scripts
│   ├── init-database.sql         # Initial schema
│   ├── update-database.sql       # Schema updates
│   └── update-database-v3.sql    # Latest schema updates
└── PLATFORM.md                  # This comprehensive documentation
\`\`\`

## Getting Started

### 1. Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL database (Neon recommended for free tier)
- GitHub account for repository management
- Google AI API key for Gemini integration
- Optional: Deployment platform tokens (Vercel, Netlify, Cloudflare)

### 2. Installation
\`\`\`bash
git clone <repository-url>
cd prodev-platform
npm install
\`\`\`

### 3. Environment Setup
\`\`\`bash
cp .env.example .env.local
# Edit .env.local with your configuration
\`\`\`

### 4. Database Setup
\`\`\`bash
# Run the initialization scripts in order
npm run db:init
npm run db:update
npm run db:update-v3
\`\`\`

### 5. Development
\`\`\`bash
npm run dev
\`\`\`

## Usage Guide

### Creating a Project
1. Navigate to Projects page
2. Click "Create Project"
3. Fill in project details (name, description, framework)
4. AI agent automatically sets up GitHub repository with `.prodev/` structure
5. Initial project structure created with task management integration

### AI Agent Interaction
1. Open project chat interface
2. AI agent has full context of project state and GitHub storage
3. Request features, bug fixes, or improvements
4. Agent autonomously implements changes with live feedback
5. Real-time file updates visible in code preview
6. Long-term memory persists across sessions in GitHub

### Advanced Task Management
1. View tasks stored in GitHub (`.prodev/tasks.json`)
2. Create manual tasks or let AI generate them
3. Edit and delete tasks directly
4. Track progress with sprint boards
5. Bidirectional updates between chat and task interfaces
6. AI agent implements tasks autonomously with status updates

### Multi-Platform Deployment
1. Configure deployment credentials in settings
2. Select target platform (Vercel, Netlify, Cloudflare)
3. Deploy with real-time logs and progress tracking
4. AI agent handles deployment errors automatically
5. Preview deployments before going live
6. Monitor deployment status and history

### File Management
1. Navigate nested folders in code preview
2. Set file protection (read-only, no-CRUD) as needed
3. Live file updates during AI operations
4. Diff-based editing for efficiency
5. Multi-file operations support

## Advanced Features

### GitHub Storage Integration
- All project data synchronized with GitHub repository
- `.prodev/` directory contains comprehensive platform metadata
- Bidirectional sync ensures consistency across all components
- Agent memory and context persisted for continuity
- File protection settings respected by AI agent

### AI Agent Memory System
- Conversation history stored in `.prodev/chat-history.json`
- Project context accumulated over time in `.prodev/agent-memory.json`
- Learning from user preferences and patterns
- Error recovery and solution memory
- Web search integration for missing information

### Live Collaboration Features
- Real-time file updates across all interfaces
- Live deployment tracking with detailed logs
- Bidirectional task management (chat ↔ tasks ↔ sprints)
- Live agent feedback during all operations
- Multi-component synchronization

### Multi-Platform Deployment
- Automatic platform detection and configuration
- Framework-specific build optimization
- Environment variable management
- Rollback capabilities for failed deployments
- AI-powered error detection and fixing

### Web Search Integration
- Free DuckDuckGo search for information gathering
- Automatic search when agent needs external information
- Search results integrated into responses
- No paid API dependencies

### Terminal Simulation
- Simulated terminal commands for common operations
- Support for curl, npm, git, and other commands
- Helpful responses for unsupported commands
- Command history and context awareness

## Platform Optimization

### Vercel Free Tier Optimization
- Efficient serverless function usage
- Optimized database queries with connection pooling
- Minimal resource consumption
- Edge function utilization where appropriate

### Cloudflare Free Tier Ready
- Compatible with Cloudflare Pages
- Workers integration support
- KV storage compatibility
- Edge-optimized architecture

### Performance Features
- Connection pooling with Neon
- Optimized queries with proper indexing
- Caching for frequently accessed data
- Background sync processes
- Efficient GitHub API usage

## Troubleshooting

### Common Issues
1. **Authentication Problems**: Check JWT_SECRET and session cookies
2. **GitHub API Limits**: Verify token permissions and rate limits
3. **Database Connection**: Ensure DATABASE_URL is correct and Neon is accessible
4. **AI Agent Errors**: Check GOOGLE_AI_API_KEY validity and quota
5. **Deployment Failures**: Verify platform credentials and framework mapping
6. **File Operations**: Check GitHub token permissions for repository access
7. **Task Management**: Ensure `.prodev/` directory exists in repository

### Debug Mode
Set `NODE_ENV=development` for detailed logging and error messages.

### Framework Mapping Issues
The platform automatically maps user-friendly framework names to platform-specific identifiers:
- "Next.js" → "nextjs" (Vercel)
- "React" → "create-react-app" (Vercel)
- "Vue.js" → "vue" (Vercel)

## Security Considerations

### Data Protection
- Encrypted credential storage in database
- Secure session management with HttpOnly cookies
- Input validation and sanitization
- Rate limiting on API endpoints
- File protection system for sensitive files

### GitHub Integration
- Token-based authentication with minimal permissions
- Secure webhook handling
- Repository access controls
- File locking system for protection

### AI Integration
- API key security and rotation
- Request validation and sanitization
- Response filtering for sensitive information
- Usage monitoring and limits

## Monitoring and Analytics

### Platform Metrics
- User engagement tracking
- Project success rates
- AI agent performance metrics
- Deployment statistics and success rates
- Task completion analytics

### Error Tracking
- Comprehensive error logging
- Performance monitoring
- User feedback collection
- Automated issue detection
- Deployment failure analysis

## Future Roadmap

### Planned Features
- Multi-user collaboration with real-time editing
- Advanced AI model integration (Claude, GPT-4)
- Custom deployment pipelines
- Enterprise security features
- Mobile application support
- Advanced analytics dashboards

### Integration Expansions
- Additional AI providers
- More deployment platforms
- Third-party tool integrations
- Advanced version control features
- Team collaboration tools

### Performance Enhancements
- Edge computing optimization
- Advanced caching strategies
- Real-time collaboration features
- Enhanced mobile experience

---

This documentation provides a comprehensive overview of the ProDev Platform's current capabilities and architecture. The platform now offers a complete autonomous development experience with enhanced feedback, real-time updates, comprehensive deployment capabilities, and intelligent task management. For specific implementation details, refer to the source code and inline comments. For support or contributions, please refer to the project repository.

**Last Updated**: December 2024
**Version**: 2.0.0
**Platform Status**: Production Ready
