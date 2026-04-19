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

// --- الواجهات الجذابة ---
const mainMenu = Markup.keyboard([
    ['🚀 إرسال طلب دعم جديد', '📊 حالة السيرفر'],
    ['❌ إلغاء العملية']
]).resize();

const countryMenu = Markup.inlineKeyboard([
    [Markup.button.callback('🇾🇪 اليمن (+967)', 'set_code_+967'), Markup.button.callback('🇸🇦 السعودية (+966)', 'set_code_+966')],
    [Markup.button.callback('🇪🇬 مصر (+20)', 'set_code_+20'), Markup.button.callback('🌐 رمز آخر (يدوي)', 'set_code_manual')],
    [Markup.button.callback('🚫 إلغاء', 'cancel_task')]
]);

// --- وظائف مساعدة ---
const randomDelay = (min = 40, max = 90) => Math.floor(Math.random() * (max - min + 1) + min);
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

let globalBrowser;

// --- الإدارة الذكية للمتصفح ---
async function getBrowser() {
    if (globalBrowser && globalBrowser.connected) {
        return globalBrowser;
    }
    console.log("🔄 جاري تهيئة محرك المتصفح...");
    try {
        globalBrowser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions'
            ]
        });
        console.log("✅ المتصفح الاحترافي جاهز للعمل.");
        return globalBrowser;
    } catch (e) {
        console.error("❌ خطأ في تشغيل المتصفح:", e);
        throw e;
    }
}

// حماية البوت
bot.use(async (ctx, next) => {
    if (ctx.from && ctx.from.id === MY_TELEGRAM_ID) {
        try { await next(); } catch (err) { console.error("Error:", err); }
    }
});

bot.start(async (ctx) => {
    delete userState[ctx.from.id];
    await ctx.replyWithHTML(
        `<b>مرحباً بك سيدي في لوحة التحكم VIP 👑</b>\n\n` +
        `<i>النظام جاهز للعمل مع التحديث الذكي لرموز الدول.</i>`, 
        mainMenu
    );
});

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
    await ctx.replyWithHTML('<b>🌍 الخطوة 1:</b> اختر الدولة المستهدفة:', countryMenu);
});

