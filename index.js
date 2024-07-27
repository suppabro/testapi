const axios = require("axios"); 
const mongoose = require('mongoose'); 
const makeWASocket = require("@whiskeysockets/baileys").default;
const { delay, Browsers, MessageRetryMap, fetchLatestBaileysVersion, WA_DEFAULT_EPHEMERAL, useMultiFileAuthState, makeInMemoryStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');

const UserSchema = new mongoose.Schema({ 
    id: { type: String, required: true, unique: true }, 
    newsid: { type: String }, 
});

const news1 = mongoose.model("news1", UserSchema);

async function XAsena() { 
    try {
        await mongoose.connect('mongodb+srv://supunpc58:MFxsqnn2j4gsBBFt@cluster0.3mosadb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected Successfully!');

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
                        let response = await axios.get('https://apilink-production-534b.up.railway.app/api/latest/');
                        let data = response.data;
                        let mg = `*${data.title}*\n●━━━━━━━━━━━━━━━━━━━━━●\n\`\`\`${data.desc}\`\`\`\n●━━━━━━━━━━━━━━━━━━━━━●\n${data.time}\n\n📡 Source - hirunews.lk\n   𝙱𝙾𝚃𝙺𝙸𝙽𝙶𝙳𝙾𝙼 \n\n●━━━━━━━━━━━━━━━━━━━━━●`;

                        let newss = await news1.findOne({ id: '123' });

                        if (!newss) {
                            await new news1({ id: '123', newsid: data.id, events: 'true' }).save();
                        } else if (newss.newsid == data.id) {
                            console.log('News already sent');
                            return;
                        } else {
                            await news1.updateOne({ id: '123' }, { newsid: data.id, events: 'true' });
                        }

                        console.log('Sending text message to all groups');
                        const groups = await session.groupFetchAllParticipating();
                        const groupIds = Object.keys(groups);
                        for (const id of groupIds) {
                            console.log(`Sending text message to group: ${id}`);
                            await sendMessageWithRetry(session, id, { text: mg });
                        }

                        // Convert text to speech
                        const client = new textToSpeech.TextToSpeechClient();
                        const request = {
                            input: { text: data.desc },
                            voice: { languageCode: 'si-LK', ssmlGender: 'MALE' },
                            audioConfig: { audioEncoding: 'MP3' },
                        };
                        const [response] = await client.synthesizeSpeech(request);
                        const writeFile = util.promisify(fs.writeFile);
                        const audioPath = 'news.mp3';
                        await writeFile(audioPath, response.audioContent, 'binary');
                        console.log('Audio content written to file: news.mp3');

                        console.log('Sending voice message to all groups');
                        for (const id of groupIds) {
                            console.log(`Sending voice message to group: ${id}`);
                            await sendMessageWithRetry(session, id, { audio: { url: audioPath }, mimetype: 'audio/mpeg' });
                        }

                    } catch (err) {
                        console.error('Failed to fetch news:', err);
                    }
                }

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