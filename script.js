// USDT Contract Addresses
const BEP20_USDT = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
const TRC20_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // Tron USDT

// API Endpoints
const BSC_API = 'https://api.bscscan.com/api';
const TRON_API = 'https://api.trongrid.io';

// Storage key
const STORAGE_KEY = 'usdt_wallet_addresses';

// Server API URL - auto-detect
// Frontend: https://walletecheck.vercel.app/
// Backend: https://walletecheckserver-production.up.railway.app
const SERVER_API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : window.location.origin.includes('vercel.app') || window.location.origin.includes('walletecheck')
    ? 'https://walletecheckserver-production.up.railway.app'
    : window.location.origin.includes('railway')
    ? window.location.origin
    : window.location.origin;

// Initialize
let wallets = [];
let balanceCheckInterval = null;

// Clean up invalid addresses from wallet list
function cleanupInvalidAddresses() {
    const initialCount = wallets.length;
    wallets = wallets.filter(w => isValidWalletAddress(w.address));
    const removedCount = initialCount - wallets.length;
    
    if (removedCount > 0) {
        saveWallets();
        renderTable();
        updateStats();
        console.log(`Removed ${removedCount} invalid addresses`);
    }
    
    return removedCount;
}

// Load wallets from localStorage on page load
document.addEventListener('DOMContentLoaded', async () => {
    loadWallets();
    // Clean up any invalid addresses that might have been added before
    const removed = cleanupInvalidAddresses();
    if (removed > 0) {
        console.log(`Cleaned up ${removed} invalid address(es) on page load`);
    }
    
    renderTable();
    updateStats();
    
    // Sync with server and add to monitoring (in background, don't wait)
    syncWalletsWithServer().then(() => {
        console.log('✅ Wallets synced with server');
    });
    
    // Start automatic balance checking if we have wallets
    // Wait a bit for DOM to be ready
    setTimeout(() => {
        if (wallets.length > 0) {
            startAutoBalanceCheck();
        } else {
            updateAutoCheckStatus();
        }
    }, 500);
});

// Load wallets from localStorage
function loadWallets() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        wallets = JSON.parse(stored);
    }
}

// Save wallets to localStorage
function saveWallets() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

// Add single wallet address
async function addSingleAddress() {
    const input = document.getElementById('walletAddress');
    const address = input.value.trim();
    
    if (!address) {
        alert('Please enter a wallet address');
        return;
    }

    // Validate address format
    if (!isValidWalletAddress(address)) {
        alert('Invalid wallet address format.\n\nValid formats:\n- BEP20/Ethereum: Starts with 0x, 42 characters\n- TRC20/Tron: Starts with T, 34 characters');
        input.value = '';
        return;
    }

    // Check if address already exists
    if (wallets.find(w => w.address.toLowerCase() === address.toLowerCase())) {
        alert('This address is already added');
        input.value = '';
        return;
    }

    // Determine network
    const network = address.startsWith('0x') ? 'BEP20' : 'TRC20';

    // Add wallet locally
    wallets.push({
        address: address,
        bep20Balance: null,
        trc20Balance: null,
        lastChecked: null
    });

    saveWallets();
    input.value = '';
    renderTable();
    updateStats();

    // Automatically add to server monitoring
    await addToServerMonitoring(address, network);
    
    // Start auto-check if not already running
    if (!balanceCheckInterval && autoCheckEnabled) {
        startAutoBalanceCheck();
    }
}