bot.action(/set_code_(.+)/, async (ctx) => {
    const code = ctx.match[1];
    const state = userState[ctx.from.id];
    
    if (!state) return ctx.answerCbQuery('⚠️ الجلسة منتهية.', { show_alert: true });

    if (code === 'manual') {
        state.countryCode = '';
        state.step = 'get_cc';
        await ctx.editMessageText('📝 أرسل رمز الدولة فقط (مثال: 967 بدون علامة +):');
    } else {
        state.countryCode = code.replace('+', ''); // استخراج الرمز فقط
        state.step = 'get_phone';
        await ctx.editMessageText(`✅ تم اختيار الرمز (+${state.countryCode})\n\n<b>الآن أرسل رقم الهاتف فقط (بدون رمز الدولة):</b>\nمثال: <code>771596288</code>`, { parse_mode: 'HTML' });
    }
    await ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
    const state = userState[ctx.from.id];
    if (!state) return;
    const text = ctx.message.text.trim();

    if (['🚀 إرسال طلب دعم جديد', '📊 حالة السيرفر', '❌ إلغاء العملية'].includes(text)) return;

    if (state.step === 'get_cc') {
        state.countryCode = text.replace('+', '');
        state.step = 'get_phone';
        await ctx.replyWithHTML(`<b>✅ تم الحفظ (+${state.countryCode}).\n\nالآن أرسل رقم الهاتف فقط (بدون رمز الدولة):</b>\nمثال: <code>771596288</code>`);
    }
    else if (state.step === 'get_phone') {
        state.nationalNumber = text.replace(/[^0-9]/g, ''); // استخراج الأرقام فقط
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
    
    await ctx.editMessageText('🔄 <b>جاري تشغيل محرك VIP وإرسال الطلب... الرجاء الانتظار قليلاً⏳</b>', { parse_mode: 'HTML' });
    
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
        
        await page.setViewport({ width: 1280, height: 800 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en-US,en;q=0.9' });
        const desktopUA = new UserAgent({ deviceCategory: 'desktop' }).toString();
        await page.setUserAgent(desktopUA);
        
        await page.goto('https://www.whatsapp.com/contact/noclient/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        await page.waitForFunction(() => {
            const textInputs = Array.from(document.querySelectorAll('input')).filter(
                i => (i.type === 'text' || i.type === 'tel' || i.type === 'email') && i.offsetHeight > 0
            );
            return textInputs.length >= 3;
        }, { timeout: 30000 });

        // 1. تغيير القائمة المنسدلة لرمز الدولة برمجياً
        await page.evaluate((cc) => {
            const selects = document.querySelectorAll('select');
            for (let select of selects) {
                const options = Array.from(select.options);
                const option = options.find(opt => opt.value === cc || opt.text.includes(`+${cc}`) || opt.text.includes(`(+${cc})`));
                if (option) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            }
            return false;
        }, countryCode);

        // الانتظار قليلاً ليتم تحديث الصفحة
        await new Promise(r => setTimeout(r, 1000));

        const inputs = await page.$$('input');
        const visibleTextInputs = [];
        for (const input of inputs) {
            const type = await input.evaluate(el => el.type);
            const isVisible = await input.evaluate(el => el.offsetHeight > 0 && el.offsetWidth > 0);
            if ((type === 'text' || type === 'tel' || type === 'email') && isVisible) {
                visibleTextInputs.push(input);
            }
        }

        if (visibleTextInputs.length >= 3) {
            // مسح الخانة أولاً ثم كتابة الرقم الصافي (بدون رمز الدولة)
            await visibleTextInputs[0].click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await visibleTextInputs[0].type(nationalNumber, { delay: randomDelay() });
            
            await visibleTextInputs[1].type(email, { delay: randomDelay() });
            await visibleTextInputs[2].type(email, { delay: randomDelay() });
        } else {
            throw new Error("تغير تصميم صفحة واتساب ولم أتمكن من إيجاد حقول النص.");
        }
        
        // 2. اختيار أندرويد وكتابة الرسالة
        const androidRadio = await page.$('input[type="radio"][value="android"]') || (await page.$$('input[type="radio"]'))[0];
        if (androidRadio) await androidRadio.click();
        
        await page.waitForSelector('textarea', { timeout: 10000 });
        await page.type('textarea', customMsg, { delay: randomDelay(20, 50) });
        
        // 3. النقر على الزر للمرور للصفحة التالية
        let submitButton = await page.$('button[type="submit"]');
        if (!submitButton) {
            const buttons = await page.$$('button');
            submitButton = buttons[buttons.length - 1]; 
        }
        if (submitButton) await submitButton.click();
        
        // 4. الانتظار حتى تفتح صفحة المقالات (الصفحة الثانية)
        await new Promise(r => setTimeout(r, 6000));
        
        // 5. البحث بذكاء عن زر "إرسال سؤال" والنقر عليه
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            // البحث العكسي لضمان جلب الزر الأخير الخاص بالإرسال
            const sendBtn = buttons.reverse().find(b => 
                b.innerText.includes('إرسال') || 
                b.innerText.toLowerCase().includes('send') || 
                b.innerText.toLowerCase().includes('enviar')
            );
            if (sendBtn) {
                sendBtn.click();
            }
        });

        // 6. الانتظار حتى تفتح صفحة النجاح (الصح الأخضر)
        await new Promise(r => setTimeout(r, 6000));

        // 7. التقاط صورة النجاح وإرسالها للتليجرام
        const successScreenshotPath = `success_${Date.now()}.png`;
        await page.screenshot({ path: successScreenshotPath, fullPage: true });

        await ctx.replyWithPhoto(
            { source: successScreenshotPath }, 
            { 
                caption: `✅ <b>تم الإرسال بنجاح سيدي!</b>\n\n📱 الرقم: <code>${fullPhone}</code>\n\n📸 إليك الدليل من داخل سيرفرات واتساب على إتمام العملية.`, 
                parse_mode: 'HTML' 
            }
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
            } catch (screenshotErr) {
                await ctx.reply(`❌ فشل الإرسال ولم أتمكن من التقاط صورة.\nالخطأ: ${err.message}`);
            }
        } else {
            await ctx.reply(`❌ فشل الاتصال بالمحرك: ${err.message}`);
        }
    } finally {
        if (page) await page.close().catch(e => console.log(e));
        if (context) await context.close().catch(e => console.log(e));
    }
}

// تشغيل البوت وتهيئة المتصفح
getBrowser().then(() => {
    bot.launch({ dropPendingUpdates: true });
    console.log("🤖 بوت التليجرام يعمل الآن.");
}).catch(err => console.error("❌ فشل تشغيل النظام:", err));

// --- الإغلاق الآمن للموارد ---
process.once('SIGINT', async () => {
    if (globalBrowser) await globalBrowser.close();
    bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
    if (globalBrowser) await globalBrowser.close();
    bot.stop('SIGTERM');
});
