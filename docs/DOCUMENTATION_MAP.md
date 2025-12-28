# Documentation Map

Visual guide to finding the right documentation.

## 🗺️ Documentation Structure

```
docs/
│
├── 📖 README.md                          # Documentation index (start here!)
├── 📝 CHANGES_SUMMARY.md                 # Recent changes and improvements
├── 🔮 REAL_TIME_COLLABORATION_PLAN.md    # Future features
│
├── ✨ features/                          # What the system can do
│   ├── README.md                         # Features overview
│   ├── 🤖 AI Features (19 files)
│   │   ├── AI_CHAT_FEATURE.md
│   │   ├── AI_CHAT_CAPABILITIES.md
│   │   ├── HISTORICAL_LEARNING.md ⭐
│   │   ├── CHAT_PROJECT_CONTEXT_FIX.md ⭐
│   │   └── ...
│   └── 📊 Project Features (7 files)
│       ├── MULTI_PROJECT_GUIDE.md
│       ├── LAG_VALIDATION_WARNING.md ⭐
│       └── ...
│
├── 📚 guides/                            # How to use the system
│   ├── README.md                         # Guides overview
│   ├── 🚀 Getting Started (3 files)
│   │   ├── QUICKSTART.md
│   │   ├── DEV-QUICK-START.md
│   │   └── DEVELOPMENT-WORKFLOW.md
│   ├── 🤖 AI Guides (3 files)
│   │   ├── AI_SETUP.md
│   │   ├── AI_FEATURES_LOCATION_GUIDE.md
│   │   └── QUICK_START_HISTORICAL_LEARNING.md ⭐
│   └── 🧪 Testing (5 files)
│       ├── TESTING.md
│       └── ...
│
├── 🚢 deployment/                        # How to deploy
│   ├── README.md                         # Deployment overview
│   ├── 🐳 Docker (4 files)
│   │   ├── DOCKER-README.md
│   │   ├── DOCKER-DEPLOYMENT-SUMMARY.md
│   │   └── ...
│   ├── 📋 Guides (3 files)
│   │   ├── DEPLOYMENT.md
│   │   ├── COMPLETE-DEPLOYMENT-GUIDE.md
│   │   └── DEPLOYMENT-CHECKLIST.md
│   └── 🔧 Components (3 files)
│       ├── OLLAMA-INTEGRATION-SUMMARY.md
│       ├── DATABASE_MIGRATION.md
│       └── SQLITE_MIGRATION_SUMMARY.md
│
├── 🏗️ architecture/                      # How it works
│   ├── README.md                         # Architecture overview
│   ├── 📐 System Design (2 files)
│   │   ├── ARCHITECTURE.md
│   │   └── MS_PROJECT_COMPLIANCE_SUMMARY.md
│   ├── 🤖 AI Architecture (3 files)
│   │   ├── AI-SERVICE-README.md
│   │   ├── AI_BEFORE_AFTER.md
│   │   └── DEMO_AI_INTEGRATION.md
│   └── 📊 Data & Implementation (2 files)
│       ├── LAG_FORMAT_SPECIFICATION.md
│       └── IMPLEMENTATION_COMPLETE.md
│
└── 🔧 troubleshooting/                   # How to fix problems
    ├── README.md                         # Troubleshooting overview
    ├── 🆘 General (2 files)
    │   ├── TROUBLESHOOTING.md
    │   └── SERVER_STATUS.md
    ├── 🤖 AI Issues (4 files)
    │   ├── AI_FEATURES_TROUBLESHOOTING.md
    │   ├── AI_FEATURES_DIAGNOSTIC.md
    │   ├── AI_CHAT_BUTTON_FIX.md
    │   └── AI_UI_LOCATION.md
    ├── 📊 Feature Issues (2 files)
    │   ├── PREDECESSOR_COLUMN_TROUBLESHOOTING.md
    │   └── PREDECESSOR_VISUAL_GUIDE.md
    └── 🔧 Development (1 file)
        └── FIX_PYLANCE_WARNINGS.md
```

## 🎯 Find Documentation By...

