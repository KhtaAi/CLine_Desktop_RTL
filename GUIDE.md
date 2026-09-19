# 📘 راهنمای استفاده از cline-fa-rtl

## 🚀 نصب با یک دستور (بدون نیاز به git یا کلون)

روی **هر سیستم ویندوزی** فقط PowerShell را باز کنید و این دستور را اجرا کنید:

```powershell
iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1 | iex
```

این یک خط به‌طور خودکار:
1. Node.js را چک می‌کند (اگر نباشد با winget نصب می‌کند)
2. آخرین نسخه‌ی پروژه را از GitHub دانلود می‌کند
3. وابستگی‌ها (فونت وزیرمتن + brotli) را نصب می‌کند
4. پچ را روی **Cline Desktop** و **افزونه‌ی VS Code** (هر کدام که نصب باشد) اعمال می‌کند

✅ بعد از اتمام، Cline Desktop را باز کنید (و اگر افزونه VS Code را هم پچ کرده‌اید، آنجا را با `Ctrl+Shift+P` ← `Developer: Reload Window` ریلود کنید).

### گزینه‌های اختیاری

برای پاس دادن پارامتر، از الگوی زیر استفاده کنید (به‌جای `| iex`):

```powershell
# فقط Cline Desktop:
$s = [scriptblock]::Create((iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1).Content); & $s -Target desktop

# فقط افزونه‌ی VS Code:
$s = [scriptblock]::Create((iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1).Content); & $s -Target extension

# حذف کامل پچ (unpatch):
$s = [scriptblock]::Create((iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1).Content); & $s -Mode unpatch

# اگر cline-app.exe در مسیر غیرپیش‌فرض است:
$s = [scriptblock]::Create((iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1).Content); & $s -ExePath "D:\path\to\cline-app.exe"
```

| پارامتر | مقدارها | پیش‌فرض |
|---|---|---|
| `-Mode` | `patch` \| `repatch` \| `unpatch` | `patch` |
| `-Target` | `desktop` \| `extension` \| `both` | `both` |
| `-ExePath` | مسیر کامل `cline-app.exe` | `%LOCALAPPDATA%\Cline\cline-app.exe` |

> پروژه در `%LOCALAPPDATA%\cline-fa-rtl` نصب می‌شود تا دفعات بعدی نیز قابل استفاده باشد.

---

## 🔄 بعد از هر آپدیت Cline Desktop

هر بار که Cline Desktop آپدیت می‌شود، فایل `cline-app.exe` بازنویسی می‌شود و پچ از بین می‌رود.

### دستور یک‌باره برای اعمال مجدد پچ:

```powershell
iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/repatch.ps1 | iex
```

این دستور آخرین نسخه‌ی پروژه را دانلود می‌کند و پچ را دوباره اعمال می‌کند. (اگر پروژه از قبل روی سیستم باشد، می‌توانید به‌جای دانلود مجدد، مستقیم در پوشه‌ی `%LOCALAPPDATA%\cline-fa-rtl` دستور `node bin/cline-desktop-rtl.js patch` را اجرا کنید.)

### چک‌لیست

```
۱. Cline Desktop را آپدیت کنید
۲. دستور repatch بالا را در PowerShell اجرا کنید
۳. Cline Desktop را باز کنید ✅
```

---

## ❓ رفع اشکال

| مشکل | راه‌حل |
|---|---|
| `iwr : Unable to connect` یا `404` | اتصال اینترنت را چک کنید؛ گاهی نیاز به VPN/پروکسی است |
| اجرای اسکریپت بلاک شد (`running scripts is disabled`) | این دستور را یک‌بار اجرا کنید: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `Node.js is required` | Node.js LTS را از [nodejs.org](https://nodejs.org) نصب کنید |
| `cline-app.exe not found` | پارامتر `-ExePath` را با مسیر صحیح بدهید |
| پچ اعمال شد ولی تغییری ندیدم | Cline Desktop را کامل ببندید (System Tray هم) و دوباره باز کنید |
| پیدا نشدن `iwr` | از **PowerShell 5.1+** (Windows PowerShell یا PowerShell 7) استفاده کنید |
| می‌خواهم بدانم پچ اعمال شده یا نه | `node %LOCALAPPDATA%\cline-fa-rtl\bin\cline-desktop-rtl.js info` |

---

## 📋 خلاصه‌ی همه‌ی دستورها

| کار | دستور |
|---|---|
| نصب روی سیستم جدید | `iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1 \| iex` |
| اعمال مجدد بعد از آپدیت | `iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/repatch.ps1 \| iex` |
| حذف پچ (دسکتاپ) | `node "$env:LOCALAPPDATA\cline-fa-rtl\bin\cline-desktop-rtl.js" unpatch` |
| حذف پچ (افزونه) | `node "$env:LOCALAPPDATA\cline-fa-rtl\bin\cline-fa-rtl.js" unpatch` |

## 🔒 امنیت

- پروژه فقط از ریپوی رسمی `KhtaAi/CLine_Desktop_RTL` دانلود می‌شود.
- قبل از هر تغییر، از `cline-app.exe` بکاپ گرفته می‌شود (`cline-app.exe.backup-before-fa-rtl`).
- اندازه‌ی فایل exe تغییر نمی‌کند و امضای دیجیتال آن حفظ می‌شود.
