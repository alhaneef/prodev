# ProDev Platform - Comprehensive Codebase Documentation

## 🏗️ **Architecture Overview**

ProDev is a Next.js-based AI-powered development platform that provides intelligent project management, code generation, and deployment capabilities. The platform integrates with GitHub for version control and uses Google's Gemini AI for intelligent assistance.

### **Core Technologies**
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui, Lucide React
- **Backend**: Next.js API Routes, Neon PostgreSQL
- **AI Integration**: Google Gemini AI (gemini-2.0-flash-exp)
- **Version Control**: GitHub API, Octokit
- **Authentication**: Custom session-based auth
- **Deployment**: Vercel, Cloudflare

## 📁 **Project Structure**

\`\`\`
prodev-platform/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── chat/                 # AI chat interface
│   │   ├── credentials/          # User credentials management
│   │   ├── deploy/               # Deployment endpoints
│   │   ├── files/                # File management API
│   │   ├── projects/             # Project CRUD operations
│   │   ├── tasks/                # Task management API
│   │   ├── terminal/             # Terminal command execution
│   │   └── user/                 # User management
│   ├── projects/                 # Project pages
│   ├── repositories/             # Repository management
│   ├── settings/                 # User settings
│   ├── team/                     # Team management
│   ├── analytics/                # Analytics dashboard
│   ├── agents/                   # AI agents management
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── auth-provider.tsx         # Authentication context
│   ├── chat-interface.tsx        # AI chat component
│   ├── code-preview.tsx          # Code viewer/editor
│   ├── deployment-panel.tsx      # Deployment interface
│   ├── floating-chat.tsx         # Floating chat widget
│   ├── navigation.tsx            # Main navigation
│   ├── project-card.tsx          # Project display card
│   ├── shell.tsx                 # Layout shell
│   ├── sprint-board.tsx          # Agile sprint board
│   ├── task-list.tsx             # Task management UI
│   ├── webcontainer-preview.tsx  # WebContainer integration
│   └── ...                       # Other components
├── lib/                          # Utility libraries
│   ├── ai-agent.ts               # AI agent implementation
│   ├── auth.ts                   # Authentication utilities
│   ├── database.ts               # Database operations
│   ├── deployment.ts             # Deployment utilities
│   ├── github.ts                 # GitHub API wrapper
│   ├── github-service.ts         # Enhanced GitHub service
│   ├── github-storage.ts         # GitHub-based storage
│   ├── utils.ts                  # General utilities
│   ├── webcontainer.ts           # WebContainer integration
│   └── webcontainer-service.ts   # WebContainer management
├── hooks/                        # Custom React hooks
├── scripts/                      # Database scripts
├── styles/                       # Additional styles
├── public/                       # Static assets
└── ...                          # Config files
\`\`\`

## 🔧 **Core Components**

### **1. Authentication System (`lib/auth.ts`)**
- **Session-based authentication** with secure cookie management
- **User registration/login** with email/password
- **Credential management** for GitHub tokens and API keys
- **Authorization helpers** for API route protection

\`\`\`typescript
// Key functions:
- getUserFromSession(request): Extract user from session
- requireGitHubToken(request): Ensure GitHub token exists
- AuthService.signUp/signIn: User authentication
\`\`\`

### **2. GitHub Integration (`lib/github-service.ts`)**
- **Complete GitHub API wrapper** using Octokit
- **Recursive file loading** for entire repository structure
- **File CRUD operations** (create, read, update, delete)
- **Repository management** and content handling

\`\`\`typescript
// Key methods:
- getAllRepositoryFiles(): Recursive file loading
- getFileContent(): Fetch file with proper encoding
- createFile/updateFile/deleteFile(): File operations
- createRepository(): Repository creation
\`\`\`

### **3. AI Agent System (`lib/ai-agent.ts`)**
- **Google Gemini AI integration** for intelligent assistance
- **Task generation** based on project context
- **Code implementation** with file creation/modification
- **Terminal command simulation** with intelligent responses
- **Chat interface** with contextual awareness

\`\`\`typescript
// Key capabilities:
- generateTasks(): Create intelligent development tasks
- implementTask(): Automatically implement tasks with code
- chatResponse(): Contextual AI conversations
- executeTerminalCommand(): Terminal simulation
\`\`\`

### **4. Task Management System**
- **Comprehensive task CRUD** operations
- **AI-powered task generation** based on project analysis
- **Automatic task implementation** with code generation
- **GitHub storage integration** for persistence
- **Status tracking** (pending, in-progress, completed, failed)

### **5. File Management System**
- **Real-time file synchronization** with GitHub
- **Recursive directory loading** for complete project structure
- **File editing capabilities** with syntax highlighting
- **Caching system** for performance optimization
- **Tree view organization** for easy navigation

### **6. WebContainer Integration**
- **Browser-based development environment**
- **Live code execution** and preview
- **Terminal access** within the browser
- **Session management** with usage limits
- **File system synchronization** with GitHub

## 🔌 **API Endpoints**

### **Authentication**
- `POST /api/auth` - User login/registration
- `GET /api/user` - Get current user info
- `POST /api/credentials` - Manage API credentials

### **Projects**
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details
- `PUT /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project

