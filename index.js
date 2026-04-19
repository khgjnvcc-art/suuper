import asyncio
import logging
import os
import re
import json
import time
import csv
import io
import math
from datetime import datetime
from io import BytesIO
import aiohttp
import asyncpg
import redis.asyncio as redis
import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt

from aiogram import Bot, Dispatcher, F, Router
from aiogram.types import Message, CallbackQuery, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, BufferedInputFile
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError
from aiohttp import web
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.redis import RedisStorage

# ==========================================
# ⚙️ الإعدادات (تُجلب من متغيرات البيئة في الاستضافة)
# ==========================================
TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))
LOG_CHANNEL_ID = os.getenv("LOG_CHANNEL_ID")
PG_DSN = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST")
WEBHOOK_PATH = f"/webhook/{TOKEN}"
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"
WEBAPP_HOST = "0.0.0.0"
WEBAPP_PORT = int(os.getenv("PORT", 8080))

# تم التحديث بناءً على طلبك ليكون ALISMS و GrizzlySMS
SITES = {
    "alisms": {
        "name": "سيرفر ALISMS 🟢",
        "url": "https://alisms.org/stubs/handler_api.php",
        "key": os.getenv("API_KEY_ALISMS")
    },
    "grizzly": {
        "name": "سيرفر Grizzly 🐻",
        "url": "https://api.grizzlysms.com/stubs/handler_api.php",
        "key": os.getenv("API_KEY_GRIZZLY")
    }
}

# ==========================================
# 🌟 مميزات المواقع (تُعرض عند اختيار السيرفر)
# ==========================================
SITE_FEATURES = {
    "alisms": """
🟢 *مميزات سيرفر ALISMS:*
✅ *أسعار تنافسية:* يوفر أرقاماً بأسعار اقتصادية جداً.
✅ *تغطية ممتازة:* يدعم معظم الدول العربية والأجنبية بقوة.
✅ *سرعة الوصول:* وصول أكواد التفعيل (SMS) بسرعة فائقة.
✅ *تحديث مستمر:* إضافة أرقام جديدة يومياً لخدمات مثل واتساب وتليجرام.
✅ *استقرار عالي:* خوادم مستقرة ونسبة نجاح مرتفعة في التفعيلات.
""",
    "grizzly": """
🐻 *مميزات سيرفر Grizzly SMS:*
✅ *مخزون ضخم:* الملايين من الأرقام المتاحة لمختلف الخدمات العالمية.
✅ *تغطية شاملة:* يدعم أكثر من 170 دولة حول العالم.
✅ *تنوع الخدمات:* يوفر أرقاماً لخدمات نادرة وتطبيقات غير شائعة.
✅ *جودة متميزة:* أرقام حصرية ونسبة الحظر فيها شبه معدومة.
✅ *نظام تعويض ذكي:* استرداد الرصيد تلقائياً وبسرعة إذا لم يصل الكود.
"""
}

# ==========================================
# 📊 القواميس الأساسية
# ==========================================
POPULAR_COUNTRIES = {
    "مصر 🇪🇬": "21", "السعودية 🇸🇦": "53", "العراق 🇮🇶": "47", "الامارات 🇦🇪": "95", "الكويت 🇰🇼": "52",
    "عمان 🇴🇲": "110", "اليمن 🇾🇪": "30", "امريكا 🇺🇸": "187", "كندا 🇨🇦": "36", "المغرب 🇲🇦": "37", 
    "الجزائر 🇩🇿": "58", "تركيا 🇹🇷": "62", "روسيا 🇷🇺": "0", "ألمانيا 🇩🇪": "43", "فرنسا 🇫🇷": "78", 
    "بريطانيا 🇬🇧": "16"
}

