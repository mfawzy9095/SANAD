(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadI18nCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function createI18nCore(){
    return {
  lang:'ar',
  exact:{
    'الرئيسية':'Home','المعاملات':'Transactions','الحسابات':'Accounts','الالتزامات':'Recurring','التقارير':'Reports','الإعدادات':'Settings',
    'عام':'General','الوضع الفاتح':'Appearance','إخفاء المبالغ':'Hide amounts','الإشعارات':'Notifications','تعمل أثناء فتح التطبيق فقط':'Works while the app is open','تنبيهات الالتزامات حتى عند إغلاق التطبيق':'Recurring reminders even when the app is closed',
    'البلد الافتراضية':'Default country','يبدأ التطبيق بهذه البلد عند فتحه.':'The app opens with this country.','الالتزامات والاشتراكات':'Recurring & subscriptions','إدارة الالتزامات':'Manage recurring items',
    'الادخار':'Savings','هدف الادخار':'Savings goal','لم يُحدد':'Not set','التصنيفات والأشخاص':'Categories & people','فئات المصاريف':'Expense categories','فئات الدخل':'Income categories','الأشخاص':'People','الوسوم':'Tags',
    'نسخ احتياطية تلقائية':'Automatic snapshots','البيانات':'Data','تصدير نسخة احتياطية':'Export financial backup','استيراد نسخة احتياطية':'Import financial backup','حذف كل البيانات':'Delete all data','إعادة ضبط البيانات المالية':'Reset financial data','حذف SANAD بالكامل من الجهاز':'Securely erase SANAD from this device','إعادة الضبط':'Reset','متابعة الحذف':'Continue erase','لم يتم التحقق — لم يبدأ الحذف':'Verification failed — erase did not start','تعذر إكمال الحذف الآمن':'Secure erase could not be completed',
    'المصروفات':'Expenses','الدخل':'Income','مصروف':'Expense','دخل':'Income','تحويل':'Transfer','متكرر':'Recurring','مصروف جديد':'New expense','دخل جديد':'New income','تعديل مصروف':'Edit expense','تعديل دخل':'Edit income',
    'إضافة جديدة':'Add new','فلوس خرجت مني':'Money I spent','فلوس دخلت عندي':'Money I received','بين حساباتي أو لشخص':'Between my accounts or to a person','شهري أو سنوي':'Monthly or yearly',
    'المبلغ':'Amount','المبلغ الأساسي':'Principal amount','العملة':'Currency','الفئة':'Category','مصدر الدخل':'Income source','ملاحظة':'Note','اختياري':'Optional','التاريخ':'Date','اليوم':'Today','أمس':'Yesterday','تاريخ آخر':'Other date',
    'تفاصيل إضافية':'More details','وسوم':'Tags','اكتب واضغط Enter':'Type and press Enter','يتكرر':'Repeats','التكرار':'Frequency','شهري':'Monthly','سنوي':'Yearly','الشهر':'Month','يوم الاستحقاق (1-28)':'Due day (1-28)',
    'إضافة المصروف':'Add expense','إضافة الدخل':'Add income','حفظ التعديلات':'Save changes','حفظ':'Save','إضافة':'Add','حذف':'Delete','إلغاء':'Cancel','تأكيد':'Confirm','حسناً':'OK',
    'الحساب الأساسي':'Primary account','كل الحسابات':'All accounts','متاح في البلد':'Available in country','مصروف هذا الشهر':'Spent this month','تحويلات خارج البلد':'Outbound transfers','المديونيات':'Liabilities','عليك':'You owe',
    'التزامات قادمة':'Upcoming recurring','عرض الكل':'View all','تنبيهات الإنفاق':'Spending alerts','إضافة سريعة':'Quick add','آخر المعاملات':'Recent transactions','لا توجد معاملات':'No transactions','اضغط ＋ لتسجيل أول مصروف':'Tap + to add your first expense',
    'بطاقات':'Cards','البطاقات':'Cards','الحسابات':'Accounts','دفعت من':'Paid from','دفعت من (حساب)':'Paid from (account)','دفعت من (بطاقة)':'Paid from (card)','إلى حساب':'To account','دفعت في':'Spent in','إلى بلد':'To country',
    'لا توجد بطاقات':'No cards','لا توجد حسابات':'No accounts','التبديل إلى الحسابات':'Switch to accounts','حساب بنكي':'Bank account','كاش':'Cash','محفظة إلكترونية':'E-wallet','رصيد مدفوع مقدمًا':'Prepaid balance','حساب بطاقة ائتمان':'Credit card account','دين / قرض':'Debt / loan','أخرى':'Other',
    'بطاقة ديبت':'Debit card','بطاقة ائتمان':'Credit card','بطاقة مدفوعة مقدمًا':'Prepaid card','تسحب من الحساب البنكي':'Uses linked bank balance','مشتريات تصبح مديونية':'Purchases become debt','تشحنها وتصرف منها':'Top up and spend',
    'طعام':'Food','مواصلات':'Transport','فواتير':'Bills','تسوق':'Shopping','صحة':'Health','ترفيه':'Entertainment','تعليم':'Education','منزل':'Home','مقهى':'Cafe','بقالة':'Groceries','اشتراكات':'Subscriptions','رسوم تحويل':'Transfer fee','تحويل لشخص':'Transfer to person','فوائد / رسوم دين':'Debt interest / fees','راتب':'Salary','مكافأة':'Bonus','عمل حر':'Freelance','هدية':'Gift','إيجار مستلم':'Rent received',
    'الإمارات':'UAE','مصر':'Egypt','المغرب':'Morocco','أخرى':'Other','جنيه مصري':'Egyptian pound','درهم إماراتي':'UAE dirham','دولار أمريكي':'US dollar','يورو':'Euro','ريال سعودي':'Saudi riyal','درهم مغربي':'Moroccan dirham',
    'تفاصيل المعاملة':'Transaction details','النوع':'Type','الحساب':'Account','البلد':'Country','البطاقة':'Card','تعديل':'Edit','حذف المعاملة':'Delete transaction','سيتم حذفها نهائياً':'It will be permanently deleted',
    'تسوية':'Adjustment','تحويل بين بلدين':'Cross-country transfer','تحويل بين حسابي':'Transfer between my accounts','سداد بطاقة':'Card repayment','سداد دين':'Debt repayment','المبلغ المرسل':'Sent amount','المبلغ الواصل':'Received amount','السعر':'Rate','الرسوم':'Fees','فوائد / رسوم':'Interest / fees',
    'إدارة أموالك بذكاء وأمان':'Manage your money intelligently and securely','اللغة':'Language','العربية':'Arabic','English':'English','المظهر':'Appearance','فاتح':'Light','داكن':'Dark','حسب الجهاز':'System','الأمان والخصوصية':'Security & privacy','قفل بالبصمة / الجهاز':'Biometric / device lock','غير مفعّل':'Disabled','مفعّل':'Enabled',
    'الحساب والمزامنة':'Account & sync','تسجيل الدخول بحساب Google':'Sign in with Google','تسجيل الخروج':'Sign out','مزامنة الآن':'Sync now','إعداد Firebase':'Configure Firebase','غير متصل':'Not connected','متصل':'Connected','العائلة والمشاركة':'Family & sharing','إدارة العائلة':'Manage family','لا توجد عائلة':'No family yet',
    'الفواتير والمرفقات':'Receipts & attachments','إرفاق فاتورة':'Attach receipt','تصوير فاتورة':'Capture receipt','اختيار صورة':'Choose image','إزالة الفاتورة':'Remove receipt','فاتورة مرفقة':'Receipt attached','لا توجد فاتورة':'No receipt attached',
    'العائلة':'Family','أنشئ مساحة مشتركة اختيارية':'Create an optional shared space','لا توجد معاملات مشتركة':'No shared transactions','سيظهر الأعضاء بعد المزامنة':'Members will appear after sync',
    'إضافة حساب':'Add account','أضف حساب':'Add account','أضف حسابًا':'Add account','أضف حساباً':'Add account','أضف بطاقة':'Add card','لا توجد نتائج':'No results','لا توجد حسابات في':'No accounts in','لا توجد التزامات في':'No recurring items in','التزاماتك المتكررة':'Your recurring items','اشتراكات، فواتير، راتب... التطبيق يفكرك قبل الموعد.':'Subscriptions, bills, salary... SANAD reminds you before the due date.',
    'وضع التجربة — البيانات مؤقتة وستُحذف عند إعادة تحميل الصفحة':'Preview mode — data is temporary and will be deleted when the page reloads','لا توجد حسابات':'No accounts','الحساب الأساسي في':'Primary account in','ملخص':'Summary','المزيد':'More',
    'نسخة احتياطية كاملة':'Full backup','تصدير كامل مع الفواتير':'Export full backup with receipts','استيراد نسخة كاملة':'Import full backup','وضع الحماية':'Protection mode','وضع القراءة فقط':'Read-only mode',
    'جاري إعادة المحاولة...':'Retrying…','تعذر الحفظ':'Could not save','تم الحفظ':'Saved','تم التعديل':'Updated','تمت الإضافة':'Added','تم تسجيل الدخل':'Income recorded','تم التصدير':'Exported','تم الاستيراد':'Imported','تم الحذف':'Deleted',
    'أسبوع':'Week','شهر':'Month','6 أشهر':'6 months','متوسط المعاملة':'Average transaction','الصافي':'Net','حد الإنفاق الشهري الكلي':'Overall monthly spending limit','تحديد':'Set','لم يتم تحديد حد':'No limit set','حدود الفئات':'Category limits','لم يتم تحديد حدود. اضغط تعديل لإضافة حد.':'No category limits set. Tap Edit to add one.','حسب الفئة':'By category','لا توجد بيانات':'No data','المخطط':'Chart',
    'أساسي':'Primary','افتراضي':'Default','حساب':'Account','اللغة والمظهر':'Language & appearance','فاتح، داكن أو حسب الجهاز':'Light, dark, or system','يحتاج HTTPS':'requires HTTPS','لم تتم المزامنة بعد':'Not synced yet','مطلوب لتفعيل السحابة':'Required to enable cloud sync','الإصدار':'version',
    'أنشئ مساحة مشتركة للعائلة. معاملاتك الخاصة تظل خاصة ما لم تفعّل المشاركة للمعاملة.':'Create a shared family space. Your private transactions stay private unless you explicitly share them.','اسم العائلة':'Family name','إنشاء عائلة':'Create family','قبول دعوة برقم هاتفي':'Accept invite using my phone number','المعاملات المشتركة':'Shared transactions','الأعضاء':'Members','دعوة برقم الهاتف (E.164)':'Invite by phone (E.164)','دعوة':'Invite',
    'ألصق Firebase Web config من Project settings. لا يتم إرسال الإعداد لأي جهة أخرى.':'Paste the Firebase Web config from Project settings. The configuration is stored locally and is not sent elsewhere.','حفظ والاتصال':'Save & connect','تم إدخال الإعداد':'Configuration saved','رقم الهاتف':'Phone number','غير موثق':'Not verified',
    'فلترة':'Filters','الكل':'All','تحويل بين حساباتي':'Between my accounts','كل الفئات':'All categories','تفريغ':'Clear','تطبيق':'Apply','بطاقة مدفوعة':'Prepaid card','رصيد مسبق':'Prepaid balance','ابحث...':'Search…','بحث':'Search',
    'إضافة جديدة — الإمارات':'Add new — UAE','بطاقة جديدة':'New card','اختر الحساب البنكي المرتبط':'Choose the linked bank account','الحساب البنكي المرتبط':'Linked bank account','— اختر حساب بنكي —':'— Choose bank account —','البطاقة تسحب من هذا الحساب مباشرة.':'Card purchases are deducted directly from this account.','البلد':'Country','أو اكتب اسم جديد':'Or enter a new name','العملة مقفلة (توجد معاملات).':'Currency is locked because transactions exist.','مقفل (توجد معاملات).':'Locked because transactions exist.','الرصيد الحالي في البطاقة.':'Current card balance.','المبلغ عند الإضافة':'Amount at setup',
    'مصدر الرصيد الأول':'Initial balance source','الرصيد موجود بالفعل على البطاقة':'Balance already exists on the card','شحن من حساب موجود':'Fund from an existing account','اختيار التحويل يخصم المبلغ من الحساب ويضيفه للبطاقة كتحويل، وليس كمصروف.':'Funding deducts the amount from the selected account and adds it to the prepaid card as a transfer, not an expense.','حساب التمويل':'Funding account','— اختر حساب التمويل —':'— Choose funding account —','اكتب الرصيد الموجود حاليًا أو مبلغ الشحن الأول.':'Enter the existing card balance or the first top-up amount.','➕ شحن البطاقة من حساب':'➕ Top up card from an account','شحن بطاقة':'Card top-up','📷 تصوير / اختيار فاتورة':'📷 Capture / choose receipt',
    'حساب جديد':'New account','تعديل':'Edit','حساب مؤرشف':'Archived account','اسم الحساب':'Account name','البنك / المؤسسة':'Bank / institution','بدون':'None','— بدون —':'— None —','اتركه فاضي إذا لا تريد ربطه بجهة معينة.':'Leave blank if you do not want to link an institution.','الرصيد الافتتاحي':'Opening balance','رصيد الحساب عند تاريخ البداية.':'Account balance on the start date.','الأيقونة':'Icon','اللون':'Color','نوع الحساب مقفل — مرتبط ببطاقة ديبت.':'Account type is locked because a debit card is linked.','مقفل — استخدم "تعديل الرصيد الحقيقي".':'Locked — use “Adjust actual balance”.','قيمة الدين عند البداية':'Opening debt amount','الجهة الدائنة (اختياري)':'Creditor (optional)','تاريخ الاستحقاق (اختياري)':'Due date (optional)',
    '⭐ اجعله الحساب الافتراضي للمصروفات في الإمارات':'⭐ Make it the default spending account in UAE','يُستخدم في تسجيل المصروفات والدخل والتحويلات':'Used when recording expenses, income, and transfers','🏠 اجعله الحساب الأساسي في الرئيسية':'🏠 Make it the primary Home account','يظهر كبطاقة في الشاشة الرئيسية':'Shown as a card on Home',
    'نوع البطاقة':'Card type','تسحب مباشرة من حساب بنكي':'Uses a bank account balance','المشتريات تصبح مديونية وتسددها لاحقًا':'Purchases become debt and are repaid later','تشحن البطاقة أولًا ثم تصرف منها':'Top up the card before spending from it',
    'تذكير قبلها بـ (أيام) — 0 = نفس اليوم':'Reminder (days before) — 0 = same day','📷 تصوير / اختيار صورة':'📷 Capture / choose image',
    'تبديل البلد':'Switch country','أنت تتصفح حاليًا':'You are currently viewing','اختر بلدًا آخر لتبديل السياق.':'Choose another country to switch context.','إضافة حساب في بلد آخر':'Add account in another country',
    'التزام متكرر':'Recurring item','مصروف متكرر':'Recurring expense','اشتراك، إيجار، فاتورة':'Subscription, rent, or bill','دخل متكرر':'Recurring income','راتب، إيجار مستلم':'Salary or rent received','تعديل التزام':'Edit recurring item','الاسم':'Name','الحالة':'Status','نشط':'Active','غير نشط':'Inactive',
    'من حساب':'From account','إلى':'To','تصوير / اختيار فاتورة':'Capture / choose receipt','حساباتي':'My accounts','شخص آخر':'Another person','التحويل بين حساباتك لا يُحسب مصروفًا. رسوم التحويل فقط تُحسب.':'Transfers between your accounts are not counted as spending. Only transfer fees are counted.','حفظ التحويل':'Save transfer',
    'دين':'Debt','المتاح':'available',
    'السحابة والعائلة':'Cloud & family','مؤجل إلى V9.1':'Deferred to V9.1','معطّل في النسخة المحلية المستقرة':'Disabled in the Local Stable release','التطبيق مقفول لحماية خصوصيتك.':'SANAD is locked to protect your privacy.','استخدام رمز الاسترداد':'Use recovery code','فتح بالبصمة / قفل الجهاز':'Unlock with biometric / device lock','لا يتم حفظ أو إرسال بيانات بصمتك إلى SANAD.':'SANAD does not store or transmit biometric data.','بيانات القفل غير متاحة. أعد فتح SANAD عندما يعود التخزين الآمن.':'Lock data is unavailable. Reopen SANAD when persistent storage is available.','يحتاج القفل إلى HTTPS ومتصفح يدعم WebAuthn/Passkeys وتخزين محلي دائم.':'The lock requires HTTPS, WebAuthn/Passkeys, and persistent local storage.','تعذر حفظ إعدادات القفل':'Could not save lock settings',
    'الأشخاص للتحويلات الخارجية':'People for external transfers','أضف الأشخاص الذين تحوّل لهم بشكل متكرر.':'Add people you transfer money to regularly.','شخص جديد':'New person','العملة الافتراضية':'Default currency',
    'مخصصة':'Custom','تعديل فئة':'Edit category','يعني إيه وسوم؟':'What are tags?','زي الهاشتاج — تجمّع تحتها معاملات مرتبطة.':'Like hashtags — group related transactions together.','وسم جديد':'New tag','اسم الوسم':'Tag name',
    'المبلغ المستهدف':'Target amount','المدخر حالياً (يدوي)':'Saved so far (manual)','هذا الرقم لا يُحسب تلقائياً.':'This number is not calculated automatically.','تاريخ مستهدف (اختياري)':'Target date (optional)','إضافة للادخار':'Add to savings',
    'عليك الآن':'Current debt','تسجيل السداد':'Record repayment','تعديل بطاقة':'Edit card','اسم البطاقة':'Card name','المديونية عند البداية':'Opening debt','قيمة الدين عند البداية.':'Debt amount at the start date.','حد البطاقة':'Card limit','حساب السداد الافتراضي (اختياري)':'Default repayment account (optional)','— اختياري —':'— Optional —','يُحفظ على حساب البطاقة (وليس على البطاقة نفسها).':'Stored on the card account, not on the physical card.','آخر 4 أرقام (اختياري)':'Last 4 digits (optional)','⭐ اجعلها البطاقة الافتراضية للمصروفات':'⭐ Make it the default spending card','تُستخدم تلقائياً عند تسجيل مصروف في الإمارات':'Used automatically when recording an expense in UAE','💸 سداد البطاقة':'💸 Repay card','⚖️ تسوية المديونية':'⚖️ Reconcile debt',
    'من':'of','مدفوعات شهرية':'Monthly payments','دخل شهري':'Monthly income','مدفوعات متكررة':'Recurring payments','دخل متكرر':'Recurring income','متوقف':'Paused','وسيلة غير متاحة':'Payment source unavailable','غداً':'Tomorrow',
    'حركة الأموال':'Money movement','تحويلات داخلة (نفس البلد)':'Incoming transfers (same country)','تحويلات خارجة (نفس البلد)':'Outgoing transfers (same country)','تحويلات واردة (خارج البلد)':'Incoming transfers (cross-country)','تحويلات صادرة (خارج البلد)':'Outgoing transfers (cross-country)','تحويلات داخل البلد':'Domestic transfers','تحويلات خارج البلد':'Outbound transfers','تحويلات واردة':'Incoming transfers','لا توجد':'None',
    'ملخص البطاقة':'Card summary','المديونية الحالية':'Current debt','الحد الائتماني':'Credit limit','مشتريات الفترة':'Purchases in period','سداد الفترة (أصل)':'Repayments in period (principal)','بدون حد':'No limit','الإجمالي':'Total','المصروف':'Expenses','معاملة':'transaction','التوزيع':'Distribution',
    'الديون':'Debts','المؤرشفة':'Archived','استرجاع':'Restore','بطاقة مؤرشفة':'Archived card','أضف كاش':'Add cash','مصدر الكاش الأول':'Initial cash source','الكاش موجود عندي بالفعل':'Cash already on hand','سحب / نقل من حساب موجود':'Transfer from an existing account','لو اخترت حسابًا، SANAD يسجلها كتحويل حتى لا تتضاعف أموالك.':'If you choose an account, SANAD records a transfer so your money is not double-counted.','تمويل كاش':'Cash funding','أدخل مبلغ الكاش':'Enter cash amount','تمويل الكاش الأول يجب أن يكون من حساب بنفس العملة':'Initial cash funding must use an account with the same currency',
    'لا يوجد مديونية':'No debt','لا توجد مديونية':'No debt','لا توجد مديونيات':'No liabilities','لا يوجد أشخاص بعد':'No people yet','إضافة شخص':'Add person','لا يوجد فرق':'No difference','أضف حساباً أولاً للسداد':'Add an account first for repayment','أضف حسابًا يمكن الشحن منه أولاً':'Add an account that can fund the top-up first','غير محدد':'Not set','الحد':'Limit','لا يوجد':'None','بطاقة':'Card','افتراضية':'Default','رسوم':'Fees','سداد':'Repay',
    'أرشفة':'Archive','أرشفة الحساب':'Archive account','أرشفة البطاقة':'Archive card','استرجاع الحساب':'Restore account','حذف الحساب':'Delete account','حذف البطاقة':'Delete card','تعديل الرصيد الحقيقي':'Adjust actual balance',
    'لا يظهر في الإدخال الجديد.':'It does not appear in new entries.','هذا هو':'This is','للمصروفات.':'for expenses.','في الرئيسية.':'on Home.',
    'اختر الحساب البنكي المرتبط. البلد والعملة والبنك يُشتقّون تلقائيًا.':'Choose the linked bank account. Country, currency, and institution are set automatically.','مقفل لأن بالبطاقة معاملات.':'Locked because the card has transactions.',
    'يمكنك ترك المبلغ 0 لربط حساب التمويل بدون تسجيل شحن أولي.':'You can leave the amount at 0 to link the funding account without recording an initial top-up.',
    'أدخل اسم البطاقة':'Enter the card name','أدخل الاسم':'Enter a name','أدخل مبلغاً صحيحاً':'Enter a valid amount','اختر وسيلة دفع':'Choose a payment source','اختر حساباً':'Choose an account','أدخل سعر تحويل صحيح':'Enter a valid exchange rate',
    'أضف حساباً أو بطاقة أولاً':'Add an account or card first','البيانات تالفة':'Data is corrupted','التخزين غير متاح':'Storage is unavailable','تم رفض الحفظ لحماية سلامة البيانات':'Save was blocked to protect data integrity','فشل الحفظ — تم التراجع':'Save failed — changes were rolled back',
    'الرصيد غير كافٍ في البطاقة/الحساب المدفوع مقدمًا':'Insufficient prepaid card/account balance','تعذر تسجيل بعض المعاملات لعدم كفاية الرصيد':'Some transactions could not be recorded because of insufficient balance',
    'حذف الالتزام':'Delete recurring item','سيتم الحذف نهائياً':'It will be permanently deleted','مصروف متكرر جديد':'New recurring expense','دخل متكرر جديد':'New recurring income','لا يوجد فوات':'Nothing overdue',
    'هذه رسوم مرتبطة بسداد — عدّلها من السداد':'These fees are linked to a repayment — edit them from the repayment','لا يمكن تعديل التسويات':'Adjustments cannot be edited',
    'اختر حساب تمويل صالح':'Choose a valid funding account','الشحن الأول يجب أن يكون من حساب بنفس عملة البطاقة':'The initial top-up must use an account in the same currency','رصيد حساب التمويل غير كافٍ':'The funding account balance is insufficient',
    'الحساب غير موجود':'Account not found','بطاقة الديبت ترتبط بحساب بنكي فقط':'A debit card can only be linked to a bank account','المديونية الافتتاحية لا يمكن أن تكون سالبة':'Opening debt cannot be negative','حد البطاقة لا يمكن أن يكون سالبًا':'Card limit cannot be negative','الرصيد الافتتاحي للبطاقة المدفوعة لا يمكن أن يكون سالبًا':'Prepaid opening balance cannot be negative',
    'حساب مؤرشف':'Archived account','هذا هو الحساب الافتراضي للمصروفات.':'This is the default spending account.','هذا هو الحساب الأساسي في الرئيسية.':'This is the primary Home account.','مقفل لأن بالبطاقة معاملات':'Locked because the card has transactions',
    'قيمة الدين عند بداية استخدام التطبيق.':'Debt amount when you started using SANAD.','الشهر (للسنوي)':'Month (yearly)','إعادة المحاولة':'Retry','لا يمكن أرشفة الحساب':'Account cannot be archived','لا يمكن حذف الحساب':'Account cannot be deleted','لا يمكن أرشفة البطاقة':'Card cannot be archived',
        'حساباتك في كل بلد':'Your accounts in every country','نظّم حساباتك حسب البلد — الإمارات، مصر، المغرب.':'Organize your accounts by country — UAE, Egypt, and Morocco.','بطاقاتك وحساباتك':'Your cards and accounts','ديبت تسحب من حسابها. الكريدت دين. الكاش والمحفظة أرصدة حقيقية.':'Debit cards use their linked account. Credit cards create debt. Cash and wallets hold real balances.','ديبت تسحب من حسابها. الكريدت دين. والمحفظة والأرصدة المدفوعة مقدمًا أرصدة حقيقية.':'Debit cards use their linked account. Credit cards create debt. Wallets and prepaid balances hold real balances.','حدود إنفاق ذكية':'Smart spending limits','حدد ميزانية لكل فئة، وسننبهك قبل أن تتجاوزها.':'Set a budget for each category and SANAD will warn you before you exceed it.','التالي':'Next','تخطي':'Skip',
    '+ إضافة':'+ Add','⭐ افتراضية':'⭐ Default','⭐ أساسي':'⭐ Primary','افتراضي':'Default','بطاقة مؤرشفة':'Archived card','حساب مؤرشف':'Archived account','لا توجد':'None','إعادة المحاولة':'Retry','تعديل الرصيد الحقيقي':'Adjust actual balance','سداد':'Repay','تسوية المديونية':'Reconcile debt',
    'هذا هو':'This is','الحساب الافتراضي':'default account','الحساب الأساسي':'primary account','لا يظهر في الإدخال الجديد.':'It will not appear in new entries.','أضف الأشخاص الذين تحوّل لهم بشكل متكرر.':'Add people you transfer to regularly.','لا توجد حسابات':'No accounts','لا توجد بطاقات':'No cards',
    'مقفل — استخدم "تسوية المديونية".':'Locked — use “Reconcile debt”.','مقفل — استخدم "تعديل الرصيد الحقيقي".':'Locked — use “Adjust actual balance”.','قيمة الدين عند بداية استخدام التطبيق.':'Debt amount when you started using SANAD.','رصيد الحساب عند تاريخ البداية.':'Account balance on the start date.',
    'اختيار التحويل يخصم المبلغ من الحساب ويضيفه للبطاقة كتحويل، وليس كمصروف.':'Choosing transfer deducts the amount from the funding account and adds it to the card as a transfer, not an expense.','الرصيد موجود بالفعل على البطاقة':'The balance already exists on the card','شحن من حساب موجود':'Fund from an existing account','المبلغ عند الإضافة':'Amount at setup',
        'يناير':'January','فبراير':'February','مارس':'March','أبريل':'April','مايو':'May','يونيو':'June','يوليو':'July','أغسطس':'August','سبتمبر':'September','أكتوبر':'October','نوفمبر':'November','ديسمبر':'December'
  },
  text(v){
    const s=String(v==null?'':v); if(this.lang!=='en') return s;
    const trim=s.trim(); if(!trim) return s;
    const atom=x=>this.exact[String(x).trim()]!==undefined?this.exact[String(x).trim()]:String(x).trim();
    let out=this.exact[trim];
    if(out===undefined){
      out=trim;
      let m=null;
      if((m=out.match(/^(\d+)\s+حساب(?:ات)?$/))) out=m[1]+' accounts';
      else if((m=out.match(/^(\d+)\s+بطاقة$/))) out=m[1]+' cards';
      else if((m=out.match(/^(\d+)\s+التزام$/))) out=m[1]+' recurring items';
      else if((m=out.match(/^(\d+)\s+شخص$/))) out=m[1]+' people';
      else if((m=out.match(/^(\d+)\s+وسم$/))) out=m[1]+' tags';
      else if((m=out.match(/^(\d+)\s+فئة$/))) out=m[1]+' categories';
      else if((m=out.match(/^(\d+)\s+معاملة$/))) out=m[1]+' transactions';
      else if((m=out.match(/^المصروف(?:ات)?\s*\(([^)]+)\)$/))) out='Expenses ('+m[1]+')';
      else if((m=out.match(/^([^\u0600-\u06FF]*)(جنيه مصري|درهم إماراتي|دولار أمريكي|يورو|ريال سعودي|درهم مغربي)\s*\([^)]+\)$/))){const cc={'جنيه مصري':'EGP','درهم إماراتي':'AED','دولار أمريكي':'USD','يورو':'EUR','ريال سعودي':'SAR','درهم مغربي':'MAD'};out=m[1]+atom(m[2])+' ('+cc[m[2]]+')';}
      else if((m=out.match(/^الدخل\s*\(([^)]+)\)$/))) out='Income ('+m[1]+')';
      else if((m=out.match(/^أ(\d+)$/))) out='W'+m[1];
      else if((m=out.match(/^لا توجد حسابات في\s+(.+)$/))) out='No accounts in '+atom(m[1]);
      else if((m=out.match(/^لا توجد بطاقات في\s+(.+)$/))) out='No cards in '+atom(m[1]);
      else if((m=out.match(/^أضف حساباً أو بطاقة في\s+(.+)$/))) out='Add an account or card in '+atom(m[1]);
      else if((m=out.match(/^أضف حساباً أولاً في\s+(.+)$/))) out='Add an account first in '+atom(m[1]);
      else if((m=out.match(/^أضف حساباً في\s+(.+)$/))) out='Add an account in '+atom(m[1]);
      else if((m=out.match(/^لم تحدّد حساباً أساسياً في\s+(.+)$/))) out='No primary account selected in '+atom(m[1]);
      else if((m=out.match(/^يستحق\s+(.+)$/))) out='Due '+m[1];
      else if((m=out.match(/^\+\s*رسوم\s+(.+)$/))) out='+ Fees '+m[1];
      else if((m=out.match(/^تحويل إلى\s+(.+)$/))) out='Transfer to '+m[1];
      else if((m=out.match(/^تحويل وارد من\s+(.+)$/))) out='Incoming transfer from '+m[1];
      else if((m=out.match(/^لا توجد التزامات في\s+(.+)$/))) out='No recurring items in '+atom(m[1]);
      else if((m=out.match(/^الحساب الأساسي في\s+(.+)$/))) out='Primary account in '+atom(m[1]);
      else if((m=out.match(/^ملخص\s+(.+)$/))) out='Summary · '+atom(m[1]);
      else if((m=out.match(/^متصل\s*·\s*(.+)$/))) out='Connected · '+m[1];
      else if((m=out.match(/^(.+?)\s*·\s*المتاح\s+(.+)$/))) out=atom(m[1])+' · available '+m[2];
      else if((m=out.match(/^(.+?)\s*·\s*(.+)$/)) && (this.exact[m[1].trim()]!==undefined || this.exact[m[2].trim()]!==undefined)) out=atom(m[1])+' · '+atom(m[2]);
      else if((m=out.match(/^([^\u0600-\u06FF]+)([\u0600-\u06FF].*)$/)) && this.exact[m[2].trim()]!==undefined) out=m[1]+atom(m[2]);
      else if((m=out.match(/^(.+?)\s*›$/)) && this.exact[m[1]]!==undefined) out=atom(m[1])+' ›';
      else if((m=out.match(/^(غير مفعّل|مفعّل)\s*·\s*(يحتاج HTTPS)$/))) out=atom(m[1])+' · '+atom(m[2]);
      else if((m=out.match(/^إضافة جديدة\s*—\s*(.+)$/))) out='Add new — '+atom(m[1]);
      else if((m=out.match(/^المبلغ\s*\(([^)]+)\)$/))) out='Amount ('+m[1]+')';
      else if((m=out.match(/^المبلغ المُضاف\s*\(([^)]+)\)$/))) out='Amount added ('+m[1]+')';
      else if((m=out.match(/^(\d+)\s+استخدام$/))) out=m[1]+' uses';
      else if((m=out.match(/^([^\u0600-\u06FF]*)(الإمارات|مصر|المغرب|أخرى)\s*·\s*(.+)$/))) out=m[1]+atom(m[2])+' · '+m[3];
      else if((m=out.match(/^(.+?)\s+دين$/))) out=m[1]+' debt';
      else if((m=out.match(/^Credit card\s*·\s*المتاح\s+(.+)$/))) out='Credit card · available '+m[1];
      else if((m=out.match(/^ستُخصم من\s+(.+?)\s+وسيُسدّد\s+(.+)$/))) out='Will be deducted from '+m[1]+' and '+m[2]+' will be repaid';
      else if((m=out.match(/^⭐ اجعله الحساب الافتراضي للمصروفات في\s+(.+)$/))) out='⭐ Make it the default spending account in '+atom(m[1]);
      else if((m=out.match(/^🏠 اجعله الحساب الأساسي في الرئيسية$/))) out='🏠 Make it the primary Home account';
      else if((m=out.match(/^تُستخدم تلقائياً عند تسجيل مصروف في\s+(.+)$/))) out='Used automatically when recording an expense in '+atom(m[1]);
      else if((m=out.match(/^حدود الفئات\s*—\s*(.+)$/))) out='Category limits — '+m[1];
      else if((m=out.match(/^بعد\s+(\d+)\s+أيام$/))) out='In '+m[1]+' days';
      else if((m=out.match(/^(\d+)\s+التزام فات موعده$/))) out=m[1]+' overdue recurring items';
      else if((m=out.match(/^تم تسجيل\s+(\d+)\s+معاملة$/))) out=m[1]+' transactions recorded';
      else if((m=out.match(/^تم تسجيل\s+(\d+)\s+معاملة\s+—\s+تعذر تسجيل\s+(\d+)\s+لعدم كفاية رصيد البطاقة المدفوعة مقدمًا$/))) out=m[1]+' transactions recorded — '+m[2]+' skipped due to insufficient prepaid balance';
      else if((m=out.match(/^يوم\s+(\d+)$/))) out='Day '+m[1];
      else if((m=out.match(/^تجاوزت الحد بـ\s+(.+)$/))) out='Over limit by '+m[1];
      else if((m=out.match(/^باقي\s+(.+)$/))) out='Remaining '+m[1];
      else if((m=out.match(/^SANAD\s*·\s*سند\s*·\s*الإصدار\s*(.+)$/))) out='SANAD · سند · version '+m[1];
    }
    return s.replace(trim,out);
  }
    };
  }

  return Object.freeze({createI18nCore});
});