// Validate wallet address format
function isValidWalletAddress(address) {
    if (!address || typeof address !== 'string') return false;
    
    address = address.trim();
    
    // BEP20/Ethereum address: starts with 0x, 42 characters
    if (address.startsWith('0x') && address.length === 42) {
        // Check if it's valid hex
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    
    // TRC20/Tron address: starts with T, 34 characters
    if (address.startsWith('T') && address.length === 34) {
        // Basic Tron address validation (base58)
        return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    }
    
    return false;
}

// Upload bulk addresses from file
function uploadBulkAddresses() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const content = e.target.result;
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        let added = 0;
        let skipped = 0;
        let isFirstLine = true;

        lines.forEach(line => {
            // Skip empty lines
            if (!line || line.trim().length === 0) return;
            
            // Parse CSV line (handle quoted values, commas)
            let address = null;
            
            // Check if it's a CSV line (contains commas)
            if (line.includes(',')) {
                const parts = line.split(',');
                // Try each column to find a valid address
                for (let part of parts) {
                    const cleaned = part.replace(/["']/g, '').trim();
                    if (isValidWalletAddress(cleaned)) {
                        address = cleaned;
                        break;
                    }
                }
                
                // If first line looks like headers (contains common header words), skip it
                if (isFirstLine && (
                    line.toLowerCase().includes('transaction') ||
                    line.toLowerCase().includes('hash') ||
                    line.toLowerCase().includes('address') ||
                    line.toLowerCase().includes('from') ||
                    line.toLowerCase().includes('to') ||
                    line.toLowerCase().includes('status') ||
                    line.toLowerCase().includes('method') ||
                    line.toLowerCase().includes('block') ||
                    line.toLowerCase().includes('date') ||
                    line.toLowerCase().includes('time') ||
                    line.toLowerCase().includes('amount') ||
                    line.toLowerCase().includes('value') ||
                    line.toLowerCase().includes('fee')
                )) {
                    isFirstLine = false;
                    skipped++;
                    return; // Skip header line
                }
            } else {
                // Single value per line (TXT file or single column)
                address = line.replace(/["',]/g, '').trim();
            }
            
            // Validate address
            if (address && isValidWalletAddress(address)) {
                // Check if already exists
                if (!wallets.find(w => w.address.toLowerCase() === address.toLowerCase())) {
                    wallets.push({
                        address: address,
                        bep20Balance: null,
                        trc20Balance: null,
                        lastChecked: null
                    });
                    added++;
                } else {
                    skipped++;
                }
            } else {
                // Invalid address format
                skipped++;
            }
            
            isFirstLine = false;
        });

        saveWallets();
        renderTable();
        updateStats();
        fileInput.value = '';
        
        alert(`Added ${added} valid wallet addresses. ${skipped} lines were skipped (headers, duplicates, or invalid addresses).`);
        
        // Automatically add all new addresses to server monitoring
        if (added > 0) {
            const newWallets = wallets.slice(-added); // Get the newly added wallets
            for (const wallet of newWallets) {
                const network = wallet.address.startsWith('0x') ? 'BEP20' : 'TRC20';
                await addToServerMonitoring(wallet.address, network);
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            }
            
            // Start auto-check if not already running
            if (!balanceCheckInterval && autoCheckEnabled) {
                startAutoBalanceCheck();
            }
        }
    };

    reader.readAsText(file);
}

// Check BEP20 USDT balance
async function checkBEP20Balance(address) {
    // Use RPC directly (no API key needed)
    return await checkBEP20BalanceRPC(address);
}

// Check BEP20 balance via RPC
async function checkBEP20BalanceRPC(address) {
    try {
        // Using public BSC RPC endpoint
        const rpcUrl = 'https://bsc-dataseed.binance.org/';
        
        // Convert address to proper format (remove 0x if present, pad to 64 chars)
        const addressHex = address.startsWith('0x') ? address.slice(2) : address;
        const paddedAddress = addressHex.toLowerCase().padStart(64, '0');
        
        // ERC20 balanceOf(address) function signature: 0x70a08231
        const data = '0x70a08231' + paddedAddress;
        
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [{
                    to: BEP20_USDT,
                    data: data
                }, 'latest'],
                id: 1
            })
        });

        const result = await response.json();
        
        if (result.result && result.result !== '0x' && result.result !== '0x0') {
            const balance = parseInt(result.result, 16) / 1e18;
            return balance;
        }
        
        return 0;
    } catch (error) {
        console.error('Error checking BEP20 balance via RPC:', error);
        // Try alternative RPC endpoint
        try {
            const altRpcUrl = 'https://bsc-dataseed1.defibit.io/';
            const addressHex = address.startsWith('0x') ? address.slice(2) : address;
            const paddedAddress = addressHex.toLowerCase().padStart(64, '0');
            const data = '0x70a08231' + paddedAddress;
            
            const response = await fetch(altRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_call',
                    params: [{ to: BEP20_USDT, data: data }, 'latest'],
                    id: 1
                })
            });
            
            const result = await response.json();
            if (result.result && result.result !== '0x' && result.result !== '0x0') {
                return parseInt(result.result, 16) / 1e18;
            }
        } catch (e) {
            console.error('Alternative RPC also failed:', e);
        }
        return 0;
    }
}