ALL_COUNTRIES = {
    "روسيا 🇷🇺": "0", "أوكرانيا 🇺🇦": "1", "كازاخستان 🇰🇿": "2", "الصين 🇨🇳": "3", "الفلبين 🇵🇭": "4",
    "ميانمار 🇲🇲": "5", "إندونيسيا 🇮🇩": "6", "ماليزيا 🇲🇾": "7", "كينيا 🇰🇪": "8", "تنزانيا 🇹🇿": "9",
    "فيتنام 🇻🇳": "10", "قيرغيزستان 🇰🇬": "11", "امريكا 🇺🇸": "187", "إسرائيل 🇮🇱": "13", "مصر 🇪🇬": "21",
    "اليمن 🇾🇪": "30", "كندا 🇨🇦": "36", "المغرب 🇲🇦": "37", "ألمانيا 🇩🇪": "43", "العراق 🇮🇶": "47",
    "الكويت 🇰🇼": "52", "السعودية 🇸🇦": "53", "الجزائر 🇩🇿": "58", "تركيا 🇹🇷": "62", "فرنسا 🇫🇷": "78",
    "الامارات 🇦🇪": "95", "عمان 🇴🇲": "110", "سوريا 🇸🇾": "118", "لبنان 🇱🇧": "135", "فلسطين 🇵🇸": "143",
    "قطر 🇶🇦": "144", "البحرين 🇧🇭": "145"
}

POPULAR_SERVICES = {
    "wa": "واتساب", "tg": "تليجرام", "ig": "انستقرام", "go": "جوجل", "fb": "فيسبوك", "lf": "تيك توك",
    "tw": "تويتر (X)", "sn": "سناب شات", "ha": "حراج"
}

ALL_SERVICES_MAP = {
    "wa": "واتساب", "tg": "تليجرام", "ig": "انستقرام", "go": "جوجل", "fb": "فيسبوك", "lf": "تيك توك",
    "vi": "فايبر", "tw": "تويتر", "ub": "اوبر", "sn": "سناب شات", "ds": "ديسكورد", "am": "امازون",
    "mm": "مايكروسوفت", "kf": "وي شات", "nf": "نتفليكس", "vk": "فكونتاكتي", "ok": "اودنوكلاسنيكي",
    "ha": "حراج", "nn": "نون"
}

class SearchState(StatesGroup):
    waiting_for_country = State()
    waiting_for_service_global = State()
    waiting_for_service_in_country = State()
    waiting_for_country_for_service = State()

# ==========================================
# 🛠️ نظام التنبيهات والأخطاء (Logging)
# ==========================================
class TelegramAlertHandler(logging.Handler):
    def __init__(self, bot_instance: Bot, admin_id: int, log_channel_id: str = None):
        super().__init__()
        self.bot = bot_instance
        self.admin_id = admin_id
        self.log_channel_id = log_channel_id
        self.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

    def emit(self, record):
        if record.levelno >= logging.ERROR:
            msg = self.format(record)
            if len(msg) > 3000:
                msg = msg[:2900] + "\n... (الرسالة طويلة جداً، تم اختصارها)"
            error_message_to_send = f"⚠️ *خطأ حرج في النظام:*\n`{msg}`"
            
            async def safe_send(chat_id):
                try:
                    await self.bot.send_message(chat_id, error_message_to_send)
                except Exception:
                    pass
            try:
                loop = asyncio.get_running_loop()
                if self.admin_id: loop.create_task(safe_send(self.admin_id))
                if self.log_channel_id: loop.create_task(safe_send(self.log_channel_id))
            except RuntimeError:
                pass

bot_session = AiohttpSession()
bot = Bot(token=TOKEN, session=bot_session, default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN))

telegram_handler = TelegramAlertHandler(bot, ADMIN_ID, LOG_CHANNEL_ID)
telegram_handler.setLevel(logging.ERROR)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", handlers=[
    logging.StreamHandler(),
    telegram_handler 
])

