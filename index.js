const mongoose = require('mongoose');
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
    delay, Browsers, fetchLatestBaileysVersion,
    useMultiFileAuthState, makeInMemoryStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fetch = require("node-fetch");

const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    newsid: { type: String },
});
const news1 = mongoose.model("news1", UserSchema);

async function XAsena() {
    try {
        await mongoose.connect(
            "mongodb+srv://supunpc58:MFxsqnn2WM2oJRHi@cluster0.f6adh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
        );
        console.log("MongoDB Connected!");

        const { state, saveCreds } = await useMultiFileAuthState(__dirname + "/session");
        const store = makeInMemoryStore({
            logger: pino().child({ level: "silent", stream: "store" })
        });

        const { version } = await fetchLatestBaileysVersion();

        const session = makeWASocket({
            logger: pino({ level: "fatal" }),
            browser: Browsers.macOS("Safari"),
            auth: state,
            version,
        });

        store.bind(session.ev);

        session.ev.on("creds.update", saveCreds);

        session.ev.on("connection.update", async (s) => {
            const { connection } = s;

            if (connection === "open") {
                console.log("Connected to WhatsApp ✓");
                startNewsLoop(session);
            }
        });

    } catch (err) {
        console.error("Error:", err);
    }
}

async function sendMessageWithRetry(session, jid, message, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await session.sendMessage(jid, message);
            console.log(`✔ Message sent to ${jid}`);
            return;
        } catch (err) {
            console.error(`Retry ${i + 1} failed:`, err);
            await delay(2000);
        }
    }
}

async function startNewsLoop(session) {
    console.log("📡 Auto News Sender Started!");

    async function sendLatestNews() {
        try {
            let res = await fetch("https://hirunews.vercel.app/api/latest-news");
            let json = await res.json();
            let data = json.Posts[0];

            let textContent = data.content?.[0]?.data || "No description";

            let caption = `📰 *${data.title}*
━━━━━━━━━━━━━━━━━━
${textContent}
━━━━━━━━━━━━━━━━━━
📅 ${data.published}
🔗 ${data.link}

#Esana #එසැන`;

            let last = await news1.findOne({ id: "123" });

            if (!last) {
                await new news1({ id: "123", newsid: data.id }).save();
            } else if (last.newsid == data.id) {
                console.log("⏩ Already Sent");
                return;
            } else {
                await news1.updateOne({ id: "123" }, { newsid: data.id });
            }

            console.log("📤 Sending update to all groups...");

            const groups = await session.groupFetchAllParticipating();
            const groupIds = Object.keys(groups);

            for (const id of groupIds) {
                await sendMessageWithRetry(session, id, {
                    image: { url: data.thumb },
                    caption
                });
            }

        } catch (err) {
            console.error("Fetch Error:", err);
        }
    }

    setInterval(sendLatestNews, 5 * 60 * 1000); // every 5 minutes
    sendLatestNews(); // run immediately
}

XAsena();
