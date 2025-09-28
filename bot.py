# bot.py

from flask import Flask, request, jsonify
import telegram
import asyncio
import logging
from datetime import datetime

# Flask (web-server) obyektini yaratish
app = Flask(__name__)

# Terminalga loglarni (xabarlarni) chiqarishni sozlash
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


def format_number(num_str):
    """Sonlarni formatlash (1000 -> 1 000)"""
    try:
        # Sonni butun songa o'tkazish, keyin formatlash
        return f"{int(float(num_str)):,}".replace(',', ' ')
    except (ValueError, TypeError):
        return "0"

async def send_new_report_message(bot, group_id, payload):
    """Yangi hisobot uchun xabar formatlash va yuborish"""
    report_id = payload.get('report_id', 'N/A')
    location = payload.get('location', 'Noma\'lum')
    date_str = payload.get('date', '')
    author = payload.get('author', 'Noma\'lum')
    data = payload.get('data', {})
    settings = payload.get('settings', {})

    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        formatted_date = date_obj.strftime('%d-%m-%Y')
    except ValueError:
        formatted_date = date_str

    header = (
        f"🔔 *Yangi Hisobot!* (#{report_id})\n"
        f"📅 *Sana:* {formatted_date}\n"
        f"📍 *Filial:* {location}\n"
        f"👤 *Kiritdi:* {author}\n"
    )

    body_lines = []
    grand_total = 0
    rows = settings.get('rows', [])
    columns = settings.get('columns', [])

    for row_name in rows:
        row_total = sum(float(data.get(f"{row_name}_{col_name}", 0)) for col_name in columns)
        if row_total > 0:
            formatted_row = f"`{row_name}: {format_number(row_total)} so'm`"
            body_lines.append(formatted_row)
        grand_total += row_total
    
    if not body_lines:
        message_text = header + "\n_Ma'lumotlar kiritilmagan._"
    else:
        message_text = header + "\n*Ma'lumotlar xulosasi:*\n" + "\n".join(body_lines) + f"\n\n*Umumiy summa:* `{format_number(grand_total)} so'm`"

    await bot.send_message(chat_id=group_id, text=message_text, parse_mode='Markdown')
    logger.info(f"Yangi hisobot (#{report_id}) guruhga muvaffaqiyatli yuborildi.")


async def send_edited_report_message(bot, group_id, payload):
    """Tahrirlangan hisobot uchun xabar formatlash va yuborish"""
    report_id = payload.get('report_id', 'N/A')
    author = payload.get('author', 'Noma\'lum')
    new_data = payload.get('data', {})
    old_data = payload.get('old_data', {})
    settings = payload.get('settings', {})

    header = (
        f"✍️ *Hisobot Tahrirlandi!* (#{report_id})\n"
        f"👤 *O'zgartirdi:* {author}\n"
    )

    body_lines = []
    old_grand_total = 0
    new_grand_total = 0
    has_changes = False
    rows = settings.get('rows', [])
    columns = settings.get('columns', [])

    for row_name in rows:
        old_row_total = sum(float(old_data.get(f"{row_name}_{col_name}", 0)) for col_name in columns)
        new_row_total = sum(float(new_data.get(f"{row_name}_{col_name}", 0)) for col_name in columns)
        
        old_grand_total += old_row_total
        new_grand_total += new_row_total

        if old_row_total != new_row_total:
            has_changes = True
            body_lines.append(f"`{row_name}:` ~{format_number(old_row_total)} so'm~ ➡️ `{format_number(new_row_total)} so'm` 🟢")
        elif new_row_total > 0:
            # O'zgarmagan, lekin 0 dan katta qatorlarni ham ko'rsatish mumkin
            # body_lines.append(f"`{row_name}:` `{format_number(new_row_total)} so'm` (o'zgarmadi)")
            pass

    if not has_changes and old_grand_total == new_grand_total:
        message_text = header + "\n_Hisobotda qiymat o'zgarishlari bo'lmadi (faqat sana/filial o'zgartirilgan bo'lishi mumkin)._"
    else:
        footer = f"\n*Umumiy summa:* ~{format_number(old_grand_total)} so'm~ ➡️ `{format_number(new_grand_total)} so'm` 📈"
        message_text = header + "\n*O'zgarishlar:*\n" + "\n".join(body_lines) + footer

    await bot.send_message(chat_id=group_id, text=message_text, parse_mode='Markdown')
    logger.info(f"Tahrirlangan hisobot (#{report_id}) haqida xabar guruhga yuborildi.")


# Node.js serveridan so'rovlarni qabul qiladigan asosiy manzil
@app.route('/send-report', methods=['POST'])
def handle_send_report():
    payload = request.json
    logger.info(f"Node.js serveridan to'liq so'rov: {payload}")
    if not payload:
        logger.warning("Bo'sh so'rov keldi.")
        return jsonify({"error": "Ma'lumotlar yuborilmadi"}), 400

    bot_token = payload.get('bot_token')
    group_id = payload.get('group_id')
    report_type = payload.get('type', 'new')

    if not bot_token or not group_id:
        logger.error("So'rovda Bot Token yoki Guruh ID topilmadi!")
        return jsonify({"error": "Bot sozlamalari to'liq emas"}), 400

    try:
        bot = telegram.Bot(token=bot_token)
        if report_type == 'edit':
            asyncio.run(send_edited_report_message(bot, group_id, payload))
        else:
            asyncio.run(send_new_report_message(bot, group_id, payload))
        
        return jsonify({"status": "Xabar yuborish uchun qabul qilindi"}), 202
    except Exception as e:
        logger.error(f"Botni ishga tushirishda yoki xabar yuborishda kutilmagan xatolik: {e}")
        return jsonify({"error": "Ichki server xatoligi"}), 500


if __name__ == '__main__':
    logger.info("Python Telegram Bot serveri http://127.0.0.1:5001 manzilida ishga tushdi." )
    app.run(host='127.0.0.1', port=5001)