# ==========================================
# 🔄 إعداد الـ Redis Storage مع حماية الاتصال
# ==========================================
redis_client = redis.from_url(
    REDIS_URL, 
    decode_responses=True, 
    health_check_interval=10,
    socket_keepalive=True,
    retry_on_timeout=True
)
redis_storage = RedisStorage(redis=redis_client)
dp = Dispatcher(storage=redis_storage)
router = Router()
dp.include_router(router)

db_pool = None
PRICES_CACHE = {"alisms": {"time": 0, "data": {}}, "grizzly": {"time": 0, "data": {}}}

# ==========================================
# 🛡️ نظام نبضات الحياة (Keep-Alive) لمنع انقطاع السيرفر
# ==========================================
async def keep_alive_connections():
    """مهمة تعمل في الخلفية ترسل نبضة لسيرفر Redis و PostgreSQL لكي لا يتم قطع الاتصال"""
    while True:
        try:
            # إرسال نبضة لـ Redis
            await redis_client.ping()
            
            # إرسال نبضة لـ PostgreSQL
            if db_pool:
                async with db_pool.acquire() as conn:
                    await conn.execute("SELECT 1")
                    
        except Exception as e:
            logging.warning(f"Keep-Alive ping failed (Will auto-reconnect): {e}")
        
        # الانتظار 60 ثانية قبل النبضة القادمة (ريندر يقطع الاتصال بعد 300 ثانية خمول)
        await asyncio.sleep(60)