### By Role

**👤 End User**
```
Start: docs/guides/QUICKSTART.md
Then:  docs/features/AI_CHAT_CAPABILITIES.md
       docs/features/HISTORICAL_LEARNING.md
Help:  docs/troubleshooting/TROUBLESHOOTING.md
```

**👨‍💻 Developer**
```
Start: docs/guides/DEV-QUICK-START.md
Then:  docs/architecture/ARCHITECTURE.md
       docs/guides/DEVELOPMENT-WORKFLOW.md
Help:  docs/troubleshooting/FIX_PYLANCE_WARNINGS.md
```

**🚀 DevOps**
```
Start: docs/deployment/DEPLOYMENT.md
Then:  docs/deployment/DOCKER-README.md
       docs/deployment/DEPLOYMENT-CHECKLIST.md
Help:  docs/troubleshooting/SERVER_STATUS.md
```

### By Task

**"I want to get started quickly"**
→ `docs/guides/QUICKSTART.md`

**"I want to use AI features"**
→ `docs/features/AI_FEATURES_COMPLETE_GUIDE.md`
→ `docs/guides/AI_SETUP.md`

**"I want AI to learn from my projects"**
→ `docs/features/HISTORICAL_LEARNING.md` ⭐
→ `docs/guides/QUICK_START_HISTORICAL_LEARNING.md` ⭐

**"I want to deploy to production"**
→ `docs/deployment/COMPLETE-DEPLOYMENT-GUIDE.md`
→ `docs/deployment/DEPLOYMENT-CHECKLIST.md`

**"I want to understand the architecture"**
→ `docs/architecture/ARCHITECTURE.md`
→ `docs/architecture/AI-SERVICE-README.md`

**"Something is broken"**
→ `docs/troubleshooting/TROUBLESHOOTING.md`
→ `docs/troubleshooting/AI_FEATURES_DIAGNOSTIC.md`

**"I want to work with multiple projects"**
→ `docs/features/MULTI_PROJECT_GUIDE.md`
→ `docs/features/CHAT_PROJECT_CONTEXT_FIX.md` ⭐

**"I want to test the application"**
→ `docs/guides/TESTING.md`
→ `docs/guides/TESTING_AI_FEATURES.md`

### By Feature

**AI Chat**
- Features: `docs/features/AI_CHAT_FEATURE.md`
- Commands: `docs/features/AI_CHAT_COMMANDS.md`
- Troubleshooting: `docs/troubleshooting/AI_FEATURES_TROUBLESHOOTING.md`

**Historical Learning** ⭐
- Overview: `docs/features/HISTORICAL_LEARNING.md`
- Quick Start: `docs/guides/QUICK_START_HISTORICAL_LEARNING.md`

**Multi-Project**
- Guide: `docs/features/MULTI_PROJECT_GUIDE.md`
- Setup: `docs/features/MULTI_PROJECT_SETUP_COMPLETE.md`
- Context Fix: `docs/features/CHAT_PROJECT_CONTEXT_FIX.md` ⭐

**Validation**
- Lag Validation: `docs/features/LAG_VALIDATION_WARNING.md` ⭐
- General: See main README

## 📊 Documentation Statistics

- **Total Files:** 60+ documentation files
- **Categories:** 5 main categories
- **Recent Updates:** 3 major features (2025-12-27)
- **Coverage:** Features, Guides, Deployment, Architecture, Troubleshooting

## ⭐ Recently Updated (2025-12-27)

1. **Historical Learning** - AI learns from past projects
2. **Chat Project Context Fix** - Chat works with correct project
3. **Lag Validation Warning** - Warns about suspicious lags

## 🔍 Search Tips

1. **Start with category README** - Each folder has a README.md
2. **Use file names** - Descriptive names indicate content
3. **Check main index** - `docs/README.md` has everything
4. **Follow links** - Documents link to related docs

## 📝 Documentation Conventions

- ⭐ = Recently added/updated
- 🤖 = AI-related
- 📊 = Project management
- 🚀 = Getting started
- 🔧 = Technical/troubleshooting