### **Files**
- `GET /api/files?projectId=X` - Get all project files
- `GET /api/files?projectId=X&filePath=Y` - Get specific file
- `POST /api/files` - Create/update/delete files

### **Tasks**
- `GET /api/tasks?projectId=X` - Get project tasks
- `POST /api/tasks` - Create/update/delete/implement tasks
- Actions: `create`, `update`, `delete`, `implement`, `implement_all`, `generate_ai_tasks`

### **Chat & AI**
- `GET /api/chat?projectId=X` - Get chat history
- `POST /api/chat` - Send message to AI agent
- `POST /api/terminal` - Execute terminal commands

### **Deployment**
- `POST /api/deploy` - Deploy project to platform
- `POST /api/deploy/fix` - Auto-fix deployment issues

## 🗄️ **Database Schema**

### **Users Table**
\`\`\`sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

### **Projects Table**
\`\`\`sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  framework VARCHAR(100),
  repository VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  progress INTEGER DEFAULT 0,
  deployment_url VARCHAR(255),
  deployment_platform VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

### **Tasks Table**
\`\`\`sql
CREATE TABLE tasks (
  id VARCHAR(255) PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'medium',
  type VARCHAR(50) DEFAULT 'manual',
  estimated_time VARCHAR(50),
  assigned_agent VARCHAR(255),
  files TEXT[], -- Array of file paths
  dependencies TEXT[], -- Array of dependency IDs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

### **Credentials Table**
\`\`\`sql
CREATE TABLE credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  github_token VARCHAR(255),
  gemini_api_key VARCHAR(255),
  vercel_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

## 🎯 **Key Features**

### **1. Intelligent Project Management**
- **AI-powered task generation** based on project analysis
- **Automatic code implementation** with GitHub commits
- **Progress tracking** and milestone management
- **Team collaboration** features

### **2. Advanced Code Editor**
- **Syntax highlighting** for multiple languages
- **Real-time collaboration** with GitHub sync
- **File tree navigation** with search capabilities
- **Live preview** and testing environment

### **3. AI Assistant Integration**
- **Contextual conversations** about your codebase
- **Code generation** and optimization suggestions
- **Terminal command execution** with intelligent responses
- **Documentation generation** and code review

### **4. Deployment Automation**
- **One-click deployment** to multiple platforms
- **Automatic error detection** and fixing
- **Environment configuration** management
- **Rollback capabilities** for failed deployments

### **5. WebContainer Environment**
- **Browser-based development** without local setup
- **Live code execution** and debugging
- **Package management** (npm/yarn) integration
- **Terminal access** with full command support

## 🔒 **Security Considerations**

### **Authentication**
- **Secure session management** with HTTP-only cookies
- **Password hashing** using industry standards
- **API token encryption** for third-party services
- **CORS protection** for API endpoints

### **Data Protection**
- **Input validation** on all API endpoints
- **SQL injection prevention** with parameterized queries
- **XSS protection** with content sanitization
- **Rate limiting** for API abuse prevention

### **GitHub Integration**
- **Token scope limitation** to required permissions
- **Secure token storage** with encryption
- **Repository access validation** before operations
- **Audit logging** for all GitHub operations

## 🚀 **Deployment Configuration**

### **Environment Variables**
\`\`\`bash
# Database
DATABASE_URL=postgresql://...

# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key

# GitHub Integration
GITHUB_TOKEN=ghp_your-token

# AI Services
GOOGLE_AI_API_KEY=your-gemini-key

# Deployment
VERCEL_TOKEN=your-vercel-token
CLOUDFLARE_ACCOUNT_ID=your-cf-account
\`\`\`

### **Build Configuration**
- **Next.js optimization** for production builds
- **Static asset optimization** with CDN integration
- **Database migration** scripts for deployment
- **Environment-specific configurations**

## 🧪 **Testing Strategy**

### **Unit Testing**
- **Component testing** with React Testing Library
- **API endpoint testing** with Jest
- **Utility function testing** for core logic
- **Database operation testing** with test fixtures

### **Integration Testing**
- **GitHub API integration** testing
- **AI agent functionality** testing
- **File operation workflows** testing
- **Authentication flow** testing

### **End-to-End Testing**
- **User workflow testing** with Playwright
- **Cross-browser compatibility** testing
- **Performance testing** under load
- **Deployment pipeline** testing

## 📈 **Performance Optimization**

### **Frontend Optimization**
- **Code splitting** with Next.js dynamic imports
- **Image optimization** with Next.js Image component
- **Caching strategies** for API responses
- **Bundle size optimization** with tree shaking

### **Backend Optimization**
- **Database query optimization** with indexes
- **API response caching** with Redis
- **File operation batching** for GitHub API
- **Connection pooling** for database operations

### **AI Integration Optimization**
- **Response caching** for similar queries
- **Token usage optimization** for cost efficiency
- **Parallel processing** for bulk operations
- **Fallback strategies** for API failures

## 🔧 **Development Workflow**

### **Local Development**
1. **Clone repository** and install dependencies
2. **Set up environment variables** for local testing
3. **Run database migrations** to set up schema
4. **Start development server** with hot reloading
5. **Use development tools** for debugging and testing

### **Code Standards**
- **TypeScript strict mode** for type safety
- **ESLint configuration** for code quality
- **Prettier formatting** for consistent style
- **Conventional commits** for clear history

### **Git Workflow**
- **Feature branches** for new development
- **Pull request reviews** before merging
- **Automated testing** on all commits
- **Semantic versioning** for releases

## 🐛 **Troubleshooting Guide**

### **Common Issues**

#### **GitHub Token Issues**
- Verify token has correct permissions (repo, user)
- Check token expiration date
- Ensure token is properly stored in credentials

#### **AI Agent Failures**
- Verify Gemini API key is valid and has quota
- Check network connectivity to Google AI services
- Review error logs for specific failure reasons

#### **File Loading Problems**
- Check repository permissions and access
- Verify file paths are correct and accessible
- Review GitHub API rate limits and usage

#### **Task Implementation Failures**
- Ensure all required credentials are configured
- Check AI agent has access to project context
- Verify GitHub repository write permissions

### **Debug Tools**
- **Browser console** for frontend debugging
- **API response logging** for backend issues
- **Database query logging** for data problems
- **GitHub webhook logs** for integration issues

## 🔄 **Maintenance & Updates**

### **Regular Maintenance**
- **Dependency updates** for security patches
- **Database cleanup** for old data
- **Log rotation** and monitoring
- **Performance monitoring** and optimization

### **Feature Updates**
- **AI model updates** for improved capabilities
- **UI/UX improvements** based on user feedback
- **New integration additions** (GitLab, Bitbucket)
- **Enhanced deployment options** (AWS, GCP)

### **Monitoring & Analytics**
- **Error tracking** with Sentry or similar
- **Performance monitoring** with Vercel Analytics
- **User behavior tracking** for UX improvements
- **API usage monitoring** for optimization

---

## 📝 **Usage Examples**

### **Creating a New Project**
\`\`\`typescript
// API call to create project
const response = await fetch('/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My New Project',
    description: 'A React application',
    framework: 'React',
    repository: 'username/repo-name'
  })
});
\`\`\`

### **Implementing Tasks with AI**
\`\`\`typescript
// Implement all pending tasks
const response = await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'project-123',
    action: 'implement_all'
  })
});
\`\`\`

### **Chat with AI Agent**
\`\`\`typescript
// Send message to AI agent
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'project-123',
    message: 'Create a user authentication component',
    conversationHistory: []
  })
});
\`\`\`

This comprehensive documentation provides a complete overview of the ProDev platform architecture, implementation details, and usage guidelines for AI assistants and developers working with the codebase.
