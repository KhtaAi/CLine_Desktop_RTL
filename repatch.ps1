# cline-fa-rtl — اعمال مجدد پچ بعد از آپدیت Cline Desktop (بدون نیاز به git)
# Usage:
#   iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/repatch.ps1 | iex
#
# این اسکریپت همان install.ps1 را با حالت repatch اجرا می‌کند
# (پروژه را دانلود/به‌روز می‌کند و دوباره پچ را اعمال می‌کند).

Invoke-Expression (
  "& { " +
  (Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1').Content +
  " } -Mode repatch"
)
