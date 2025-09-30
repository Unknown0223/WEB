from flask import Flask, request, jsonify
import telegram
import asyncio
import logging
from datetime import datetime
# O'ZGARTIRILDI: Kutubxonaning zamonaviy versiyalari uchun to'g'ri import yo'li
from telegram.helpers import escape_markdown

app = Flask(__name__)

# Loglashni sozlash (xatoliklarni oson topish uchun)
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def escape_markdown_v2(text: str) -> str:
    """MarkdownV2 uchun maxsus belgilarni to'g'ri ekranlash."""
    # Matn bo'sh emasligiga ishonch hosil qilamiz
    if not text:
        return ""
    # Avval # belgisini escape qilamiz, keyin qolgan maxsus belgilarni
    escaped = str(text).replace('_', '\\_').replace('*', '\\*').replace('[', '\\[').replace('`', '\\`')
    escaped = escaped.replace('#', '\\#').replace('+', '\\+').replace('-', '\\-').replace('=', '\\=')
    escaped = escaped.replace('|', '\\|').replace('{', '\\{').replace('}', '\\}').replace('.', '\\.')
    escaped = escaped.replace('!', '\\!').replace('(', '\\(').replace(')', '\\)')
    return escaped

def format_number(num_str: str) -> str:
    """Sonlarni chiroyli formatlash (masalan, 1000 -> 1 000)."""
    try:
        # Sonni float orqali o'qib, keyin int ga o'tkazib, formatlaymiz
        return f"{int(float(num_str)):,}".replace(',', ' ')
    except (ValueError, TypeError):
        # Agar qiymat son bo'lmasa yoki bo'sh bo'lsa, "0" qaytaramiz
        return "0"

def calculate_totals(data: dict, settings: dict) -> tuple[dict, float]:
    """Ma'lumotlar asosida qatorlar va umumiy summa xulosasini hisoblaydi."""
    rows = settings.get('rows', [])
    columns = settings.get('columns', [])
    row_totals = {}
    grand_total = 0.0
    
    # Har bir qator uchun umumiy summani hisoblash
    for row_name in rows:
        row_total = sum(float(data.get(f"{row_name}_{col_name}", 0)) for col_name in columns)
        # Faqat qiymati 0 dan katta bo'lgan qatorlarni natijaga qo'shamiz
        if row_total > 0:
            row_totals[row_name] = row_total
        grand_total += row_total
        
    return row_totals, grand_total

