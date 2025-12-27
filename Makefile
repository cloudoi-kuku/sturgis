# Makefile for MS Project Configuration Tool
# Simplifies Docker commands for development and deployment

.PHONY: help build up down restart logs clean test backup restore

# Default target
help:
	@echo "MS Project Configuration Tool - Docker Commands"
	@echo ""
	@echo "Development:"
	@echo "  make build          - Build Docker images"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - View logs (follow mode)"
	@echo "  make logs-backend   - View backend logs"
	@echo "  make logs-frontend  - View frontend logs"
	@echo ""
	@echo "Production:"
	@echo "  make prod-build     - Build production images"
	@echo "  make prod-up        - Start production services"
	@echo "  make prod-down      - Stop production services"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean          - Remove containers, volumes, and images"
	@echo "  make prune          - Clean up Docker system"
	@echo "  make backup         - Backup project data"
	@echo "  make restore        - Restore project data from backup"
	@echo ""
	@echo "Testing:"
	@echo "  make test           - Run tests"
	@echo "  make shell-backend  - Open shell in backend container"
	@echo "  make shell-frontend - Open shell in frontend container"
	@echo "  make shell-ollama   - Open shell in Ollama container"
	@echo ""
	@echo "AI Service:"
	@echo "  make ollama-status  - Check Ollama status and models"
	@echo "  make ollama-pull    - Pull/update AI model"
	@echo "  make ollama-logs    - View Ollama logs"
	@echo ""

# Development commands
build:
	docker-compose build

up:
	docker-compose up -d
	@echo "✅ Services started!"
	@echo "Frontend: http://localhost"
	@echo "Backend:  http://localhost:8000"

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

# Production commands
prod-build:
	docker-compose -f docker-compose.prod.yml build

prod-up:
	docker-compose -f docker-compose.prod.yml up -d
	@echo "✅ Production services started!"
	@echo "Frontend: http://localhost"
	@echo "Backend:  http://localhost:8000"

prod-down:
	docker-compose -f docker-compose.prod.yml down

# Maintenance commands
clean:
	docker-compose down -v
	docker system prune -f

prune:
	docker system prune -a -f --volumes

backup:
	@mkdir -p backups
	@tar -czf backups/backup-$$(date +%Y%m%d-%H%M%S).tar.gz backend/project_data
	@echo "✅ Backup created in backups/"

restore:
	@echo "Available backups:"
	@ls -1 backups/
	@echo ""
	@read -p "Enter backup filename: " backup; \
	tar -xzf backups/$$backup -C .
	@echo "✅ Backup restored"

# Testing commands
test:
	docker-compose exec backend pytest

shell-backend:
	docker-compose exec backend bash

shell-frontend:
	docker-compose exec frontend sh

shell-ollama:
	docker-compose exec ollama bash

# AI Service commands
ollama-status:
	@echo "Ollama Status:"
	@docker-compose exec ollama ollama list || echo "❌ Ollama not running"

ollama-pull:
	@echo "Pulling/updating AI model..."
	docker-compose exec ollama ollama pull llama3.2:3b

ollama-logs:
	docker-compose logs -f ollama

# Status
status:
	docker-compose ps

# Health check
health:
	@echo "Checking backend health..."
	@curl -s http://localhost:8000/health | python -m json.tool || echo "❌ Backend unhealthy"
	@echo ""
	@echo "Checking frontend health..."
	@curl -s http://localhost/health || echo "❌ Frontend unhealthy"

# Quick start (build and run)
start: build up
	@echo "✅ Application is running!"
	@echo "Access at: http://localhost"

# Stop and clean
stop: down clean
	@echo "✅ Application stopped and cleaned"

