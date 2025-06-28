const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Load contacts from JSON file
const CONTACTS_PATH = './contacts.json';
let RECIPIENTS = [];

try {
    const contactsData = fs.readFileSync(CONTACTS_PATH);
    const contacts = JSON.parse(contactsData);
    RECIPIENTS = contacts.map(contact => contact.id);

    console.log(`📞 Loaded ${RECIPIENTS.length} recipients`);
} catch (err) {
    console.error("❌ Error loading contacts:", err.message);
    process.exit(1);
}

// Folder where images are stored
const IMAGE_FOLDER = "./images";

// Show QR Code
client.on('qr', (qr) => {
    console.log('📸 Scan QR Code:');
    qrcode.generate(qr, { small: true });
});

// When ready
client.on('ready', () => {
    console.log('✅ WhatsApp is ready!');
    sendDailyCryptoQuote();
});

// Function to delay between messages
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate quote using local LLM (Ollama + llama3)
async function generateCryptoQuote() {
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama3",
                prompt: "Generate a short, inspirational quote about cryptocurrency or blockchain technology. Keep it under 100 words.",
                stream: false
            })
        });

        const data = await response.json();

        if (data && data.response) {
            const quote = data.response.trim();
            console.log("🧠 Generated Crypto Quote:\n", quote);
            return quote;
        } else {
            throw new Error("Invalid response from Ollama");
        }

    } catch (error) {
        console.warn("⚠️ Using fallback quote — LLM error:", error.message);
        return "Blockchain is the future of finance. Crypto is changing the world.";
    }
}

/**
 * Gets today's image based on date
 */
function getTodaysImage() {
    const files = fs.readdirSync(IMAGE_FOLDER).filter(file =>
        file.toLowerCase().endsWith('.png') ||
        file.toLowerCase().endsWith('.jpg') ||
        file.toLowerCase().endsWith('.jpeg')
    );

    if (files.length === 0) {
        throw new Error("No images found in the folder.");
    }

    // Get today's index
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 0);
    const diff = today - yearStart;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const index = dayOfYear % files.length;

    const imagePath = path.join(IMAGE_FOLDER, files[index]);
    const media = MessageMedia.fromFilePath(imagePath);

    console.log(`🖼️ Selected image for today: ${files[index]}`);
    return { media, filename: files[index], fullPath: imagePath };
}

// Send message function
async function sendDailyCryptoQuote() {
    try {
        const quote = await generateCryptoQuote();

        let todaysImage;
        try {
            todaysImage = getTodaysImage();
            console.log(`🖼️ Sending image: ${todaysImage.filename}`);
        } catch (err) {
            console.error("❌ No image found:", err.message);
            return;
        }

        // Loop through each recipient
        for (let i = 0; i < RECIPIENTS.length; i++) {
            const recipient = RECIPIENTS[i];

            console.log(`📩 Sending to ${recipient}...`);

            const chat = await client.getChatById(recipient);

            // Send image with caption
            const msg = await chat.sendMessage(todaysImage.media, { caption: quote });
            const messageId = msg.id._serialized;
            const sendTime = new Date().toLocaleString();

            console.log(`✅ Image + Quote sent to ${recipient} | Message ID: ${messageId}`);

            // Optional delay between sends
            if (i < RECIPIENTS.length - 1) {
                console.log("⏳ Waiting 10 seconds before next message...");
                await delay(10000); // Wait 10 seconds
            }

            // --- 📬 START: Log delivery status ---
            const logFilePath = 'daily_crypto_quotes_log.txt';
            const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
            logStream.write(`[${sendTime}] 🖼️ Image: ${todaysImage.filename}\nQuote: ${quote}\nRecipient: ${recipient}\n\n`);

            const messageAckHandler = (message, ack) => {
                if (message.id._serialized === messageId) {
                    const statuses = {
                        "-1": "Error",
                        0: "Sent",
                        1: "Delivered",
                        2: "Viewed"
                    };
                    const statusText = statuses[ack] || `Unknown (${ack})`;
                    const ackTime = new Date().toLocaleString();
                    const statusLog = `👉 Status: ${statusText} | Updated: ${ackTime}\n`;

                    console.log(statusLog.trim());
                    logStream.write(statusLog);

                    if (ack === 2 || ack === -1) {
                        logStream.end();
                        client.off('message_ack', messageAckHandler);
                    }
                }
            };

            client.on('message_ack', messageAckHandler);

            setTimeout(() => {
                client.off('message_ack', messageAckHandler);
                logStream.end();
            }, 30000);
            // --- 📬 END: Log delivery status ---
        }

    } catch (err) {
        console.error("❌ Error sending message:", err.message);
    } finally {
        setTimeout(async () => {
            await client.destroy();
        }, 40000);
    }
}

// Start client
client.initialize();