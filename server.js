// server.js - Сервер для Telegram Web App с камерой (версия с тестированием)
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
    origin: ['https://web.telegram.org', 'http://localhost:3000', 'https://telegram-camera-bot-production.up.railway.app'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Токен бота из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN || '8344281396:AAGZ9-M2XRyPMHiI2akBSSIN7QAtRGDmLOY';

// Ваш Telegram User ID для тестирования
const YOUR_USER_ID = 1189539923;

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

// Функция для отправки сообщения
async function sendMessage(chatId, text) {
    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            }
        );
        return response.data;
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error.message);
        throw error;
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

        console.log('📸 Размер фото:', Math.round(imageBuffer.length / 1024) + ' KB');

        // Отправляем фото боту
        const result = await sendPhotoToBot(user_id, imageBuffer, caption);

        console.log('✅ Фото успешно отправлено! Message ID:', result.result.message_id);

        // Отправляем уведомление о успешной отправке
        await sendMessage(user_id, '📸 <b>Фото успешно получено!</b>\n\nСпасибо за использование нашего бота!');

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

// 📧 ТЕСТОВЫЙ МАРШРУТ - отправка тестового сообщения вам
app.get('/test-message', async (req, res) => {
    try {
        const testMessage = '🎉 <b>Тестовое сообщение от вашего бота!</b>\n\n' +
                           'Сервер работает корректно! ✅\n' +
                           'Время: ' + new Date().toLocaleString('ru-RU') + '\n' +
                           'URL: ' + req.headers.host;

        const result = await sendMessage(YOUR_USER_ID, testMessage);

        res.json({
            success: true,
            message: 'Тестовое сообщение отправлено вам в Telegram!',
            result: result
        });
    } catch (error) {
        console.error('❌ Ошибка при тестовой отправке:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 📸 ТЕСТОВЫЙ МАРШРУТ - отправка тестового фото вам
app.get('/test-photo', async (req, res) => {
    try {
        // Создаем простое тестовое изображение
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(400, 300);
        const ctx = canvas.getContext('2d');

        // Рисуем тестовую картинку
        ctx.fillStyle = '#0088cc';
        ctx.fillRect(0, 0, 400, 300);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('Тестовое фото', 100, 100);
        
        ctx.font = '18px Arial';
        ctx.fillText('От сервера Telegram Bot', 80, 140);
        ctx.fillText(new Date().toLocaleString('ru-RU'), 60, 180);
        
        ctx.fillStyle = '#4cc9f0';
        ctx.beginPath();
        ctx.arc(200, 220, 40, 0, Math.PI * 2);
        ctx.fill();

        // Конвертируем в buffer
        const buffer = canvas.toBuffer('image/jpeg');
        
        // Отправляем тестовое фото
        const result = await sendPhotoToBot(YOUR_USER_ID, buffer, '📸 Тестовое фото от сервера!\n\nСервер работает корректно! ✅');

        res.json({
            success: true,
            message: 'Тестовое фото отправлено вам в Telegram!',
            result: result
        });

    } catch (error) {
        console.error('❌ Ошибка при тестовой отправке фото:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🔧 ТЕСТОВЫЙ МАРШРУТ - проверка бота и отправки
app.get('/test-all', async (req, res) => {
    try {
        const testResults = [];

        // 1. Проверка информации о боте
        const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        testResults.push({ test: 'Bot Info', status: '✅', data: botInfo.data.result });

        // 2. Отправка тестового сообщения
        const messageResult = await sendMessage(YOUR_USER_ID, 
            '🧪 <b>Тест всех функций бота</b>\n\n' +
            'Сообщение отправлено успешно! ✅\n' +
            'Сервер: ' + req.headers.host
        );
        testResults.push({ test: 'Send Message', status: '✅', data: 'Сообщение отправлено' });

        // 3. Отправка тестового фото
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(300, 200);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#4cc9f0';
        ctx.fillRect(0, 0, 300, 200);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText('Тест фото ✅', 80, 100);
        
        const photoBuffer = canvas.toBuffer('image/jpeg');
        const photoResult = await sendPhotoToBot(YOUR_USER_ID, photoBuffer, '📸 Тестовое фото\n\nВсе системы работают!');
        testResults.push({ test: 'Send Photo', status: '✅', data: 'Фото отправлено' });

        res.json({
            success: true,
            message: 'Все тесты пройдены успешно!',
            tests: testResults,
            your_user_id: YOUR_USER_ID,
            server_time: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Ошибка при выполнении тестов:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message,
            your_user_id: YOUR_USER_ID
        });
    }
});

// Маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.json({
        status: 'Server is running! 🚀',
        message: 'Telegram Camera Web App Server - Deployed on Railway',
        endpoints: {
            'GET /': 'Информация о сервере',
            'GET /bot-info': 'Информация о боте',
            'POST /api/send-photo': 'Отправка фото',
            'GET /test-message': 'Тест отправки сообщения',
            'GET /test-photo': 'Тест отправки фото',
            'GET /test-all': 'Полный тест всех функций'
        },
        your_user_id: YOUR_USER_ID,
        deploy_url: 'https://telegram-camera-bot-production.up.railway.app',
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
            your_user_id: YOUR_USER_ID,
            server: 'Railway'
        });
    } catch (error) {
        console.error('❌ Ошибка при проверке бота:', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            error: 'Не удалось получить информацию о боте',
            details: error.response?.data?.description || error.message,
            your_user_id: YOUR_USER_ID
        });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 СЕРВЕР ЗАПУЩЕН С ТЕСТОВЫМИ ФУНКЦИЯМИ!');
    console.log('='.repeat(60));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 URL: https://telegram-camera-bot-production.up.railway.app`);
    console.log(`👤 Ваш User ID: ${YOUR_USER_ID}`);
    console.log(`🤖 Токен настроен: ${!!process.env.BOT_TOKEN}`);
    console.log('='.repeat(60));
    console.log('📧 Тестовые маршруты:');
    console.log('   /test-message - отправит вам тестовое сообщение');
    console.log('   /test-photo   - отправит вам тестовое фото');
    console.log('   /test-all     - полный тест всех функций');
    console.log('='.repeat(60));
});

// Обработка ошибок
process.on('unhandledRejection', (err) => {
    console.error('❌ Необработанное отклонение promise:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Необработанное исключение:', err);
    process.exit(1);
});