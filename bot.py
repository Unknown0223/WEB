# bot.py

from flask import Flask, request, jsonify
import telegram
import asyncio
import logging
from datetime import datetime

app = Flask(__name__)

# Loglashni sozlash
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def escape_markdown_v2(text: str) -> str:
    """MarkdownV2 uchun maxsus belgilarni to'g'ri ekranlash."""
    if not text:
        return ""
    # Telegram tomonidan tavsiya etilgan tartib
    escape_chars = r'_*[]()~`>#+-=|{}.!'
    return "".join(f'\\{char}' if char in escape_chars else char for char in str(text))

def format_number(num_str: str) -> str:
    """Sonlarni chiroyli formatlash (masalan, 1000 -> 1 000)."""
    try:
        return f"{int(float(num_str)):,}".replace(',', ' ')
    except (ValueError, TypeError):
        return "0"

def calculate_totals(data: dict, settings: dict) -> tuple[dict, float]:
    """Ma'lumotlar asosida qatorlar va umumiy summa xulosasini hisoblaydi."""
    rows = settings.get('rows', [])
    columns = settings.get('columns', [])
    row_totals = {}
    grand_total = 0.0
    
    for row_name in rows:
        row_total = sum(float(data.get(f"{row_name}_{col_name}", 0)) for col_name in columns)
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
    
    if report_type == 'new':
        location = payload.get('location', 'Noma\'lum')
        date_str = payload.get('date', '')
        data = payload.get('data', {})
        late_comment = payload.get('late_comment') # Kechikish izohini olish

        try:
            formatted_date = datetime.strptime(date_str, '%Y-%m-%d').strftime('%d.%m.%Y')
        except ValueError:
            formatted_date = date_str

        header_lines = [
            f"*{escape_markdown_v2(location)} filiali*",
            f"_{escape_markdown_v2(formatted_date)}_ *uchun yangi hisobot*",
            f"Hisobot \\#{escape_markdown_v2(report_id)}",
        ]
        
        info_lines = [
            f"👤 *Kiritdi:* {escape_markdown_v2(author)}",
        ]

        # Agar kechikish izohi bo'lsa, uni qo'shish
        if late_comment:
            info_lines.append(f"❗️ *Kechikish sababi:* {escape_markdown_v2(late_comment)}")

        row_totals, grand_total = calculate_totals(data, settings)

        body_lines = []
        if not row_totals:
            body_lines.append("\n_Ma'lumotlar kiritilmagan\\._")
        else:
            max_len = max(len(name) for name in row_totals.keys()) if row_totals else 0
            for name, total in sorted(row_totals.items()):
                padding = ' ' * (max_len - len(name))
                body_lines.append(f"`{escape_markdown_v2(name)}:{padding}` `{escape_markdown_v2(format_number(total))} so'm`")

        footer_lines = [
            "\\- - - - - - - - - - - - - - - - - -",
            f"💰 *JAMI: {escape_markdown_v2(format_number(grand_total))} so'm*"
        ]
        
        message_text = "\n".join(header_lines) + "\n\n" + "\n".join(info_lines) + "\n\n" + "\n".join(body_lines) + "\n\n" + "\n".join(footer_lines)
        log_message = f"Yangi hisobot (#{report_id}) guruhga yuborildi."

    elif report_type == 'edit':
        new_data = payload.get('data', {})
        old_data = payload.get('old_data', {})

        header_lines = [
            f"✍️ *Hisobot Tahrirlandi \\#{escape_markdown_v2(report_id)}*",
            f"👤 *O'zgartirdi:* {escape_markdown_v2(author)}",
        ]

        old_row_totals, old_grand_total = calculate_totals(old_data, settings)
        new_row_totals, new_grand_total = calculate_totals(new_data, settings)
        
        all_row_names = sorted(list(set(old_row_totals.keys()) | set(new_row_totals.keys())))
        body_lines = []
        has_changes = False

        for name in all_row_names:
            old_total = old_row_totals.get(name, 0)
            new_total = new_row_totals.get(name, 0)
            if old_total != new_total:
                has_changes = True
                change_symbol = "➕" if new_total > old_total else "➖"
                body_lines.append(
                    f"`{escape_markdown_v2(name)}:` ~{escape_markdown_v2(format_number(old_total))}~ → *{escape_markdown_v2(format_number(new_total))}* so'm {change_symbol}"
                )

        if not has_changes and old_grand_total == new_grand_total:
            body_lines.append("\n_Hisobotda qiymat o'zgarishlari bo'lmadi\\._")
            footer_lines = []
        else:
            change_indicator = "🔼" if new_grand_total > old_grand_total else "🔽" if new_grand_total < old_grand_total else "→"
            footer_lines = [
                "\\- - - - - - - - - - - - - - - - - -",
                f"💰 *JAMI:* ~{escape_markdown_v2(format_number(old_grand_total))}~ {change_indicator} *{escape_markdown_v2(format_number(new_grand_total))} so'm*"
            ]
            
        message_text = "\n\n".join([
            "\n".join(header_lines),
            "*O'zgarishlar:*",
            "\n".join(body_lines),
            "\n".join(footer_lines)
        ])
        log_message = f"Tahrirlangan hisobot (#{report_id}) haqida xabar guruhga yuborildi."
    else:
        logger.warning(f"Noma'lum report_type keldi: {report_type}")
        return

    if message_text:
        try:
            await bot.send_message(
                chat_id=group_id, 
                text=message_text, 
                parse_mode='MarkdownV2'
            )
            logger.info(log_message)
        except Exception as e:
            logger.error(f"Xabar yuborishda kutilmagan xatolik: {e}", exc_info=True)
            # Xatolik haqida javob qaytarish (agar kerak bo'lsa)
            raise e

@app.route('/send-report', methods=['POST'])
def handle_send_report():
    payload = request.json
    logger.info(f"Node.js serveridan kelgan to'liq so'rov: {payload}")
    
    if not payload:
        return jsonify({"error": "Ma'lumotlar yuborilmadi"}), 400

    bot_token = payload.get('bot_token')
    group_id = payload.get('group_id')

    if not bot_token or not group_id:
        return jsonify({"error": "Bot sozlamalari to'liq emas"}), 400

    try:
        bot = telegram.Bot(token=bot_token)
        asyncio.run(format_and_send_report(bot, group_id, payload))
        return jsonify({"status": "Xabar yuborish uchun muvaffaqiyatli qabul qilindi"}), 202
    except Exception as e:
        logger.error(f"Botni ishga tushirishda yoki xabar yuborishda kutilmagan xatolik: {e}", exc_info=True)
        return jsonify({"error": f"Ichki server xatoligi: {str(e)}"}), 500

if __name__ == '__main__':
    logger.info("Python Telegram Bot serveri http://127.0.0.1:5001 manzilida ishga tushdi." )
    app.run(host='0.0.0.0', port=5001, debug=True)
