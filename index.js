const axios = require("axios"); 
const mongoose = require('mongoose'); 
const CryptoJS = require("crypto-js"); 
const makeWASocket = require("@whiskeysockets/baileys").default;
const { delay, Browsers, MessageRetryMap, fetchLatestBaileysVersion, WA_DEFAULT_EPHEMERAL, useMultiFileAuthState, makeInMemoryStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const request = require('@cypress/request');

const UserSchema = new mongoose.Schema({ 
    id: { type: String, required: true, unique: true }, 
    newsid: { type: String }, 
});

const news1 = mongoose.model("news1", UserSchema);

async function XAsena() { 
    try {
        await mongoose.connect('mongodb+srv://supunpc58:MFxsqnn2j4gsBBFt@cluster0.3mosadb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected Success!');

        const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/session');
        const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        const session = makeWASocket({
            logger: pino({ level: 'fatal' }),
            printQRInTerminal: true,
            browser: ['Jithula', 'safari', '1.0.0'],
            fireInitQueries: false,
            shouldSyncHistoryMessage: false,
            downloadHistory: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            auth: state,
            version: version,
            getMessage: async key => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id, undefined);
                    return msg.message || undefined;
                }
                return {
                    conversation: 'An Error Occurred, Repeat Command!'
                };
            }
        });

        store.bind(session.ev);

        session.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;
            if (connection === "open") {
                console.log('Connection opened, starting news fetch loop');
                
                async function news() {
                    try {
                        // Fetch the latest news from the static API link
                        let response = await fetch('https://apilink-production-534b.up.railway.app/api/news?url=https://www.hirunews.lk/382599/2024');
                        let data = await response.json();
                        
                        let mg = `*${data.title}*
●━━━━━━━━━━━━━━━━━━━━━●
\`\`\`${data.desc}\`\`\`
●━━━━━━━━━━━━━━━━━━━━━●
${data.time}

📡 Source - hirunews.lk
   𝙱𝙾𝚃𝙺𝙸𝙽𝙶𝙳𝙾𝙼 

●━━━━━━━━━━━━━━━━━━━━━●`;

                        // Check the database for the last sent news
                        let newss = await news1.findOne({ id: '123' });

                        // If no record is found, save the current news and send it
                        if (!newss) {
                            await new news1({ id: '123', newsid: data.id }).save();
                            console.log('New news saved for the first time.');
                        } 
                        // If the news ID is the same as the previously sent one, skip sending
                        else if (newss.newsid == data.id) {
                            console.log('News already sent, no new updates.');
                            return;
                        } 
                        // If the news ID is different, update the database and send the news
                        else {
                            await news1.updateOne({ id: '123' }, { newsid: data.id });
                            console.log('News updated and saved.');
                        }

                        // Send the news to all groups
                        console.log('Sending message to all groups');
                        const groups = await session.groupFetchAllParticipating();
                        const groupIds = Object.keys(groups);
                        for (const id of groupIds) {
                            console.log(`Sending message to group: ${id}`);
                            await sendMessageWithRetry(session, id, { image: { url: data.image }, caption: mg });
                        }

                    } catch (err) {
                        console.error('Failed to fetch news:', err);
                    }
                }

                // Fetch news every 10 seconds
                setInterval(news, 10000);
            }
            if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                console.log('Connection closed, reconnecting...');
                XAsena();
            }
        });

        session.ev.on('creds.update', saveCreds);

        session.ev.on("messages.upsert", () => {});

    } catch (err) {
        console.error('An error occurred:', err);
    }
}

async function sendMessageWithRetry(session, jid, message, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await session.sendMessage(jid, message, { ephemeralExpiration: WA_DEFAULT_EPHEMERAL });
            console.log('Message sent successfully');
            return;
        } catch (err) {
            console.error(`Failed to send message on attempt ${i + 1}:`, err);
            if (i === retries - 1) {
                console.error('Max retries reached, giving up');
            } else {
                console.log('Retrying...');
            }
        }
    }
}

XAsena();
