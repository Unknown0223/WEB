// utils/telegram.js

const axios = require('axios');
const { dbPromise } = require('../db.js');

const PYTHON_BOT_URL = process.env.PYTHON_BOT_URL || 'http://127.0.0.1:5001/send-report';

/**
 * Tayyorlangan ma'lumotni Python botiga asinxron ravishda yuboradi.
 * @param {object} payload - Yuboriladigan ma'lumot (hisobot detallari ).
 */
async function sendToTelegram(payload) {
    try {
        const db = await dbPromise;
        const tokenSetting = await db.get("SELECT value FROM settings WHERE key = 'telegram_bot_token'");
        const groupIdSetting = await db.get("SELECT value FROM settings WHERE key = 'telegram_group_id'");
        
        // JSON.parse() xatoligini oldini olish uchun tekshiruv
        const token = tokenSetting ? JSON.parse(tokenSetting.value) : null;
        const groupId = groupIdSetting ? JSON.parse(groupIdSetting.value) : null;

        if (!token || !groupId) {
            console.error("Telegram sozlamalari (token yoki guruh ID) to'liq emas. Xabar yuborilmadi.");
            return;
        }

        const fullPayload = { ...payload, bot_token: token, group_id: groupId };
        
        console.log("Python botiga yuborilayotgan ma'lumot:", JSON.stringify(fullPayload));
        
        // Python botiga so'rov yuborish
        const response = await axios.post(PYTHON_BOT_URL, fullPayload);
        console.log(`Python botiga so'rov muvaffaqiyatli jo'natildi. Status: ${response.status}`);

    } catch (error) {
        if (error.response) {
            console.error(`Python botidan xatolik keldi: Status ${error.response.status}, Ma'lumot: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            console.error(`Python botiga ulanib bo'lmadi. So'rov yuborildi, lekin javob kelmadi. URL: ${PYTHON_BOT_URL}`);
        } else {
            console.error("Telegramga yuborish funksiyasida kutilmagan xatolik:", error.message);
        }
    }
}

module.exports = { sendToTelegram };
