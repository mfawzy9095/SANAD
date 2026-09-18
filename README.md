# SANAD — Full Master Android

هذا الـRepository يحتوي الآن على **Full Master Android snapshot** المبني من مشروع SANAD الكامل المسترجع، وليس الـMVP القديم.

## المصدر المعتمد
- `SANAD_ANDROID_FULL_BUILD.tar.xz` — مشروع Android Studio الكامل القابل للبناء.
- `.github/workflows/build-apk.yml` — يبني الـAPK من نفس الـsnapshot على GitHub Actions.
- لا توجد صلاحية `INTERNET` داخل التطبيق.

## الخصائص الموجودة في الـMaster
Arabic/English + RTL/LTR، Light/Dark، Transactions/Search/Filters، Budgets وCategory Budgets، Accounts/Cards، Custom Categories، Keywords/Auto-learning، Multi-currency، Bulk bank message parsing، Financial Plan، Safe-to-Spend، Savings Goals، Recurring Bills، Debts/Installments، JSON Backup/Restore، Native Offline Voice bridge، وBank Notification Access للمراجعة.

## APK
افتح Actions > **Build SANAD Full Master APK**. عند نجاح البناء يظهر Artifact باسم `SANAD-FULL-MASTER-APK`.

> النسخ القديمة الموجودة في الـrepo تُعتبر أرشيفًا تقنيًا فقط. البناء الحالي يعتمد على Full Master snapshot.
