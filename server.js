const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
// const path = require('path');
const sharp = require('sharp');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let chatHistory = []; // Temporary chat history storage

const GOOGLE_AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_STUDIO_API_KEY}`;

// Multer storage configuration for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Handle chat messages (POST request)
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

// Handle file uploads (New Upload Endpoint)
app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`Received file: ${req.file.originalname} (${req.file.mimetype})`);

        // Convert image to base64
        const imageBase64 = req.file.mimetype.startsWith('image/')
            ? (await sharp(req.file.buffer).resize(512).toBuffer()).toString('base64')
            : null;

        if (!imageBase64) {
            return res.status(400).json({ error: 'Unsupported file format. Only images are supported.' });
        }

        // Send image to Gemini API
        const response = await axios.post(
            GOOGLE_AI_API_URL,
            {
                contents: [
                    {
                        parts: [
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

        const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't analyze the image.";

        res.json({ message: aiResponse });
    } catch (error) {
        console.error('Error processing image:', error.message);
        res.status(500).json({ error: 'Failed to process the uploaded file' });
    }
});
// Fetch chat history (GET request)
app.get('/api/chat', (req, res) => {
    res.json(chatHistory);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
