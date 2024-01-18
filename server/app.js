import express from 'express';
import { google } from 'googleapis';

const app = express();
const port = 3000;

const oauth2Client = new google.auth.OAuth2(
    'your-client-id',
    'your-client-secret',
    'http://localhost:3000/auth/google/callback'
);

app.get('/authenticate', async (req, res) => {

    const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.labels",
        "https://mail.google.com/",
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
    });

    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const label = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
            name: 'vacation'
        }
    });

    // Fetch the emails every 45 to 120 seconds
    setInterval(async () => {
        const response = await gmail.users.messages.list({ userId: 'me' });

        for (let message of response.data.messages) {
            const email = await gmail.users.messages.get({ userId: 'me', id: message.id });

            // Check if the email is replied
            const isReplied = email.data.payload.headers.some(header => header.name === 'In-Reply-To');

            if (!isReplied) {
                // Send a reply
                await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: {
                        raw: Buffer.from(
                            `To: ${email.data.payload.headers.find(header => header.name === 'From').value}\r\n` +
                            `Subject: Re: ${email.data.payload.headers.find(header => header.name === 'Subject').value}\r\n` +
                            '\r\n' +
                            'I\'ll get back to you after a week'
                        ).toString('base64')
                    }
                });

                // Add the email to the new label
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: message.id,
                    requestBody: {
                        addLabelIds: [label.data.id]
                    }
                });
            }
        }
    }, Math.random() * (120 - 45) + 45 * 1000);

    res.send('OK');
})

app.listen(port, () => {
    console.log("Server running on port " + port);
})