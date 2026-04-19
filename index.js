const { Telegraf, Markup } = require('telegraf');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const fs = require('fs');
const express = require('express');

puppeteer.use(StealthPlugin());

// --- الإعدادات الأساسية ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8690835074:AAGcbDTPCqP5ixRVf9LC73EX4NGNnf_6_S4';
const MY_TELEGRAM_ID = parseInt(process.env.MY_TELEGRAM_ID) || 8435344041; 

const bot = new Telegraf(BOT_TOKEN);
const userState = {};

// --- خادم الويب لاستضافة Render ---
const app = express();
app.get('/', (req, res) => res.send('🟢 لوحة تحكم VIP تعمل بنجاح! السيرفر نشط.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 الخادم الوهمي يعمل على المنفذ ${PORT}`));

// --- الواجهات الجذابة (اللوحة الرئيسية) ---
const mainMenu = Markup.keyboard([
    ['🚀 إرسال طلب دعم جديد', '📊 حالة السيرفر'],
    ['▶️ بدء البوت', '❌ إلغاء العملية']
]).resize();

// --- قائمة الدول العربية والعالمية ---
const countries = [
    { name: '🇾🇪 اليمن (+967)', code: '967' }, { name: '🇸🇦 السعودية (+966)', code: '966' },
    { name: '🇪🇬 مصر (+20)', code: '20' }, { name: '🇦🇪 الإمارات (+971)', code: '971' },
    { name: '🇯🇴 الأردن (+962)', code: '962' }, { name: '🇰🇼 الكويت (+965)', code: '965' },
    { name: '🇴🇲 عُمان (+968)', code: '968' }, { name: '🇶🇦 قطر (+974)', code: '974' },
    { name: '🇧🇭 البحرين (+973)', code: '973' }, { name: '🇮🇶 العراق (+964)', code: '964' },
    { name: '🇸🇾 سوريا (+963)', code: '963' }, { name: '🇱🇧 لبنان (+961)', code: '961' },
    { name: '🇵🇸 فلسطين (+970)', code: '970' }, { name: '🇩🇿 الجزائر (+213)', code: '213' },
    { name: '🇲🇦 المغرب (+212)', code: '212' }, { name: '🇹🇳 تونس (+216)', code: '216' },
    { name: '🇱🇾 ليبيا (+218)', code: '218' }, { name: '🇸🇩 السودان (+249)', code: '249' },
    { name: '🇺🇸 أمريكا (+1)', code: '1' }, { name: '🇬🇧 بريطانيا (+44)', code: '44' },
    { name: '🇹🇷 تركيا (+90)', code: '90' }, { name: '🇩🇪 ألمانيا (+49)', code: '49' }
];

// وظيفة لإنشاء لوحة مفاتيح الدول مع صفحات (Pagination)
function getCountryKeyboard(pageIndex) {
    const itemsPerPage = 8; // عدد الدول في كل صفحة
    const start = pageIndex * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = countries.slice(start, end);

    const buttons = [];
    for (let i = 0; i < pageItems.length; i += 2) {
        const row = [];
        row.push(Markup.button.callback(pageItems[i].name, `set_cc_${pageItems[i].code}`));
        if (i + 1 < pageItems.length) {
            row.push(Markup.button.callback(pageItems[i+1].name, `set_cc_${pageItems[i+1].code}`));
        }
        buttons.push(row);
    }

    const navRow = [];
    if (start > 0) navRow.push(Markup.button.callback('⬅️ السابق', `page_${pageIndex - 1}`));
    if (end < countries.length) navRow.push(Markup.button.callback('التالي ➡️', `page_${pageIndex + 1}`));
    if (navRow.length > 0) buttons.push(navRow);

    buttons.push([Markup.button.callback('🌐 إدخال الرمز يدوياً', 'set_code_manual')]);
    buttons.push([Markup.button.callback('🚫 إلغاء', 'cancel_task')]);

    return Markup.inlineKeyboard(buttons);
}

// --- وظائف مساعدة ---
const randomDelay = (min = 40, max = 90) => Math.floor(Math.random() * (max - min + 1) + min);
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

let globalBrowser;

async function getBrowser() {
    if (globalBrowser && globalBrowser.connected) return globalBrowser;
    console.log("🔄 جاري تهيئة محرك المتصفح...");
    try {
        globalBrowser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process', '--disable-extensions']
        });
        console.log("✅ المتصفح الاحترافي جاهز للعمل.");
        return globalBrowser;
    } catch (e) {
        console.error("❌ خطأ:", e); throw e;
    }
}

