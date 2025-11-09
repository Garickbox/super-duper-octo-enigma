const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        user: 'Alexander Gorchakov',
        user_id: 1189539923,
        token: process.env.BOT_TOKEN ? 'SET' : 'MISSING' 
    });
});

// API endpoint for sending photos to Telegram
app.post('/api/send-photo', async (req, res) => {
    try {
        const { user_id, photo_data, caption } = req.body;
        
        console.log('Received photo request for user:', user_id);
        
        // Validation
        if (!user_id || !photo_data) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing user_id or photo_data' 
            });
        }

        // Ensure it's only for your user ID
        if (user_id != 1189539923) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied. Wrong user ID.' 
            });
        }

        // Send photo to Telegram
        const response = await axios.post(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`,
            {
                chat_id: user_id,
                photo: photo_data,
                caption: caption || '📸 Фото с веб-камеры'
            },
            {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Photo sent successfully to user:', user_id);
        
        res.json({ 
            success: true, 
            message_id: response.data.result.message_id,
            message: 'Фото успешно отправлено в Telegram!'
        });
        
    } catch (error) {
        console.error('Error sending photo:', error.response?.data || error.message);
        
        let errorMessage = 'Unknown error occurred';
        
        if (error.response?.data) {
            errorMessage = error.response.data.description || JSON.stringify(error.response.data);
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            success: false, 
            error: errorMessage,
            details: 'Check if BOT_TOKEN is valid and bot is started with /start'
        });
    }
});

// Additional endpoint to check bot status
app.get('/api/bot-status', async (req, res) => {
    try {
        if (!process.env.BOT_TOKEN) {
            return res.json({ 
                status: 'MISSING_TOKEN', 
                message: 'BOT_TOKEN not set' 
            });
        }

        const response = await axios.get(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getMe`
        );

        res.json({ 
            status: 'ACTIVE', 
            bot: response.data.result,
            user: 'Alexander Gorchakov (1189539923)'
        });
    } catch (error) {
        res.json({ 
            status: 'ERROR', 
            error: error.response?.data?.description || error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('=== Telegram Camera Bot Server ===');
    console.log('Server running on port:', PORT);
    console.log('User: Alexander Gorchakov');
    console.log('User ID: 1189539923');
    console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ SET' : '❌ MISSING');
    console.log('Access the app at: https://telegram-camera-bot-production.up.railway.app/');
});