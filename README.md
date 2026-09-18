# SANAD — Full Master Android

هذا الـRepository يبني **SANAD Full Master** المسترجع، وليس الـMVP القديم.

## المصدر المعتمد
المشروع الكامل محفوظ كـ snapshot موثوق مقسّم تحت:
`full-master-parts/part_00 ... part_08`

GitHub Actions يعيد تجميعه، يتحقق من سلامة XZ، ثم يبني مشروع Android Studio الرسمي.

## الخصائص
Arabic/English + RTL/LTR، Light/Dark، Transactions/Search/Filters، Budgets وCategory Budgets، Accounts/Cards، Custom Categories، Keywords/Auto-learning، Multi-currency، Bank message parser، Financial Plan، Safe-to-Spend، Savings Goals، Recurring Bills، Debts/Installments، JSON Backup/Restore، Native Offline Voice bridge، وBank Notification Access.

## الخصوصية
التطبيق لا يطلب `android.permission.INTERNET`.

## APK
افتح Actions > **Build SANAD Full Master APK**. الـArtifact الناتج اسمه:
`SANAD-FULL-MASTER-APK`