bot.use(async (ctx, next) => {
    if (ctx.from && ctx.from.id === MY_TELEGRAM_ID) {
        try { await next(); } catch (err) { console.error("Error:", err); }
    }
});

// بدء البوت وزر التحديث
bot.start(startBotHandler);
bot.hears('▶️ بدء البوت', startBotHandler);

async function startBotHandler(ctx) {
    delete userState[ctx.from.id];
    await ctx.replyWithHTML(`<b>مرحباً بك سيدي في لوحة التحكم VIP 👑</b>\n\n<i>تم تحديث النظام وحل مشكلة اللغات والدول بنجاح.</i>`, mainMenu);
}

bot.hears('📊 حالة السيرفر', async (ctx) => {
    const isConnected = globalBrowser && globalBrowser.connected;
    const status = isConnected ? "🟢 متصل (Render Online)" : "🔴 المحرك في وضع الاستعداد";
    await ctx.replyWithHTML(`<b>📊 حالة النظام:</b>\nالمتصفح: ${status}\nالخادم: 🟢 متصل`);
});

bot.hears('❌ إلغاء العملية', async (ctx) => {
    delete userState[ctx.from.id];
    await ctx.reply('✅ تم تنظيف الجلسة والعودة للقائمة الرئيسية.', mainMenu);
});

bot.hears('🚀 إرسال طلب دعم جديد', async (ctx) => {
    userState[ctx.from.id] = { step: 'select_country' };
    await ctx.replyWithHTML('<b>🌍 الخطوة 1:</b> اختر الدولة المستهدفة:', getCountryKeyboard(0));
});

bot.action(/page_(\d+)/, async (ctx) => {
    const pageIndex = parseInt(ctx.match[1]);
    await ctx.editMessageReplyMarkup(getCountryKeyboard(pageIndex).reply_markup);
    await ctx.answerCbQuery();
});

bot.action(/set_cc_(.+)/, async (ctx) => {
    const code = ctx.match[1];
    const state = userState[ctx.from.id];
    if (!state) return ctx.answerCbQuery('⚠️ الجلسة منتهية.', { show_alert: true });

    state.countryCode = code;
    state.step = 'get_phone';
    await ctx.editMessageText(`✅ تم اختيار الرمز (+${code})\n\n<b>الآن أرسل رقم الهاتف فقط (بدون الرمز):</b>\nمثال: <code>771596288</code>`, { parse_mode: 'HTML' });
    await ctx.answerCbQuery();
});

bot.action('set_code_manual', async (ctx) => {
    const state = userState[ctx.from.id];
    if (!state) return;
    state.step = 'get_cc';
    await ctx.editMessageText('📝 أرسل رمز الدولة فقط (مثال: 967 بدون علامة +):');
    await ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
    const state = userState[ctx.from.id];
    if (!state) return;
    const text = ctx.message.text.trim();

    if (['🚀 إرسال طلب دعم جديد', '📊 حالة السيرفر', '❌ إلغاء العملية', '▶️ بدء البوت'].includes(text)) return;

    if (state.step === 'get_cc') {
        state.countryCode = text.replace('+', '');
        state.step = 'get_phone';
        await ctx.replyWithHTML(`<b>✅ تم الحفظ (+${state.countryCode}).\n\nالآن أرسل رقم الهاتف فقط (بدون الرمز):</b>`);
    }
    else if (state.step === 'get_phone') {
        state.nationalNumber = text.replace(/[^0-9]/g, '');
        state.fullPhone = `+${state.countryCode}${state.nationalNumber}`;
        state.step = 'get_email';
        await ctx.replyWithHTML('<b>📧 الخطوة 2:</b> أرسل البريد الإلكتروني:');
    } 
    else if (state.step === 'get_email') {
        if (!isValidEmail(text)) return ctx.reply('⚠️ إيميل غير صحيح، حاول مجدداً:');
        state.email = text;
        state.step = 'get_message';
        await ctx.replyWithHTML('<b>📝 الخطوة 3:</b> أرسل نص الرسالة لواتساب:');
    }
    else if (state.step === 'get_message') {
        state.customMessage = text;
        state.step = 'confirm';
        
        const summary = `<b>👑 مراجعة الطلب النهائي (VIP)</b>\n\n` +
                        `🌍 <b>رمز الدولة:</b> <code>+${state.countryCode}</code>\n` +
                        `📱 <b>الرقم المحلي:</b> <code>${state.nationalNumber}</code>\n` +
                        `📧 <b>الإيميل:</b> <code>${state.email}</code>\n\n` +
                        `<b>هل تريد التنفيذ الآن؟</b>`;
        
        await ctx.replyWithHTML(summary, Markup.inlineKeyboard([
            [Markup.button.callback('🚀 نعم، أرسل الآن', 'start_task')],
            [Markup.button.callback('❌ إلغاء', 'cancel_task')]
        ]));
    }
});