// Check TRC20 USDT balance
async function checkTRC20Balance(address) {
    // Validate address
    if (!address) {
        return 0;
    }

    // Normalize address (remove spaces)
    address = address.trim();
    
    // If address is clearly a BEP20 address (starts with 0x), skip TRC20 check
    if (address.startsWith('0x') && address.length === 42) {
        return 0;
    }

    console.log('Checking TRC20 balance for:', address);

    try {
        // Method 1: Use TronGrid v1/accounts endpoint (most reliable)
        try {
            const response = await fetch(
                `${TRON_API}/v1/accounts/${address}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    }
                }
            );
            
            if (response.ok) {
                const responseData = await response.json();
                console.log('TronGrid v1/accounts response:', responseData);
                
                // The response has a 'data' array, get the first account
                let account = null;
                if (responseData.data && Array.isArray(responseData.data) && responseData.data.length > 0) {
                    account = responseData.data[0];
                } else if (responseData.address) {
                    // Sometimes it's directly the account object
                    account = responseData;
                }
                
                if (!account) {
                    console.log('No account data found in response');
                } else {
                    console.log('Account data found, checking trc20...');
                    
                    // The trc20 field is an array of objects where each object has contract address as key
                    // Example: [{"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t": "499679815569"}, ...]
                    if (account.trc20 && Array.isArray(account.trc20)) {
                        console.log('Found TRC20 array with', account.trc20.length, 'tokens');
                        
                        // Search for USDT token
                        for (let tokenObj of account.trc20) {
                            // Each tokenObj is like: {"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t": "499679815569"}
                            const contractAddr = Object.keys(tokenObj)[0];
                            const balanceStr = tokenObj[contractAddr];
                            
                            if (contractAddr && contractAddr.toLowerCase() === TRC20_USDT.toLowerCase()) {
                                // Balance is already a string in the smallest unit (sun), USDT has 6 decimals
                                const balance = parseFloat(balanceStr) / 1000000;
                                console.log('Found USDT! Contract:', contractAddr, 'Balance:', balance, 'Raw:', balanceStr);
                                return balance;
                            }
                        }
                        console.log('USDT not found in TRC20 tokens. Available contracts:', 
                            account.trc20.map(t => Object.keys(t)[0]));
                    } else {
                        console.log('No TRC20 array found. Account keys:', Object.keys(account));
                        if (account.trc20) {
                            console.log('trc20 type:', typeof account.trc20, 'value:', account.trc20);
                        }
                    }
                }
            } else {
                const errorText = await response.text();
                console.log('TronGrid v1/accounts failed:', response.status, errorText);
            }
        } catch (e) {
            console.log('TronGrid v1/accounts error:', e);
        }

        // Method 2: Direct contract call using triggerconstantcontract (most reliable)
        try {
            console.log('Trying direct contract call with visible=true...');
            
            // First, convert base58 address to hex for the parameter
            // We need to get the hex representation of the address
            let addressHex = null;
            try {
                const validateRes = await fetch(`${TRON_API}/wallet/validateaddress`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: address })
                });
                if (validateRes.ok) {
                    const validateData = await validateRes.json();
                    addressHex = validateData.address_hex || validateData.hex;
                    console.log('Address hex:', addressHex);
                }
            } catch (e) {
                console.log('Address validation failed:', e);
            }
            
            // Format parameter: 24 zeros (12 bytes) + address hex (20 bytes) = 32 bytes total
            let parameter = '';
            if (addressHex) {
                // Remove 0x prefix if present
                let cleanHex = addressHex.replace(/^0x/, '');
                // Remove 41 prefix (Tron address prefix in hex)
                if (cleanHex.startsWith('41')) {
                    cleanHex = cleanHex.slice(2);
                }
                // Address should be 40 hex chars (20 bytes), pad with zeros to ensure it's 40
                cleanHex = cleanHex.padStart(40, '0');
                // Parameter format: 24 zeros (12 bytes) + address (20 bytes) = 64 hex chars (32 bytes)
                parameter = '000000000000000000000000' + cleanHex;
                console.log('Formatted parameter (64 chars):', parameter, 'Length:', parameter.length);
            } else {
                console.log('Warning: Could not get address hex, contract call may fail');
            }
            
            // Use visible=true to pass Base58 addresses for owner_address and contract_address
            const contractResponse = await fetch(`${TRON_API}/wallet/triggerconstantcontract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    owner_address: address,
                    contract_address: TRC20_USDT,
                    function_selector: 'balanceOf(address)',
                    parameter: parameter,
                    visible: true  // This allows Base58 addresses for owner_address and contract_address
                })
            });
            
            if (contractResponse.ok) {
                const contractData = await contractResponse.json();
                console.log('Contract call response:', contractData);
                
                if (contractData.constant_result && contractData.constant_result[0]) {
                    const hexBalance = contractData.constant_result[0];
                    console.log('Hex balance result:', hexBalance);
                    
                    if (hexBalance && hexBalance !== '0x' && hexBalance !== '0x0') {
                        // Remove 0x prefix if present
                        const cleanHex = hexBalance.startsWith('0x') ? hexBalance.slice(2) : hexBalance;
                        // Remove leading zeros
                        const trimmedHex = cleanHex.replace(/^0+/, '') || '0';
                        const balance = parseInt(trimmedHex, 16) / 1000000; // USDT has 6 decimals
                        console.log('Parsed TRC20 USDT balance:', balance);
                        if (!isNaN(balance)) {
                            return balance;
                        }
                    } else {
                        console.log('Balance is zero or empty');
                        return 0;
                    }
                } else {
                    console.log('No constant_result in response');
                }
            } else {
                const errorText = await contractResponse.text();
                console.log('Contract call failed:', contractResponse.status, errorText);
            }
        } catch (e) {
            console.log('Direct contract call error:', e);
        }

        // Method 3: Try using TronScan public API via CORS proxy (if needed) or direct
        try {
            console.log('Trying TronScan API...');
            // Try direct TronScan API
            const scanUrl = `https://apilist.tronscan.org/api/account?address=${address}`;
            const scanResponse = await fetch(scanUrl, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                },
                mode: 'cors'
            });
            
            if (scanResponse.ok) {
                const scanData = await scanResponse.json();
                console.log('TronScan API response:', scanData);
                
                // TronScan returns trc20token_balances array
                if (scanData.trc20token_balances && Array.isArray(scanData.trc20token_balances)) {
                    for (let token of scanData.trc20token_balances) {
                        const addr = token.token_address || token.contract_address;
                        if (addr && addr.toLowerCase() === TRC20_USDT.toLowerCase()) {
                            const bal = token.balance || '0';
                            const balance = parseFloat(bal) / 1000000;
                            if (!isNaN(balance)) {
                                console.log('Found USDT via TronScan:', balance);
                                return balance;
                            }
                        }
                    }
                }
            } else {
                console.log('TronScan API failed:', scanResponse.status);
            }
        } catch (e) {
            console.log('TronScan API error (may be CORS):', e);
        }

        // Method 4: Try alternative TronGrid endpoint
        try {
            console.log('Trying alternative TronGrid endpoint...');
            const altResponse = await fetch(`${TRON_API}/v1/accounts/${address}/tokens`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (altResponse.ok) {
                const altData = await altResponse.json();
                console.log('Alternative endpoint data:', altData);
                
                let tokens = altData.data || altData.tokens || altData;
                if (!Array.isArray(tokens)) tokens = [];
                
                for (let token of tokens) {
                    const addr = token.token_address || token.contract_address || token.address;
                    if (addr && addr.toLowerCase() === TRC20_USDT.toLowerCase()) {
                        const bal = token.balance || token.balance_str || '0';
                        const balance = parseFloat(bal) / 1000000;
                        if (!isNaN(balance)) {
                            console.log('Found USDT via alternative endpoint:', balance);
                            return balance;
                        }
                    }
                }
            }
        } catch (e) {
            console.log('Alternative endpoint failed:', e);
        }

        // Method 5: Last resort - try with hex addresses (no visible flag)
        try {
            console.log('Trying contract call with hex addresses...');
            // Get hex for both addresses
            let ownerHex = null;
            let contractHex = null;
            
            const ownerValidate = await fetch(`${TRON_API}/wallet/validateaddress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: address })
            });
            if (ownerValidate.ok) {
                const ownerData = await ownerValidate.json();
                ownerHex = ownerData.address_hex || ownerData.hex;
            }
            
            const contractValidate = await fetch(`${TRON_API}/wallet/validateaddress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: TRC20_USDT })
            });
            if (contractValidate.ok) {
                const contractData = await contractValidate.json();
                contractHex = contractData.address_hex || contractData.hex;
            }
            
            if (ownerHex && contractHex) {
                // Format owner address for parameter (remove 41 prefix, pad with zeros)
                let ownerParam = ownerHex.replace(/^0x/, '').replace(/^41/, '').padStart(40, '0');
                ownerParam = '000000000000000000000000' + ownerParam;
                
                const hexResponse = await fetch(`${TRON_API}/wallet/triggerconstantcontract`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        owner_address: ownerHex,
                        contract_address: contractHex,
                        function_selector: 'balanceOf(address)',
                        parameter: ownerParam,
                        visible: false
                    })
                });
                
                if (hexResponse.ok) {
                    const hexData = await hexResponse.json();
                    if (hexData.constant_result && hexData.constant_result[0]) {
                        const hexBal = hexData.constant_result[0].replace(/^0x/, '');
                        const balance = parseInt(hexBal, 16) / 1000000;
                        if (!isNaN(balance)) {
                            console.log('Found USDT via hex method:', balance);
                            return balance;
                        }
                    }
                }
            }
        } catch (e) {
            console.log('Hex method failed:', e);
        }

        console.log('All TRC20 balance check methods failed, returning 0');
        console.log('If you see this, please check the browser console for detailed error messages above');
        return 0;
    } catch (error) {
        console.error('Error checking TRC20 balance:', error);
        return await checkTRC20BalanceRPC(address);
    }
}