# ==========================================
# 🗄️ تهيئة قواعد البيانات
# ==========================================
async def init_db():
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(PG_DSN, command_timeout=10)
        async with db_pool.acquire() as conn:
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS history (
                    id SERIAL PRIMARY KEY, user_id BIGINT, phone TEXT,
                    service TEXT, code TEXT, price NUMERIC, date TIMESTAMP, operator TEXT, server TEXT
                );
                CREATE TABLE IF NOT EXISTS operator_scores (
                    operator TEXT, server TEXT, success_count INT DEFAULT 0, fail_count INT DEFAULT 0,
                    PRIMARY KEY (operator, server)
                );
                CREATE TABLE IF NOT EXISTS banned_numbers (
                    phone TEXT PRIMARY KEY, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ''')
        logging.info("تم الاتصال بـ PostgreSQL بنجاح.")
    except Exception as e:
        logging.error(f"خطأ في الاتصال بـ PostgreSQL: {e}")

async def get_today_stats(srv_code, site_key):
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT operator, COUNT(*) as c FROM history WHERE service = $1 AND server = $2 AND DATE(date) = CURRENT_DATE GROUP BY operator", srv_code, site_key)
            return {r['operator']: r['c'] for r in rows}
    except Exception as e:
        logging.error(f"Error fetching stats: {e}")
        return {}

async def get_user_site(state: FSMContext):
    data = await state.get_data()
    return data.get("site", "alisms")

# ==========================================
# 🌐 الاتصال بالـ API والجلب الديناميكي
# ==========================================
async def api_request(site_key, params, max_retries=3):
    url = SITES[site_key]["url"]
    params["api_key"] = SITES[site_key]["key"]
    delay = 0.5
    async with aiohttp.ClientSession() as session:
        for attempt in range(max_retries):
            try:
                async with session.get(url, params=params, timeout=7) as response:
                    if response.status == 200:
                        text = await response.text()
                        try: return json.loads(text)
                        except json.JSONDecodeError: return text
            except Exception: pass
            await asyncio.sleep(delay)
            delay = min(delay * 2, 5.0) 
    return None

async def get_all_prices(site_key):
    now = time.time()
    if now - PRICES_CACHE[site_key]["time"] < 300 and PRICES_CACHE[site_key]["data"]:
        return PRICES_CACHE[site_key]["data"]
    res = await api_request(site_key, {"action": "getPrices"})
    if isinstance(res, dict):
        PRICES_CACHE[site_key]["data"] = res
        PRICES_CACHE[site_key]["time"] = now
        return res
    return {}

async def get_balance(site_key):
    res = await api_request(site_key, {"action": "getBalance"})
    if res and isinstance(res, str) and ":" in res:
        try: return float(res.split(':')[1])
        except: return 0.0
    return 0.0

# ==========================================
# 🎛️ واجهة المستخدم والأوامر
# ==========================================
def main_kb():
    kb = ReplyKeyboardMarkup(resize_keyboard=True, keyboard=[
        [KeyboardButton(text="🌍 تصفح جميع الدول")],
        [KeyboardButton(text="🔍 بحث عن دولة"), KeyboardButton(text="🔍 بحث عن خدمة")],
        [KeyboardButton(text="💰 فحص الرصيد"), KeyboardButton(text="💻 لوحة التحكم")],
        [KeyboardButton(text="🔄 تغيير السيرفر")],
        [KeyboardButton(text="📊 الإحصائيات (رسم بياني)"), KeyboardButton(text="📂 استخراج Excel")],
        [KeyboardButton(text="🇸🇦 طلب مباشر (222)")],
    ])
    return kb

@router.message(F.text == "/start")
async def start_cmd(message: Message, state: FSMContext):
    await state.clear()
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🟢 الشراء من سيرفر ALISMS", callback_data="set_site_alisms")],
        [InlineKeyboardButton(text="🐻 الشراء من سيرفر Grizzly SMS", callback_data="set_site_grizzly")]
    ])
    text = "💎 *مرحباً بك في نظام الصياد VIP V8.0 المزدوج*\nالبوت الآن يعمل بأقصى سرعة وثبات مع الموقعين.\n\n👇 يرجى اختيار السيرفر الذي ترغب بالعمل عليه الآن:"
    await message.answer(text, reply_markup=markup)

@router.message(F.text == "🔄 تغيير السيرفر")
async def change_site_btn(message: Message):
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🟢 الشراء من سيرفر ALISMS", callback_data="set_site_alisms")],
        [InlineKeyboardButton(text="🐻 الشراء من سيرفر Grizzly SMS", callback_data="set_site_grizzly")]
    ])
    await message.answer("🔄 *اختر السيرفر الجديد:*", reply_markup=markup)

@router.callback_query(F.data.startswith("set_site_"))
async def change_site_callback(call: CallbackQuery, state: FSMContext):
    site_key = call.data.replace("set_site_", "")
    await state.update_data(site=site_key)
    
    try: 
        await call.message.delete()
    except: 
        pass

    features = SITE_FEATURES.get(site_key, "")
    site_name = SITES[site_key]['name']
    
    welcome_text = f"✅ *تم تحويل البوت للعمل بنجاح على:* `{site_name}`\n\n{features}\n\n👇 *يمكنك الآن البدء باستخدام البوت من القائمة أدناه:*"
    
    await call.message.answer(welcome_text, reply_markup=main_kb())
    await call.answer("تم تغيير السيرفر بنجاح! 🚀", show_alert=False)

@router.message(F.text == "💰 فحص الرصيد")
async def check_bal(message: Message, state: FSMContext):
    site_key = await get_user_site(state)
    bal = await get_balance(site_key)
    await message.answer(f"💰 رصيدك الحالي في ({SITES[site_key]['name']}): `{bal}$`")

def build_pagination_kb(items, page, per_page, prefix, back_data=None):
    total_pages = math.ceil(len(items) / per_page)
    start, end = page * per_page, (page * per_page) + per_page
    keyboard, row = [], []
    for text, data in items[start:end]:
        row.append(InlineKeyboardButton(text=text, callback_data=data))
        if len(row) == 2: keyboard.append(row); row = []
    if row: keyboard.append(row)
    nav_row = []
    if page > 0: nav_row.append(InlineKeyboardButton(text="⬅️ السابق", callback_data=f"{prefix}_{page-1}"))
    if page < total_pages - 1: nav_row.append(InlineKeyboardButton(text="التالي ➡️", callback_data=f"{prefix}_{page+1}"))
    if nav_row: keyboard.append(nav_row)
    if back_data: keyboard.append([InlineKeyboardButton(text="🔙 رجوع", callback_data=back_data)])
    return InlineKeyboardMarkup(inline_keyboard=keyboard)

@router.message(F.text == "🌍 تصفح جميع الدول")
async def show_all_countries(message: Message, state: FSMContext):
    await handle_countries_page(message, state, 0)

@router.callback_query(F.data.startswith("pg_c_"))
async def paginate_countries(call: CallbackQuery, state: FSMContext):
    await handle_countries_page(call.message, state, int(call.data.split("_")[2]), edit=True)

async def handle_countries_page(message, state, page, edit=False):
    site_key = await get_user_site(state)
    data = await get_all_prices(site_key)
    country_ids = {cid for c_data in data.values() if isinstance(c_data, dict) for cid in c_data.keys()}
    sorted_cids = sorted(list(country_ids), key=lambda x: (x not in ALL_COUNTRIES.values(), int(x) if x.isdigit() else 0))
    items = [(next((n for n, c in ALL_COUNTRIES.items() if c == cid), f"دولة {cid} 🌍"), f"country_{cid}") for cid in sorted_cids]
    markup = build_pagination_kb(items, page, 20, "pg_c")
    text = f"🌍 *جميع الدول في {SITES[site_key]['name']}*\n(صفحة {page+1}/{max(1, math.ceil(len(items)/20))}):"
    
    if edit:
        await message.edit_text(text, reply_markup=markup)
    else:
        await message.answer(text, reply_markup=markup)

# ==========================================
# 📊 رسم الإحصائيات بأمان (بدون حظر الـ Event Loop)
# ==========================================
def draw_chart(ops, counts, site_name):
    plt.figure(figsize=(8, 5))
    plt.bar(ops, counts, color='skyblue')
    plt.title(f"أفضل 5 مشغلين (معدل النجاح) - {site_name}")
    plt.xlabel("المشغل")
    plt.ylabel("العدد")
    plt.xticks(rotation=45, ha='right') 
    plt.tight_layout() 
    buf = BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    plt.close()
    return buf

@router.message(F.text == "📊 الإحصائيات (رسم بياني)")
async def generate_chart(message: Message, state: FSMContext):
    site_key = await get_user_site(state)
    if message.from_user.id != ADMIN_ID: return await message.answer("⛔ هذا الزر للمدير فقط.")
        
    try:
        async with db_pool.acquire() as conn:
            records = await conn.fetch("SELECT operator, success_count FROM operator_scores WHERE server = $1 ORDER BY success_count DESC LIMIT 5", site_key)
    except Exception as e: return await message.answer(f"حدث خطأ: {e}")
    
    if not records: return await message.answer(f"لا توجد بيانات كافية للرسم البياني في سيرفر {SITES[site_key]['name']}.")
         
    ops = [r['operator'] for r in records]
    counts = [r['success_count'] for r in records]
    
    buf = await asyncio.to_thread(draw_chart, ops, counts, SITES[site_key]['name'])
    
    photo = BufferedInputFile(buf.read(), filename="chart.png")
    await message.answer_photo(photo, caption="📊 *تحليل ذكي لأداء المشغلين*")

@router.message(F.text == "📂 استخراج Excel")
async def export_excel(message: Message):
    if message.from_user.id != ADMIN_ID: return await message.answer("⛔ هذا الزر للمدير فقط.")
        
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, user_id, phone, service, code, price, date, operator, server FROM history ORDER BY date DESC")
    except Exception as e: return await message.answer(f"حدث خطأ: {e}")
    
    if not rows: return await message.answer("لا توجد بيانات لاستخراجها.")
        
    output = io.StringIO()
    writer = csv.writer(output, dialect='excel')
    writer.writerow(['ID', 'User ID', 'Phone', 'Service', 'Code', 'Price', 'Date', 'Operator', 'Server'])
    for r in rows:
        writer.writerow([str(r['id']), str(r['user_id']), r['phone'], r['service'], r['code'], str(r['price']), str(r['date']), r['operator'], r.get('server', 'alisms')])
    
    file_bytes = output.getvalue().encode('utf-8-sig')
    file = BufferedInputFile(file_bytes, filename="vip_history.csv") 
    await message.answer_document(file, caption="📂 سجل العمليات VIP بالكامل.")

@router.message(F.text == "🇸🇦 طلب مباشر (222)")
async def saudi_direct_222(message: Message, state: FSMContext):
    site_key = await get_user_site(state)
    try:
        await message.answer(f"⚡ جاري طلب رقم واتساب من المشغل 222 حصراً عبر السيرفر النشط ({SITES[site_key]['name']})...")
        ops_dict = {"222": 0.0} 
        asyncio.create_task(hunt_single_number(message.chat.id, "wa", "53", ops_dict, site_key))
    except Exception: pass

# ==========================================
# 🎯 دوال الصياد الذكي (Hunting logic)
# ==========================================
async def hunt_single_number(chat_id, srv, cid, ops_dict, site_key):
    timestamp = int(time.time())
    hunt_id = f"hunt:{chat_id}:{timestamp}"
    ops_list = list(ops_dict.keys())
    
    try: await redis_client.setex(hunt_id, 600, "active") 
    except Exception: return
    
    markup = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🛑 إيقاف الصياد", callback_data=f"stophunt_{chat_id}_{timestamp}")]])
    try:
        msg = await bot.send_message(chat_id, f"🚀 *الصياد يعمل الآن ({SITES[site_key]['name']})...*\nنبحث لك عن رقم لخدمة `{ALL_SERVICES_MAP.get(srv, srv)}`...", reply_markup=markup)
    except: return
    
    delay = 0.5
    caught_data = None
    
    try:
        while await redis_client.get(hunt_id):
            for op in ops_list:
                params = {"action": "getNumberV2", "service": srv, "country": cid, "operator": op}
                res = await api_request(site_key, params, max_retries=1)
                if isinstance(res, dict) and ('number' in res or 'phoneNumber' in res):
                    caught_data = res
                    caught_data['op'] = op
                    caught_data['price'] = float(ops_dict.get(op, 0.0))
                    await redis_client.delete(hunt_id) 
                    break
            if caught_data: break
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 3.0) 
    except Exception as e: logging.error(f"Error during hunting loop: {e}")
    
    if 'msg' in locals():
        try: await bot.delete_message(chat_id, msg.message_id)
        except TelegramAPIError: pass 
    if caught_data:
        await handle_success_hunt(chat_id, caught_data, srv, cid, site_key)

async def handle_success_hunt(chat_id, data, srv, cid, site_key):
    act_id = data.get('id') or data.get('activationId')
    phone = data.get('number') or data.get('phoneNumber')
    op = data.get('op', 'unknown')
    price = data.get('price', 0.0)
    
    try:
        await redis_client.hset(f"active_orders:{chat_id}", str(act_id), f"{phone}|{srv}|{op}|{price}|{site_key}")
        await redis_client.setex(f"session:{act_id}", 1200, "active") 
    except: pass
    
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📩 فحص الكود", callback_data=f"check_{act_id}_{phone}")],
        [InlineKeyboardButton(text="🛡️ إبلاغ 2FA", callback_data=f"ban2fa_{act_id}_{phone}")],
        [InlineKeyboardButton(text="❌ إلغاء", callback_data=f"canc_{act_id}")]
    ])
    
    try:
        text = f"🎯 *تم الصيد بنجاح! ({SITES[site_key]['name']})*\n📞 الرقم: `{phone}`\n📡 المشغل: `{op}`\n💰 السعر: `{price}$`\n⏳ ننتظر الكود..."
        sent_msg = await bot.send_message(chat_id, text, reply_markup=markup)
        asyncio.create_task(auto_check_sms(chat_id, act_id, phone, srv, op, price, site_key, sent_msg.message_id))
    except Exception as e: logging.error(f"Error sending success message: {e}")

async def auto_check_sms(chat_id, act_id, phone, srv, op, price, site_key, msg_id):
    start_time = time.time()
    try:
        while await redis_client.get(f"session:{act_id}"):
            if time.time() - start_time > 1100: break 
                
            res = await api_request(site_key, {"action": "getStatus", "id": act_id})
            if isinstance(res, str) and "STATUS_OK" in res:
                code = "".join(re.findall(r'\d+', res.split(":")[1]))
                try:
                    await redis_client.delete(f"session:{act_id}")
                    await redis_client.hdel(f"active_orders:{chat_id}", str(act_id))
                except: pass
                
                try:
                    async with db_pool.acquire() as conn:
                        await conn.execute("INSERT INTO history (user_id, phone, service, code, price, date, operator, server) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)", chat_id, phone, srv, code, price, op, site_key)
                        await conn.execute("INSERT INTO operator_scores (operator, server, success_count) VALUES ($1, $2, 1) ON CONFLICT (operator, server) DO UPDATE SET success_count = operator_scores.success_count + 1", op, site_key)
                except Exception as db_e: logging.error(f"DB Error: {db_e}")
                
                try: await bot.edit_message_text(f"🔔 *الكود وصل!*\n📱 `{phone}`\n✉️ الكود: `{code}`", chat_id=chat_id, message_id=msg_id)
                except TelegramAPIError: pass 
                return
            await asyncio.sleep(10)
    except: pass
        
    try:
        await api_request(site_key, {"action": "setStatus", "status": "8", "id": act_id})
        if await redis_client.get(f"session:{act_id}"):
            await bot.edit_message_text(f"⌛ *انتهى الوقت ولم يصل الكود للرقم:* `{phone}`", chat_id=chat_id, message_id=msg_id)
    except: pass

@router.callback_query(F.data.startswith("stophunt_"))
async def stop_hunter(call: CallbackQuery):
    parts = call.data.split("_")
    hunt_id = f"hunt:{parts[1]}:{parts[2]}"
    await redis_client.delete(hunt_id)
    try: await call.message.edit_text("🛑 *تم إيقاف الصياد بناءً على طلبك.*")
    except Exception: pass
    await call.answer("تم إيقاف البحث بنجاح", show_alert=True)

# ==========================================
# 🚀 إعداد الخادم و Webhook
# ==========================================
async def on_startup(bot: Bot):
    for handler in logging.getLogger().handlers:
        if isinstance(handler, TelegramAlertHandler): handler.bot = bot
    await init_db()
    
    # 🔥 تشغيل نظام نبضات الحياة في الخلفية لمنع الاستضافة من فصل قواعد البيانات
    asyncio.create_task(keep_alive_connections())
    
    await bot.set_webhook(WEBHOOK_URL)
    logging.info(f"Webhook set to {WEBHOOK_URL}")

async def on_shutdown(bot: Bot):
    if db_pool: await db_pool.close()
    if redis_client: await redis_client.close()
    logging.info("Bot shutdown complete.")

def main():
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)
    app = web.Application()
    webhook_requests_handler = SimpleRequestHandler(dispatcher=dp, bot=bot)
    webhook_requests_handler.register(app, path=WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)
    logging.info(f"Starting server on {WEBAPP_HOST}:{WEBAPP_PORT}")
    web.run_app(app, host=WEBAPP_HOST, port=WEBAPP_PORT)

if __name__ == '__main__':
    required_env_vars = ["BOT_TOKEN", "API_KEY_ALISMS", "API_KEY_GRIZZLY", "ADMIN_ID", "DATABASE_URL", "REDIS_URL", "WEBHOOK_HOST"]
    for var in required_env_vars:
        if not os.getenv(var):
            logging.critical(f"Missing required environment variable: {var}. Exiting.")
            exit(1)
    main()
