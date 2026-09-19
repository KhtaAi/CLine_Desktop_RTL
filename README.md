# cline-fa-rtl 🇮🇷

نمایش متن فارسی در **Cline** با فونت **وزیرمتن (Vazirmatn)** و جهت **راست‌به‌چپ (RTL)** — فقط با **یک دستور ترمینال**.

Force **Cline** to render Persian/Farsi text with the **Vazirmatn** font and proper **RTL** direction — with a **single terminal command**, on any Windows machine.

---

## 🚀 نصب با یک دستور (بدون کلون کردن پروژه)

در **PowerShell** روی هر سیستم ویندوزی:

```powershell
iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1 | iex
```

این یک دستور به‌طور خودکار Node.js را چک می‌کند، پروژه را دانلود می‌کند، وابستگی‌ها را نصب می‌کند و پچ را روی **Cline Desktop** و **Cline Extension** اعمال می‌کند.

## 🔄 بعد از هر آپدیت Cline

```powershell
iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/repatch.ps1 | iex
```

> 📘 راهنمای کامل (نصب، گزینهها، رفع اشکال): **[GUIDE.md](GUIDE.md)**

---

| هدف | دستور (اجرای محلی) |
|---|---|
| **Cline Desktop** (برنامه ویندوزی `cline-app.exe`) | `node bin/cline-desktop-rtl.js patch` |
| **Cline Extension** (افزونه VS Code / Cursor / Windsurf) | `node bin/cline-fa-rtl.js patch` |

---

## ⚙️ چطور کار می‌کند؟ (Cline Desktop)

`cline-app.exe` یک باینری **Tauri v2** است که کل رابط کاربری (اپ Next.js) را بهصورت **brotli-compressed** داخل سکشن `.rdata` خود جاسازی کرده. این ابزار:

1. سکشن `.rdata` را اسکن می‌کند و ~۳۰۰ asset داخلی (CSS/JS/فونت) را پیدا می‌کند.
2. **CSS اصلی** (`/_next/static/chunks/…​.css`) را از brotli خارج می‌کند.
3. **قواعد Vazirmatn + RTL** را به ابتدای آن اضافه کرده، دوباره brotli می‌کند و **درجا** جایگزین می‌کند (بدون تغییر اندازه‌ی فایل).
4. **فونت‌های Vazirmatn** (woff2) را brotli-compress کرده و **جای دو فونت بزرگ Inter** (که معمولاً استفاده نمی‌شوند) قرار میدهد؛ آدرس، مسیر و طول رکورد PHF به‌روز می‌شود.
5. از exe یک **بکاپ** (`cline-app.exe.backup-before-fa-rtl`) می‌گیرد.

> چون فایل exe **تغییر اندازه نمی‌دهد** و امضای Authenticode دست‌نخورده می‌ماند، Windows آن را بدون هشدار اجرا میکند.

### CSS تزریق‌شونده

- `@font-face` وزیرمتن (وزن ۴۰۰ و ۷۰۰) با `unicode-range` عربی/فارسی
- فونت وزیرمتن برای کل UI (به‌جز بلوک‌های کد که مونواسپیس می‌مانند)
- `unicode-bidi: plaintext` → جهت هر پاراگراف خودکار از اولین حرف فارسی/لاتین تشخیص داده می‌شود
- `.cline-markdown`, `.cline-chat-message-content`, `.markdown` → `direction: rtl; text-align: right`
- کدها (`pre`, `code`, `monaco`, …) → همیشه **LTR** و چپ‌چین

---

## 🚀 Cline Extension (VS Code / Cursor / Windsurf)

```powershell
node bin/cline-fa-rtl.js patch
```

سپس VS Code را ریلود کنید (`Ctrl+Shift+P` ← `Developer: Reload Window`).

این نسخه فایل `webview-ui/build/assets/index.css` افزونه را پچ می‌کند. برای حذف: `node bin/cline-fa-rtl.js unpatch`

---

## 🖥️ استفاده روی سیستم دیگر (روش دستی)

```powershell
git clone https://github.com/KhtaAi/CLine_Desktop_RTL
cd CLine_Desktop_RTL
npm install
node bin/cline-desktop-rtl.js patch
```

> مسیر پیش‌فرض: `%LOCALAPPDATA%\Cline\cline-app.exe`
> مسیر دلخواه: `node bin/cline-desktop-rtl.js patch "D:\path\to\cline-app.exe"`

---

## ⚠️ نکات مهم

- **بعد از هر آپدیت Cline Desktop** فایل exe بازنویسی می‌شود → دوباره `patch` بزنید (idempotent است؛ روی exe پچ‌شده خودش skip می‌کند).
- **حذف کامل**: `node bin/cline-desktop-rtl.js unpatch` (از بکاپ بازمی‌گرداند).
- برای تغییر قواعد CSS: `assets/vazirmatn-desktop.css` را ویرایش و دوباره patch کنید.

## 📁 ساختار پروژه

```
cline-fa-rtl/
├── install.ps1                 # نصب‌کننده‌ی تک‌دستوری (بدون git)
├── repatch.ps1                 # اعمال مجدد پچ بعد از آپدیت
├── bin/
│   ├── cline-desktop-rtl.js    # CLI پچ Cline Desktop (باینری exe)
│   └── cline-fa-rtl.js         # CLI پچ افزونه VS Code
├── src/
│   ├── pe.js                   # پارسر PE (x64) و نگاشت RVA↔offset
│   ├── binary-patch.js         # کشف assetهای داخل .rdata + brotli
│   ├── desktop-patch.js        # منطق پچ exe (CSS + فونت، in-place)
│   ├── patch.js / unpatch.js   # پچ افزونه
│   └── common.js
├── assets/
│   ├── vazirmatn-desktop.css   # CSS تزریق‌شونده به Cline Desktop
│   └── vazirmatn.css           # CSS تزریقشونده به افزونه
├── GUIDE.md                    # راهنمای کامل فارسی
└── package.json
```

فونت Vazirmatn تحت لایسنس **OFL-1.1** منتشر می‌شود. لایسنس کد پروژه: **MIT** (به [LICENSE.md](LICENSE.md) مراجعه کنید).