// Check TRC20 balance via RPC (fallback)
async function checkTRC20BalanceRPC(address) {
    // First, try to get address in hex format using TronGrid
    try {
        // Convert base58 address to hex using TronGrid
        const hexResponse = await fetch(`${TRON_API}/wallet/validateaddress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address: address
            })
        });

        let addressHex = null;
        if (hexResponse.ok) {
            const hexData = await hexResponse.json();
            if (hexData.address_hex) {
                addressHex = hexData.address_hex;
            }
        }

        // If we have hex address, use it for the contract call
        if (addressHex) {
            // Pad to 64 characters (32 bytes)
            const paddedHex = addressHex.replace('0x', '').padStart(64, '0');
            
            const response = await fetch(`${TRON_API}/wallet/triggerconstantcontract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    owner_address: address,
                    contract_address: TRC20_USDT,
                    function_selector: 'balanceOf(address)',
                    parameter: paddedHex
                })
            });

            if (response.ok) {
                const result = await response.json();
                
                if (result.constant_result && result.constant_result[0]) {
                    const hexBalance = result.constant_result[0];
                    if (hexBalance && hexBalance !== '0x' && hexBalance.length > 2) {
                        // Remove '0x' prefix if present and parse
                        const cleanHex = hexBalance.startsWith('0x') ? hexBalance.slice(2) : hexBalance;
                        const balance = parseInt(cleanHex, 16) / 1e6;
                        if (!isNaN(balance)) {
                            return balance;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.log('RPC method failed, trying alternative APIs...', error);
    }

    // Fallback: Try alternative TronGrid endpoint
    try {
        const altResponse = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (altResponse.ok) {
            const accountData = await altResponse.json();
            if (accountData.trc20 && Array.isArray(accountData.trc20)) {
                const usdtToken = accountData.trc20.find(
                    token => {
                        const addr = token.contract_address || token.token_address;
                        return addr && addr.toLowerCase() === TRC20_USDT.toLowerCase();
                    }
                );
                if (usdtToken) {
                    const balanceStr = usdtToken.balance || usdtToken.balance_str || '0';
                    const balance = parseFloat(balanceStr) / 1e6;
                    if (!isNaN(balance)) {
                        return balance;
                    }
                }
            }
        }
    } catch (e) {
        console.log('Alternative endpoint failed:', e);
    }
    
    // Final fallback: Try TronScan API (if available)
    try {
        // Use a CORS proxy or direct API if available
        const scanResponse = await fetch(`https://apilist.tronscan.org/api/account?address=${address}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (scanResponse.ok) {
            const scanData = await scanResponse.json();
            if (scanData.trc20token_balances && Array.isArray(scanData.trc20token_balances)) {
                const usdtToken = scanData.trc20token_balances.find(
                    token => token.token_address && token.token_address.toLowerCase() === TRC20_USDT.toLowerCase()
                );
                if (usdtToken && usdtToken.balance) {
                    return parseFloat(usdtToken.balance) / 1e6;
                }
            }
        }
    } catch (e) {
        console.log('TronScan API failed:', e);
    }
    
    return 0;
}

// Check all balances
async function checkAllBalances(showLoading = true) {
    if (wallets.length === 0) {
        if (showLoading) {
            alert('No wallets to check. Please add wallet addresses first.');
        }
        return;
    }

    const loading = document.getElementById('loading');
    if (showLoading) {
        loading.classList.remove('hidden');
    }

    try {
        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            
            // Skip invalid addresses
            if (!isValidWalletAddress(wallet.address)) {
                console.log('Skipping invalid address:', wallet.address);
                wallet.bep20Balance = 0;
                wallet.trc20Balance = 0;
                continue;
            }
            
            // Update UI
            renderTable();
            
            // Check BEP20 balance (only for addresses starting with 0x)
            if (wallet.address.startsWith('0x')) {
                wallet.bep20Balance = await checkBEP20Balance(wallet.address);
            } else {
                wallet.bep20Balance = 0;
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check TRC20 balance (only for Tron addresses starting with 'T')
            if (wallet.address.startsWith('T')) {
                wallet.trc20Balance = await checkTRC20Balance(wallet.address);
            } else {
                wallet.trc20Balance = 0;
            }
            
            wallet.lastChecked = new Date().toISOString();
            
            // Update UI after each check
            renderTable();
            updateStats();
            
            // Delay between wallets
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        saveWallets();
        // Don't show alert for auto-checks, only for manual checks
        if (showLoading) {
            alert('All balances checked successfully!');
        }
    } catch (error) {
        console.error('Error checking balances:', error);
        if (showLoading) {
            alert('Error checking balances. Please try again.');
        }
    } finally {
        if (showLoading) {
            loading.classList.add('hidden');
        }
    }
}

// Render wallet table
function renderTable() {
    const tbody = document.getElementById('walletTableBody');
    tbody.innerHTML = '';

    if (wallets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">No wallets added yet. Add a wallet address above.</td></tr>';
        return;
    }

    wallets.forEach((wallet, index) => {
        const row = document.createElement('tr');
        
        const bep20Balance = wallet.bep20Balance !== null 
            ? wallet.bep20Balance.toFixed(2) 
            : '-';
        const trc20Balance = wallet.trc20Balance !== null 
            ? wallet.trc20Balance.toFixed(2) 
            : '-';
        
        const totalBalance = (wallet.bep20Balance || 0) + (wallet.trc20Balance || 0);
        const totalDisplay = (wallet.bep20Balance !== null || wallet.trc20Balance !== null)
            ? totalBalance.toFixed(2)
            : '-';

        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="wallet-address">${wallet.address}</td>
            <td class="balance ${wallet.bep20Balance === 0 || wallet.bep20Balance === null ? 'zero' : ''}">${bep20Balance}</td>
            <td class="balance ${wallet.trc20Balance === 0 || wallet.trc20Balance === null ? 'zero' : ''}">${trc20Balance}</td>
            <td class="balance ${totalBalance === 0 ? 'zero' : ''}">${totalDisplay}</td>
            <td>
                <button class="delete-btn" onclick="deleteWallet(${index})">🗑️ Delete</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Delete wallet
async function deleteWallet(index) {
    if (confirm('Are you sure you want to delete this wallet?')) {
        const wallet = wallets[index];
        const address = wallet.address;
        
        wallets.splice(index, 1);
        saveWallets();
        renderTable();
        updateStats();
        
        // Remove from server monitoring
        await removeFromServerMonitoring(address);
    }
}

// Update statistics
function updateStats() {
    document.getElementById('totalWallets').textContent = wallets.length;
    
    const totalBEP20 = wallets.reduce((sum, w) => sum + (w.bep20Balance || 0), 0);
    const totalTRC20 = wallets.reduce((sum, w) => sum + (w.trc20Balance || 0), 0);
    
    document.getElementById('totalBEP20').textContent = totalBEP20.toFixed(2);
    document.getElementById('totalTRC20').textContent = totalTRC20.toFixed(2);
}

// Clear all wallets
async function clearAll() {
    if (confirm('Are you sure you want to delete all wallets? This cannot be undone.')) {
        // Remove all from server monitoring
        for (const wallet of wallets) {
            await removeFromServerMonitoring(wallet.address);
        }
        
        wallets = [];
        saveWallets();
        renderTable();
        updateStats();
        
        // Stop auto-checking
        stopAutoBalanceCheck();
    }
}

// Export addresses to file
function exportAddresses() {
    if (wallets.length === 0) {
        alert('No wallets to export');
        return;
    }

    const addresses = wallets.map(w => w.address).join('\n');
    const blob = new Blob([addresses], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wallet_addresses.txt';
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== SERVER INTEGRATION FUNCTIONS ====================

// Add wallet to server monitoring
async function addToServerMonitoring(address, network) {
    try {
        const response = await fetch(`${SERVER_API_URL}/api/wallets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, network })
        });

        if (response.ok) {
            console.log(`✅ Added ${address} to server monitoring`);
            // Server will send Telegram notification automatically
        } else {
            const data = await response.json();
            if (data.error && !data.error.includes('already exists')) {
                console.log(`⚠️  Could not add to monitoring: ${data.error}`);
            }
        }
    } catch (error) {
        // Server might not be running, that's okay
        console.log('ℹ️  Server not available, wallet saved locally only');
    }
}