async def format_and_send_report(bot: telegram.Bot, group_id: str, payload: dict):
    """Yangi yoki tahrirlangan hisobot uchun xabar formatlaydi va yuboradi."""
    report_type = payload.get('type', 'new')
    report_id = str(payload.get('report_id', 'N/A'))
    author = payload.get('author', 'Noma\'lum')
    settings = payload.get('settings', {})
    
    message_text = ""
    
    # Hisobot ID'sini alohida ekranlab olamiz, chunki u sarlavhada ishlatiladi
    escaped_report_id = escape_markdown_v2(report_id)

    if report_type == 'new':
        location = payload.get('location', 'Noma\'lum')
        date_str = payload.get('date', '')
        data = payload.get('data', {})
        
        try:
            # Sanani 'dd-mm-yyyy' formatiga o'tkazish
            formatted_date = datetime.strptime(date_str, '%Y-%m-%d').strftime('%d-%m-%Y')
        except ValueError:
            formatted_date = date_str

        # Xabar sarlavhasi. Barcha maxsus belgilarni to'g'ri ekranlaymiz
        header = (
            f"🔔 *Yangi Hisobot \\#{escaped_report_id}*\n\n"
            f"📅 *Sana\\:* {escape_markdown_v2(formatted_date)}\n"
            f"📍 *Filial\\:* {escape_markdown_v2(location)}\n"
            f"👤 *Kiritdi\\:* {escape_markdown_v2(author)}\n"
            f"\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\n"
        )

        row_totals, grand_total = calculate_totals(data, settings)

        if not row_totals:
            body = "\n_Ma'lumotlar kiritilmagan\\._"
            footer = ""
        else:
            # Qatorlarni alifbo tartibida saralash
            body_lines = [
                f"`{escape_markdown_v2(name)}\\:` *{escape_markdown_v2(format_number(total))} so'm*"
                for name, total in sorted(row_totals.items())
            ]
            body = "\n" + "\n".join(body_lines)
            footer = (
                f"\n{escape_markdown_v2('---------------------------------')}\n"
                f"💰 *JAMI\\:* `{escape_markdown_v2(format_number(grand_total))} so'm`"
            )
        
        message_text = header + body + footer
        log_message = f"Yangi hisobot (#{report_id}) guruhga yuborildi."

    elif report_type == 'edit':
        new_data = payload.get('data', {})
        old_data = payload.get('old_data', {})

        header = (
            f"✍️ *Hisobot Tahrirlandi \\#{escaped_report_id}*\n\n"
            f"👤 *O'zgartirdi\\:* {escape_markdown_v2(author)}\n"
            f"\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\n"
        )

        old_row_totals, old_grand_total = calculate_totals(old_data, settings)
        new_row_totals, new_grand_total = calculate_totals(new_data, settings)
        
        # Eski va yangi ma'lumotlardagi barcha qator nomlarini yig'ib olish
        all_row_names = sorted(list(set(old_row_totals.keys()) | set(new_row_totals.keys())))
        body_lines = []
        has_changes = False

        for name in all_row_names:
            old_total = old_row_totals.get(name, 0)
            new_total = new_row_totals.get(name, 0)
            if old_total != new_total:
                has_changes = True
                body_lines.append(
                    f"`{escape_markdown_v2(name)}\\:` ~{escape_markdown_v2(format_number(old_total))}~ ➡️ *{escape_markdown_v2(format_number(new_total))}* so'm"
                )

        if not has_changes and old_grand_total == new_grand_total:
            body = "\n_Hisobotda qiymat o'zgarishlari bo'lmadi\._"
            footer = ""
        else:
            body = "\n*O'zgarishlar\\:*\n" + "\n".join(body_lines)
            footer = (
                f"\n{escape_markdown_v2('---------------------------------')}\n"
                f"💰 *JAMI\\:* ~{escape_markdown_v2(format_number(old_grand_total))}~ ➡️ `{escape_markdown_v2(format_number(new_grand_total))} so'm`"
            )
            
        message_text = header + body + footer
        log_message = f"Tahrirlangan hisobot (#{report_id}) haqida xabar guruhga yuborildi."
    else:
        logger.warning(f"Noma'lum report_type keldi: {report_type}")
        return

    if message_text:
        await bot.send_message(
            chat_id=group_id, 
            text=message_text, 
            parse_mode='MarkdownV2'
        )
        logger.info(log_message)

@app.route('/send-report', methods=['POST'])
def handle_send_report():
    payload = request.json
    logger.info(f"Node.js serveridan kelgan to'liq so'rov: {payload}")
    
    if not payload:
        logger.warning("Bo'sh so'rov (payload) keldi.")
        return jsonify({"error": "Ma'lumotlar yuborilmadi"}), 400

    bot_token = payload.get('bot_token')
    group_id = payload.get('group_id')

    if not bot_token or not group_id:
        logger.error("So'rovda Bot Token yoki Guruh ID topilmadi!")
        return jsonify({"error": "Bot sozlamalari to'liq emas"}), 400

    try:
        bot = telegram.Bot(token=bot_token)
        # Asinxron funksiyani xavfsiz ishga tushirish
        asyncio.run(format_and_send_report(bot, group_id, payload))
        return jsonify({"status": "Xabar yuborish uchun muvaffaqiyatli qabul qilindi"}), 202
    except Exception as e:
        # Xatolik haqida to'liq ma'lumotni log faylga yozish
        logger.error(f"Botni ishga tushirishda yoki xabar yuborishda kutilmagan xatolik: {e}", exc_info=True)
        return jsonify({"error": f"Ichki server xatoligi: {str(e)}"}), 500

if __name__ == '__main__':
    # Server ishga tushganligi haqida log
    logger.info("Python Telegram Bot serveri http://127.0.0.1:5001 manzilida ishga tushdi." )
    # Barcha IP manzillardan so'rovlarni qabul qilish uchun host='0.0.0.0'
    app.run(host='0.0.0.0', port=5001)
