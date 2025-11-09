// server.js - Сервер для Telegram Web App с камерой (версия для Render.com)

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['https://web.telegram.org', 'http://localhost:3000', 'https://your-app.onrender.com'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Токен бота из переменных окружения Render
const BOT_TOKEN = process.env.BOT_TOKEN || '8344281396:AAGZ9-M2XRyPMHiI2akBSSIN7QAtRGDmLOY';

// Функция для отправки фото в Telegram
async function sendPhotoToBot(chatId, photoBuffer, caption = '') {
    try {
        const form = new FormData();
        
        form.append('chat_id', chatId);
        form.append('photo', photoBuffer, {
            filename: `photo-${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });
        
        if (caption) {
            form.append('caption', caption);
        }

        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error('❌ Ошибка отправки фото:', error.response?.data || error.message);
        throw new Error(error.response?.data?.description || 'Ошибка отправки фото в Telegram');
    }
}

// Маршрут для отправки фото
app.post('/api/send-photo', async (req, res) => {
    try {
        const { user_id, photo_data, caption } = req.body;

        console.log('📨 Получен запрос на отправку фото от пользователя:', user_id);

        if (!user_id || !photo_data) {
            return res.status(400).json({
                success: false,
                error: 'User ID and photo data are required'
            });
        }

        // Конвертируем base64 в Buffer
        const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        console.log('📸 Размер фото:', Math.round(imageBuffer.length / 1024) + ' KB');

        // Отправляем фото боту
        const result = await sendPhotoToBot(user_id, imageBuffer, caption);

        console.log('✅ Фото успешно отправлено! Message ID:', result.result.message_id);

        res.json({
            success: true,
            message: 'Фото успешно отправлено! 📸',
            message_id: result.result.message_id,
            chat_id: result.result.chat.id
        });

    } catch (error) {
        console.error('❌ Ошибка при обработке запроса:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Ошибка при отправке фото'
        });
    }
});

// Статические файлы
app.use(express.static('public'));

// Маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.json({
        status: 'Server is running! 🚀',
        message: 'Telegram Camera Web App Server - Deployed on Render',
        endpoints: {
            'GET /': 'Информация о сервере',
            'GET /bot-info': 'Информация о боте',
            'POST /api/send-photo': 'Отправка фото',
            'GET /camera-app.html': 'Web App интерфейс'
        },
        deploy_url: 'https://your-app.onrender.com',
        timestamp: new Date().toISOString()
    });
});

// Маршрут для проверки бота
app.get('/bot-info', async (req, res) => {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        
        res.json({
            success: true,
            bot: response.data.result,
            bot_url: `https://t.me/${response.data.result.username}`,
            server: 'Render.com'
        });
    } catch (error) {
        console.error('❌ Ошибка при проверке бота:', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            error: 'Не удалось получить информацию о боте',
            details: error.response?.data?.description || error.message
        });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 СЕРВЕР ЗАПУЩЕН НА RENDER.COM!');
    console.log('='.repeat(60));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 URL: https://your-app.onrender.com`);
    console.log(`🤖 Токен настроен: ${!!process.env.BOT_TOKEN}`);
    console.log('='.repeat(60));
});

// Обработка ошибок
process.on('unhandledRejection', (err) => {
    console.error('❌ Необработанное отклонение promise:', err);
});