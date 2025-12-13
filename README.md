# USDT Wallet Balance Checker

A simple web application to check USDT balances for both BEP20 (Binance Smart Chain) and TRC20 (Tron) wallet addresses.

## Features

- ✅ Add single wallet address
- ✅ Bulk upload wallet addresses from .txt or .csv files
- ✅ Check USDT balance on BEP20 (BSC) network
- ✅ Check USDT balance on TRC20 (Tron) network
- ✅ Save all wallet addresses in browser storage
- ✅ Export wallet addresses to file
- ✅ View total statistics
- ✅ Delete individual wallets or clear all

## How to Use

1. **Open the website**: Simply open `index.html` in your web browser

2. **Add Wallet Addresses**:
   - **Single Address**: Type a wallet address in the input field and click "Add Address"
   - **Bulk Upload**: Click "Choose File" and select a .txt or .csv file with one address per line

3. **Check Balances**: Click "Check All Balances" to fetch USDT balances for all added wallets

4. **View Results**: The table will show:
   - Wallet address
   - BEP20 USDT balance
   - TRC20 USDT balance
   - Total USDT balance

5. **Export**: Click "Export Addresses" to download all wallet addresses as a text file

## File Format for Bulk Upload

Create a text file (.txt) or CSV file (.csv) with one wallet address per line:

```
0x1234567890123456789012345678901234567890
TXYZabcdefghijklmnopqrstuvwxyz1234567890
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
```

## Supported Networks

- **BEP20**: Binance Smart Chain (BSC) - USDT contract: `0x55d398326f99059fF775485246999027B3197955`
- **TRC20**: Tron Network - USDT contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`

## Notes

- All wallet addresses are saved in your browser's local storage
- The application uses public RPC endpoints (no API keys required)
- Balance checking may take some time for multiple wallets (delays are added to avoid rate limiting)
- Make sure wallet addresses are in the correct format (BEP20 addresses start with 0x, TRC20 addresses start with T)

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge)
