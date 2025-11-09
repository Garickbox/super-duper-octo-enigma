// server.js - Сервер для Telegram Web App с камерой

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['https://web.telegram.org', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// ⚠️ ВАШ ТОКЕН (НЕОБХОДИМО ОТОЗАТЬ И ЗАМЕНИТЬ!)
const BOT_TOKEN = '8344281396:AAGZ9-M2XRyPMHiI2akBSSIN7QAtRGDmLOY';

// Создаем папку для временных файлов
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Функция для отправки фото в Telegram
async function sendPhotoToBot(chatId, photoBuffer, caption = '') {
    try {
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('chat_id', chatId);
        form.append('photo', photoBuffer, {
            filename: `photo-${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });
        form.append('caption', caption || 'Фото из Web App 📸');

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

        if (!user_id) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        if (!photo_data) {
            return res.status(400).json({
                success: false,
                error: 'Photo data is required'
            });
        }

        // Конвертируем base64 в Buffer
        const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

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

// Маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.json({
        status: 'Server is running! 🚀',
        message: 'Telegram Camera Web App Server',
        endpoints: {
            'GET /': 'Информация о сервере',
            'GET /bot-info': 'Информация о боте',
            'POST /api/send-photo': 'Отправка фото'
        },
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
            bot_url: `https://t.me/${response.data.result.username}`
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
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Сервер Telegram Web App с камерой запущен!');
    console.log('='.repeat(50));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📊 Статус: http://localhost:${PORT}/`);
    console.log(`🤖 Инфо о боте: http://localhost:${PORT}/bot-info`);
    console.log('='.repeat(50) + '\n');
});

// Обработка ошибок
process.on('unhandledRejection', (err) => {
    console.error('❌ Необработанное отклонение promise:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Необработанное исключение:', err);
});