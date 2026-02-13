# Deployment Guide for WizQueue

## Clone Repository on Deployment Server

### 1. SSH into your Ubuntu server

```bash
ssh user@your-server-ip
```

### 2. Install prerequisites (if not already installed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose -y

# Log out and back in for docker group to take effect
```

### 3. Clone the repository

```bash
# Using HTTPS
git clone https://github.com/JdCpuWiz/wizqueue.git
cd wizqueue

# OR using SSH (if you have SSH keys set up)
git clone git@github.com:JdCpuWiz/wizqueue.git
cd wizqueue
```

### 4. Configure environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env
```

Set these variables:
```bash
# Database (your external PostgreSQL server)
DATABASE_HOST=your-postgres-server-ip
DATABASE_PORT=5432
DATABASE_NAME=wizqueue
DATABASE_USER=wizqueue_user
DATABASE_PASSWORD=your-secure-password

# Ollama (will run in Docker)
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llava:latest

# Application
NODE_ENV=production
VITE_API_URL=http://your-server-ip/api
```

### 5. Set up PostgreSQL database

On your PostgreSQL server:

```sql
CREATE DATABASE wizqueue;
CREATE USER wizqueue_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE wizqueue TO wizqueue_user;
```

Then run migrations from the deployment server:

```bash
# Install Node.js temporarily for migrations
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Run migrations
npm install
npm run migrate
```

### 6. Start services with Docker Compose

```bash
# Start all services
docker-compose up -d

# Pull Ollama model (first time only)
docker exec -it wizqueue-ollama ollama pull llava

# Check status
docker-compose ps
```

### 7. Verify deployment

```bash
# Check health endpoint
curl http://localhost/health

# View logs
docker-compose logs -f
```

### 8. Configure firewall

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Updates and Maintenance

### Pull latest changes

```bash
cd ~/wizqueue
git pull
docker-compose build
docker-compose up -d
```

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ollama
```

### Restart services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Backup database

```bash
# From deployment server
pg_dump -h your-postgres-server -U wizqueue_user wizqueue > backup-$(date +%Y%m%d).sql
```

### Backup uploads

```bash
docker run --rm -v wizqueue_uploads:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup-$(date +%Y%m%d).tar.gz /data
```

## SSL/HTTPS Setup (Recommended for Production)

### Using Let's Encrypt with Certbot

1. **Install Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx -y
```

2. **Stop current containers:**
```bash
docker-compose down
```

3. **Update docker-compose.yml to expose ports 443:**
```yaml
frontend:
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

4. **Update nginx.conf for SSL:**
Add to `infrastructure/docker/nginx.conf`:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # ... rest of your config
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

5. **Get SSL certificate:**
```bash
sudo certbot certonly --standalone -d your-domain.com
```

6. **Restart services:**
```bash
docker-compose up -d
```

7. **Auto-renewal:**
```bash
sudo certbot renew --dry-run
```

## Monitoring

### Check resource usage

```bash
docker stats
```

### Check disk space

```bash
df -h
docker system df
```

### Clean up Docker resources

```bash
# Remove unused containers, networks, images
docker system prune -a
```

## Troubleshooting

### Can't connect to database
```bash
# Test connectivity
nc -zv your-postgres-server 5432

# Check environment variables
docker exec wizqueue-backend env | grep DATABASE
```

### Ollama not working
```bash
# Check Ollama status
docker exec -it wizqueue-ollama ollama list

# Check logs
docker logs wizqueue-ollama

# Repull model
docker exec -it wizqueue-ollama ollama pull llava
```

### High memory usage
```bash
# Check container memory
docker stats

# Restart Ollama with memory limit
docker-compose down
# Edit docker-compose.yml to add memory limits
docker-compose up -d
```

## Repository Management

### Current repository
- **URL:** https://github.com/JdCpuWiz/wizqueue
- **Clone (HTTPS):** `git clone https://github.com/JdCpuWiz/wizqueue.git`
- **Clone (SSH):** `git clone git@github.com:JdCpuWiz/wizqueue.git`

### Syncing changes

After making changes locally:
```bash
git add .
git commit -m "Your commit message"
git push origin master
```

On deployment server:
```bash
cd ~/wizqueue
git pull
docker-compose build
docker-compose up -d
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/JdCpuWiz/wizqueue/issues
- Documentation: See README.md and other docs in the repo
