# Configuration Variables - Raw Edit Form

## Server Environment Variables (.env file)
**Location:** `/server/.env`

```env
# Server Configuration
PORT=3000

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=7858975651:AAG42pb1b-2ljV3jwzMqs7iZuVE5QSALJec
TELEGRAM_CHAT_ID=8191508290

# BSC (BEP20) Configuration
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_USDT_CONTRACT=0x55d398326f99059fF775485246999027B3197955

# Tron (TRC20) Configuration
TRON_API_URL=https://api.trongrid.io
TRC20_USDT_CONTRACT=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

# Monitoring Configuration
CHECK_INTERVAL=10000
```

---

## Client-Side Variables (script.js)
**Location:** `/script.js`

### Contract Addresses
```javascript
const BEP20_USDT = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
const TRC20_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // Tron USDT
```

### API Endpoints
```javascript
const BSC_API = 'https://api.bscscan.com/api';
const TRON_API = 'https://api.trongrid.io';
```

### Storage & Server
```javascript
const STORAGE_KEY = 'usdt_wallet_addresses';
const SERVER_API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : window.location.origin.includes('railway')
    ? window.location.origin
    : window.location.origin;
```

### Frontend & Backend URLs
**Frontend (Vercel):** `https://walletecheck.vercel.app/`
**Backend (Railway):** `https://walletecheckserver-production.up.railway.app`

The SERVER_API_URL automatically detects:
- `localhost` → Uses `http://localhost:3000`
- `vercel.app` or `walletecheck` in URL → Uses Railway backend URL
- `railway` in URL → Uses `window.location.origin` (Railway domain)
- Other domains → Uses `window.location.origin`

### CORS Configuration
The server is configured to allow requests from:
- `https://walletecheck.vercel.app` (Vercel frontend)
- `http://localhost:3000` (local development)
- `http://localhost:5500` (local development)
- `http://127.0.0.1:5500` (local development)

### Auto-Check Interval
**Location:** In `startAutoBalanceCheck()` function
```javascript
// Current: 30000 milliseconds (30 seconds)
setInterval(() => { ... }, 30000);
```

---

## Server-Side Variables (server.js)
**Location:** `/server/server.js`

### Configuration (Lines 14-23)
```javascript
const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const TRON_API_URL = process.env.TRON_API_URL || 'https://api.trongrid.io';
const BEP20_USDT = process.env.BSC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const TRC20_USDT = process.env.TRC20_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 10000; // 10 seconds
```

---

## Quick Reference - All Variables

### Telegram Configuration
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `TELEGRAM_CHAT_ID` - Your Telegram chat ID

### Network Configuration
- `BSC_RPC_URL` - BSC RPC endpoint (default: `https://bsc-dataseed.binance.org/`)
- `TRON_API_URL` - Tron API endpoint (default: `https://api.trongrid.io`)
- `BEP20_USDT` / `BSC_USDT_CONTRACT` - BEP20 USDT contract address
- `TRC20_USDT` / `TRC20_USDT_CONTRACT` - TRC20 USDT contract address

### Timing Configuration
- `CHECK_INTERVAL` - Server monitoring interval in milliseconds (default: 10000 = 10 seconds)
- Client auto-check interval: 30000 milliseconds (30 seconds) - hardcoded in `script.js`

### Server Configuration
- `PORT` - Server port (default: 3000, Railway sets this automatically)

---

## How to Edit

### Server Variables (.env)
Edit `/server/.env` file directly, then restart the server.

### Client Variables (script.js)
Edit `/script.js` file directly. Changes take effect after page refresh.

### Server Code Variables (server.js)
Edit `/server/server.js` file directly, then restart the server.
