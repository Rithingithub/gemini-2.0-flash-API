const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const sharp = require('sharp');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let chatHistory = []; // Temporary chat history storage

const GOOGLE_AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_STUDIO_API_KEY}`;

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        const latestMessage = messages[messages.length - 1]?.content;

        if (!latestMessage) {
            return res.status(400).json({ error: 'No message provided' });
        }

        const response = await axios.post(
            GOOGLE_AI_API_URL,
            {
                contents: [{ parts: [{ text: latestMessage }] }]
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const botMessage = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond.";

        // Save chat history
        chatHistory.push({ role: 'user', content: latestMessage });
        chatHistory.push({ role: 'assistant', content: botMessage });

        res.json({ message: botMessage });
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'API request failed',
            details: error.response?.data || error.message
        });
    }
});

app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
    try {
        const messagesJson = req.body.messages || '[]';
        const messages = JSON.parse(messagesJson);
        const latestMessage = messages[messages.length - 1]?.content || '';

        let aiResponse = '';

        if (req.file) {
            console.log(`Received file: ${req.file.originalname} (${req.file.mimetype})`);

            if (req.file.mimetype.startsWith('image/')) {
                const imageBase64 = (await sharp(req.file.buffer).resize(512).toBuffer()).toString('base64');

                const response = await axios.post(
                    GOOGLE_AI_API_URL,
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: latestMessage,
                                    },
                                    {
                                        inlineData: {
                                            mimeType: req.file.mimetype,
                                            data: imageBase64,
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    { headers: { 'Content-Type': 'application/json' } }
                );

                aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't analyze the image.";
            } else {
                aiResponse = "Sorry, I can only process image files at the moment.";
            }
        }
        else if (latestMessage) {
            const response = await axios.post(
                GOOGLE_AI_API_URL,
                {
                    contents: [{ parts: [{ text: latestMessage }] }]
                },
                { headers: { 'Content-Type': 'application/json' } }
            );

            aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond.";
        } else {
            return res.status(400).json({ error: 'No message or file provided' });
        }

        // Save chat history
        chatHistory.push({ role: 'user', content: latestMessage });
        chatHistory.push({ role: 'assistant', content: aiResponse });

        res.json({ message: aiResponse });
    } catch (error) {
        console.error('Error processing request:', error.message);
        res.status(500).json({ error: 'Failed to process the request', details: error.message });
    }
});

app.get('/api/chat', (req, res) => {
    res.json(chatHistory);
});

// Clear chat history
app.delete('/api/chat', (req, res) => {
    chatHistory = [];
    res.json({ message: 'Chat history cleared' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));