bot.action('cancel_task', async (ctx) => {
    delete userState[ctx.from.id];
    await ctx.editMessageText('❌ تم إلغاء العملية بنجاح.');
    await ctx.answerCbQuery();
});

bot.action('start_task', async (ctx) => {
    const state = userState[ctx.from.id];
    if (!state) return ctx.answerCbQuery('⚠️ الجلسة منتهية.', { show_alert: true });
    
    await ctx.editMessageText('🔄 <b>جاري تشغيل المتصفح باللغة الإنجليزية وإرسال الطلب... الرجاء الانتظار⏳</b>', { parse_mode: 'HTML' });
    
    runSupportTask(state.countryCode, state.nationalNumber, state.fullPhone, state.email, state.customMessage, ctx);
    delete userState[ctx.from.id];
    await ctx.answerCbQuery();
});

async function runSupportTask(countryCode, nationalNumber, fullPhone, email, customMsg, ctx) {
    let browser, context, page;
    try {
        browser = await getBrowser();
        context = await browser.createIncognitoBrowserContext();
        page = await context.newPage();
        
        // 1. إجبار المتصفح على اللغة الإنجليزية لضمان عدم تعطل التصميم
        await page.setViewport({ width: 1280, height: 800 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        const desktopUA = new UserAgent({ deviceCategory: 'desktop' }).toString();
        await page.setUserAgent(desktopUA);
        
        // استخدام ?lang=en في الرابط لفتح الصفحة باللغة الإنجليزية إجبارياً
        await page.goto('https://www.whatsapp.com/contact/noclient/?lang=en', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('input')).filter(
                i => (i.type === 'text' || i.type === 'tel' || i.type === 'email') && i.offsetHeight > 0
            ).length >= 3;
        }, { timeout: 30000 });

        await new Promise(r => setTimeout(r, 2000));

        const inputs = await page.$$('input');
        const visibleTextInputs = [];
        for (const input of inputs) {
            const type = await input.evaluate(el => el.type);
            const isVisible = await input.evaluate(el => el.offsetHeight > 0 && el.offsetWidth > 0);
            if ((type === 'text' || type === 'tel' || type === 'email') && isVisible) {
                visibleTextInputs.push(input);
            }
        }

        if (visibleTextInputs.length < 3) throw new Error("لم أتمكن من إيجاد حقول الإدخال.");
        const phoneInput = visibleTextInputs[0];

        // 2. النقر على قائمة الدول وتجنب الشريط الأخضر العلوي
        await page.evaluate((el) => {
            const y = el.getBoundingClientRect().top + window.scrollY - 200; // النزول بالصفحة
            window.scrollTo({top: y, behavior: 'smooth'});
        }, phoneInput);
        await new Promise(r => setTimeout(r, 1000));

        // فتح قائمة الدول (النقر المباشر على الزر لتخطي أي حظر)
        const dropdownOpened = await page.evaluate((el) => {
            const container = el.closest('div').parentElement.parentElement;
            const dropdown = container.querySelector('[role="combobox"], [aria-haspopup="listbox"], button');
            if (dropdown) { dropdown.click(); return true; }
            return false;
        }, phoneInput);

        if (dropdownOpened) {
            // انتظار القائمة للظهور وكتابة الرمز واختياره
            await new Promise(r => setTimeout(r, 1500));
            await page.keyboard.type(`+${countryCode}`);
            await new Promise(r => setTimeout(r, 1000));
            await page.keyboard.press('ArrowDown'); // النزول للنتيجة الصحيحة
            await new Promise(r => setTimeout(r, 200));
            await page.keyboard.press('Enter');     // تأكيد الاختيار
            await new Promise(r => setTimeout(r, 1000));
        }

        // 3. تنظيف الخانة وكتابة الرقم الصافي
        await phoneInput.click();
        await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await phoneInput.type(nationalNumber, { delay: randomDelay() });
        
        // 4. كتابة الإيميلات
        await visibleTextInputs[1].type(email, { delay: randomDelay() });
        await visibleTextInputs[2].type(email, { delay: randomDelay() });
        
        // 5. اختيار نوع الجهاز
        const androidRadio = await page.$('input[type="radio"][value="android"]') || (await page.$$('input[type="radio"]'))[0];
        if (androidRadio) await page.evaluate((el) => el.click(), androidRadio);
        
        // 6. كتابة الرسالة
        await page.waitForSelector('textarea', { timeout: 10000 });
        const textarea = await page.$('textarea');
        await page.evaluate((el) => {
            const y = el.getBoundingClientRect().top + window.scrollY - 200;
            window.scrollTo({top: y, behavior: 'smooth'});
        }, textarea);
        await new Promise(r => setTimeout(r, 500));
        await textarea.type(customMsg, { delay: randomDelay(20, 50) });
        
        // 7. النقر على "Next Step"
        let submitButton = await page.$('button[type="submit"]');
        if (!submitButton) {
            const buttons = await page.$$('button');
            submitButton = buttons[buttons.length - 1]; 
        }
        if (submitButton) await page.evaluate((el) => el.click(), submitButton);
        
        // 8. انتظار الصفحة التالية ثم النقر على "Send Question"
        await new Promise(r => setTimeout(r, 6000));
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            const sendBtn = buttons.reverse().find(b => 
                b.innerText.toLowerCase().includes('send') || 
                b.innerText.toLowerCase().includes('submit') ||
                b.innerText.includes('إرسال')
            );
            if (sendBtn) sendBtn.click();
        });

        // 9. انتظار صفحة النجاح
        await new Promise(r => setTimeout(r, 6000));

        // 10. إرسال لقطة الشاشة إليك
        const successScreenshotPath = `success_${Date.now()}.png`;
        await page.screenshot({ path: successScreenshotPath, fullPage: true });

        await ctx.replyWithPhoto(
            { source: successScreenshotPath }, 
            { caption: `✅ <b>تم الإرسال بنجاح سيدي!</b>\n\n📱 الرقم: <code>${fullPhone}</code>\n\n📸 إليك الدليل من داخل واتساب على إتمام العملية.`, parse_mode: 'HTML' }
        );

        if (fs.existsSync(successScreenshotPath)) fs.unlinkSync(successScreenshotPath);

    } catch (err) {
        console.error("Task Error:", err);
        if (page) {
            const screenshotPath = `error_${Date.now()}.png`;
            try {
                await page.screenshot({ path: screenshotPath, fullPage: true });
                await ctx.replyWithPhoto({ source: screenshotPath }, { caption: `❌ فشل الإرسال.\nالخطأ: ${err.message}` });
                if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
            } catch (e) {
                await ctx.reply(`❌ فشل الإرسال.\nالخطأ: ${err.message}`);
            }
        }
    } finally {
        if (page) await page.close().catch(e => console.log(e));
        if (context) await context.close().catch(e => console.log(e));
    }
}

getBrowser().then(() => {
    bot.launch({ dropPendingUpdates: true });
    console.log("🤖 بوت التليجرام يعمل الآن.");
}).catch(err => console.error("❌ فشل تشغيل النظام:", err));

process.once('SIGINT', async () => { if (globalBrowser) await globalBrowser.close(); bot.stop('SIGINT'); });
process.once('SIGTERM', async () => { if (globalBrowser) await globalBrowser.close(); bot.stop('SIGTERM'); });