// Remove wallet from server monitoring
async function removeFromServerMonitoring(address) {
    try {
        const response = await fetch(`${SERVER_API_URL}/api/wallets/${address}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log(`✅ Removed ${address} from server monitoring`);
            // Server will send Telegram notification automatically
        }
    } catch (error) {
        console.log('ℹ️  Server not available');
    }
}

// Sync all wallets with server
async function syncWalletsWithServer() {
    if (wallets.length === 0) return;

    console.log('🔄 Syncing wallets with server...');
    let synced = 0;
    let failed = 0;

    for (const wallet of wallets) {
        const network = wallet.address.startsWith('0x') ? 'BEP20' : 'TRC20';
        try {
            await addToServerMonitoring(wallet.address, network);
            synced++;
            // Small delay to avoid overwhelming server
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            failed++;
        }
    }

    if (synced > 0) {
        console.log(`✅ Synced ${synced} wallets with server`);
    }
}

// Start automatic balance checking
function startAutoBalanceCheck() {
    // Stop any existing interval
    if (balanceCheckInterval) {
        clearInterval(balanceCheckInterval);
    }
    
    // Check balances immediately if we have wallets (without loading spinner)
    if (wallets.length > 0) {
        checkAllBalances(false);
    }
    
    // Then check every 30 seconds
    balanceCheckInterval = setInterval(() => {
        if (wallets.length > 0 && autoCheckEnabled) {
            console.log('🔄 Auto-checking balances...');
            checkAllBalances(false); // Don't show loading spinner for auto-checks
        }
    }, 30000); // Every 30 seconds
    
    updateAutoCheckStatus();
}

// Stop automatic balance checking
function stopAutoBalanceCheck() {
    if (balanceCheckInterval) {
        clearInterval(balanceCheckInterval);
        balanceCheckInterval = null;
    }
    updateAutoCheckStatus();
}

// Toggle auto-check
let autoCheckEnabled = true;

function toggleAutoCheck() {
    autoCheckEnabled = !autoCheckEnabled;
    
    if (autoCheckEnabled) {
        startAutoBalanceCheck();
    } else {
        stopAutoBalanceCheck();
    }
    updateAutoCheckStatus();
}

function updateAutoCheckStatus() {
    const statusEl = document.getElementById('autoCheckStatus');
    const btnEl = document.getElementById('autoCheckBtn');
    
    if (statusEl && btnEl) {
        if (autoCheckEnabled && balanceCheckInterval) {
            statusEl.textContent = '🔄 Auto-checking balances every 30 seconds...';
            btnEl.textContent = '⏸️ Pause Auto-Check';
            btnEl.classList.remove('btn-danger');
            btnEl.classList.add('btn-secondary');
        } else {
            statusEl.textContent = '⏸️ Auto-check paused. Click "Check Now" or resume auto-check.';
            btnEl.textContent = '▶️ Resume Auto-Check';
            btnEl.classList.remove('btn-secondary');
            btnEl.classList.add('btn-danger');
        }
    }
}

// Debug function - test TRC20 balance for a single address
// You can call this from browser console: testTRC20('TYourAddressHere')
window.testTRC20 = async function(address) {
    console.log('Testing TRC20 balance for:', address);
    const balance = await checkTRC20Balance(address);
    console.log('Result:', balance);
    return balance;
};
