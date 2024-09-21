async function news() {
    try {
        // Fetch the latest news from the static API link
        let response = await fetch('https://apilink-production-534b.up.railway.app/api/news?url=https://www.hirunews.lk/382599/2024');
        let data = await response.json();

        // Format the message to make it more readable
        let mg = `*${data.title}*
●━━━━━━━━━━━━━━━━━━━━━●
\`\`\`${data.desc
    .replace(/වේලාව/g, '\nවේලාව') // Adds line breaks before "වේලාව"
    .replace(/ - /g, '\n - ')         // Adds line breaks before the dash
    .replace(/\s{2,}/g, ' ')          // Removes excess spaces
}\`\`\`
●━━━━━━━━━━━━━━━━━━━━━●
${data.time}

📡 Source - hirunews.lk
   𝙱𝙾𝚃𝙺𝙸𝙽𝙶𝙳𝙾𝙼 

●━━━━━━━━━━━━━━━━━━━━━●`;

        // Check the database for the last sent news
        let newss = await news1.findOne({ id: '123' });

        // If no record is found, save the current news and send it
        if (!newss) {
            await new news1({ id: '123', newsid: data.id, title: data.title, desc: data.desc }).save();
            console.log('New news saved for the first time.');
        } 
        // If the news ID is the same as the previously sent one, skip sending
        else if (newss.newsid == data.id && newss.title == data.title && newss.desc == data.desc) {
            console.log('No significant news update, skipping message.');
            return;
        } 
        // If there's a change in the news content, update and send it
        else {
            await news1.updateOne({ id: '123' }, { newsid: data.id, title: data.title, desc: data.desc });
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
