# Aavegotchi Pet Sitter Bot

Automated Aavegotchi pet sitter bot for Base chain. Monitors and pets Aavegotchis every 12 hours to maintain kinship.

## =� Prerequisites

- Call function `setPetOperatorForAll` using pet operator address and `true` as function arguments here https://basescan.org/address/0x683a56589203b186ea3a0d089665a90f023e9f7a#writeContract
- Node.js 18+
- Wallet with ETH on Base
- Telegram bot (optional, for notifications)

## =' Installation

### Method 1: Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/egornomic/aavegotchi-pet-sitter.git
   cd aavegotchi-pet-sitter
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run with Docker Compose**:
   ```bash
   docker compose up -d
   ```

### Method 2: Direct Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the bot**:
   ```bash
   npm start
   ```

## � Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PRIVATE_KEY` | Private key of wallet that will pet Aavegotchis | `0x123...` |
| `TARGET_ADDRESS` | Address that owns the Aavegotchis | `0xabc...` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) | `123:ABC...` |
| `TELEGRAM_CHAT_ID` | Telegram chat ID (optional) | `-1001...` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_RPC_URL` | Base chain RPC endpoint | `https://mainnet.base.org` |
| `DIAMOND_CONTRACT_ADDRESS` | Aavegotchi contract on Base | `0xA99c4B...` |
| `LOG_LEVEL` | Logging level | `info` |
| `PET_INTERVAL_HOURS` | Hours between pet checks | `12` |

## <� Usage

### Development Mode
```bash
npm run dev        # Run in development mode with hot reload
npm run watch      # Run with file watching
```

### Testing
```bash
npm test           # Test main service functionality
npm run test:interact  # Test single Aavegotchi interaction
npm run test:batch     # Test batch interaction (all Aavegotchis)
```

### Production
```bash
npm run build      # Build for production
npm start          # Start production server
```

## =3 Docker Deployment

### Using Docker Compose (Recommended)
```bash
# Start the service
docker compose up -d

# View logs
docker compose logs -f

# Stop the service
docker compose down
```

### Using Docker directly
```bash
# Build image
docker build -t aavegotchi-pet-sitter .

# Run container
docker run -d --env-file .env --name aavegotchi-bot aavegotchi-pet-sitter
```

## =� Monitoring

### Logs
- **Location**: `./logs/` directory
- **Format**: JSON structured logs
- **Levels**: error, warn, info, debug
- **Rotation**: Automatic log rotation

### Health Checks
- **Docker**: Built-in health check every 30 seconds
- **Status**: Monitor via Docker or container orchestration
- **Alerts**: Telegram notifications for important events

## =� Error Handling

- **Connection Issues**: Automatic retry with exponential backoff
- **Gas Price Spikes**: Dynamic adjustment with safety limits
- **Cooldown Management**: Respects 12-hour Aavegotchi interaction cooldown
- **Transaction Failures**: Detailed logging and optional Telegram alerts

## = Security

- **Private Keys**: Stored in environment variables only
- **No Hardcoded Secrets**: All sensitive data via environment
- **Minimal Permissions**: Bot only needs interaction permissions
- **Docker Security**: Non-root user, minimal base image

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```
