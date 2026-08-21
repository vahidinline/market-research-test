/**
 * Mock data for fallback / demo mode when APIs are unavailable
 */

export const MOCK_PROFILES = [
  {
    username: 'targetbusiness',
    fullName: 'کسب‌وکار هدف',
    biography: 'بهترین خدمات در صنعت دکوراسیون کودک',
    followersCount: 12400,
    followingCount: 850,
    postsCount: 287,
    isVerified: false,
    engagementRate: 4.2,
  },
  {
    username: 'competitor1',
    fullName: 'رقیب اول',
    biography: 'تخصص در دکوراسیون اتاق کودک',
    followersCount: 28700,
    followingCount: 1200,
    postsCount: 542,
    isVerified: true,
    engagementRate: 3.1,
  },
  {
    username: 'competitor2',
    fullName: 'رقیب دوم',
    biography: 'لوازم کودک با کیفیت اروپایی',
    followersCount: 9300,
    followingCount: 620,
    postsCount: 198,
    isVerified: false,
    engagementRate: 5.8,
  },
];

export const MOCK_ANALYSIS = {
  industryOverview:
    'بازار دکوراسیون کودک در ایران در حال رشد قابل توجهی است و با افزایش آگاهی والدین نسبت به اهمیت محیط زندگی کودکان، تقاضا برای محصولات باکیفیت افزایش یافته است. رقابت در این بازار به‌ویژه در فضای آنلاین و اینستاگرام شدت گرفته و برندسازی قوی نقش کلیدی دارد.',
  marketCategories: [
    { name: 'رختخواب و ملحفه کودک', share: 35 },
    { name: 'دکور و تزئینات', share: 25 },
    { name: 'اسباب‌بازی و لوازم بازی', share: 20 },
    { name: 'لوازم ذخیره‌سازی', share: 12 },
    { name: 'نورپردازی و آباژور', share: 8 },
  ],
  competitorList: [
    {
      name: 'رقیب اول',
      instagramHandle: '@competitor1',
      website: 'www.competitor1.com',
      location: 'تهران',
      followers: 28700,
      verified: true,
    },
    {
      name: 'رقیب دوم',
      instagramHandle: '@competitor2',
      website: 'www.competitor2.com',
      location: 'اصفهان',
      followers: 9300,
      verified: false,
    },
  ],
  competitorAnalysis: [
    {
      name: 'رقیب اول',
      instagramHandle: '@competitor1',
      website: 'www.competitor1.com',
      location: 'تهران',
      activePlatforms: ['Instagram', 'Website', 'Telegram'],
      followers: 28700,
      posts: 542,
      engagementRate: '۳.۱٪',
      strengths: [
        'دنبال‌کننده زیاد و آگاهی از برند بالا',
        'محتوای منظم و باکیفیت',
        'تایید شده (Verified)',
      ],
      weaknesses: [
        'نرخ تعامل پایین‌تر نسبت به اندازه',
        'قیمت‌گذاری بالاتر از میانگین بازار',
      ],
      overallScore: 70,
      services: ['رختخواب', 'دکور', 'اسباب‌بازی', 'نورپردازی'],
      marketingActions: [
        'همکاری با اینفلوئنسرهای مادر',
        'کمپین‌های تخفیفی فصلی',
        'محتوای آموزشی دکوراسیون',
      ],
      instagramAnalytics: {
        firstPost: '۱۴۰۰/۰۲/۱۵',
        lastPost: '۱۴۰۳/۱۲/۲۰',
        totalPosts: 542,
        followers: 28700,
        engagementRate: 3.1,
        mediaDistribution: { photos: 65, videos: 20, carousels: 15 },
        contentAnalysis: {
          visualQuality: 'کیفیت بصری بسیار عالی با هارمونی رنگ‌های پاستلی و جذاب مناسب نوزادان.',
          creativity: 'خلاقیت متوسط در ایده‌پردازی با استفاده از چالش‌های ترند و چیدمان‌های گوناگون.',
          scriptTopic: 'سناریوها و موضوعات انتخاب‌شده متناسب با دغدغه مادران در طراحی اتاق نوزاد.',
          storytelling: 'روایت داستان برند و نحوه تولید محصولات نساجی به صورت گام‌به‌گام در ویدئوها.',
          bio: 'بیوگرافی کامل با وضوح شعار اصلی پیج و درج راه‌های ارتباطی مستقیم در لینک‌تری.',
          highlights: 'هایلایت‌های منظم با کاورهای یکدست شامل رضایت مشتری، قیمت‌ها و کاتالوگ.',
          layout: 'هارمونی چیدمان و رنگ پیج بسیار مناسب است اما کاور ویدئوها یکپارچگی لازم را ندارند.',
          captions: 'کپشن‌ها با لحن صمیمانه نوشته شده و در پایان دارای دعوت به اقدام (CTA) واضح هستند.'
        },
        bestContent: {
          title: 'تور ویدیویی اتاق کودک طراحی شده',
          link: 'https://instagram.com/p/example1',
        },
      },
      websiteAnalytics: {
        uxScore: 8,
        mobileFriendly: true,
        seoStatus: 'عالی',
        onlineBooking: true,
        liveSupport: false,
        narrative: 'دامنه این وب‌سایت با پسوند .com فعال است و سرعت بارگذاری بسیار بالایی دارد. تجربه کاربری (UX) سایت برای خرید سیسمونی کودک بسیار بهینه شده و مشتریان می‌توانند به راحتی در موبایل خرید خود را نهایی کنند. بخش مقالات بلاگ نیز به صورت مداوم با مباحث دکوراسیون اتاق نوزاد به‌روزرسانی می‌شود که تاثیر مثبتی در سئو ارگانیک داشته است. سیستم پرداخت آنلاین فعال و بدون مشکل عمل می‌کند.'
      },
    },
    {
      name: 'رقیب دوم',
      instagramHandle: '@competitor2',
      website: 'www.competitor2.com',
      location: 'اصفهان',
      activePlatforms: ['Instagram', 'Website'],
      followers: 9300,
      posts: 198,
      engagementRate: '۵.۸٪',
      strengths: ['نرخ تعامل بسیار بالا', 'محصولات متمایز با کیفیت اروپایی'],
      weaknesses: [
        'تعداد فالوور کمتر',
        'پوشش محدود در بازار',
        'محتوای کمتر نسبت به رقبا',
      ],
      overallScore: 60,
      services: ['رختخواب', 'دکور', 'لوازم ذخیره‌سازی'],
      marketingActions: ['تمرکز بر کیفیت محصول', 'محتوای UGC از مشتریان'],
      instagramAnalytics: {
        firstPost: '۱۴۰۱/۰۵/۱۰',
        lastPost: '۱۴۰۳/۱۲/۱۸',
        totalPosts: 198,
        followers: 9300,
        engagementRate: 5.8,
        mediaDistribution: { photos: 80, videos: 10, carousels: 10 },
        contentAnalysis: {
          visualQuality: 'کیفیت بصری قابل قبول با تمرکز مستقیم بر روی جزئیات فیزیکی محصول.',
          creativity: 'سطح خلاقیت پایین در عکس‌ها؛ بیشتر تصاویر به صورت ساده و عکاسی استودیویی هستند.',
          scriptTopic: 'ریل‌ها و ویدئوها فاقد سناریو یا قلاب‌های قوی برای جذب مخاطب جدید هستند.',
          storytelling: 'عدم استفاده از داستان‌گویی در روایت نحوه ساخت یا هویت برند.',
          bio: 'بیو پیج بسیار ساده بوده و جزئیات کمی در مورد شعار برند و مزیت رقابتی ارائه می‌دهد.',
          highlights: 'هایلایت‌ها فاقد کاور اختصاصی بوده و چیدمان منظمی ندارند.',
          layout: 'چیدمان پیج نامنظم است و رنگ سازمانی مشخصی در کاورها دیده نمی‌شود.',
          captions: 'کپشن‌ها بسیار کوتاه، فاقد ساختار استوری‌تلینگ و فقط حاوی قیمت و ابعاد محصول هستند.'
        },
        bestContent: {
          title: 'ست کامل رختخواب نوزاد',
          link: 'https://instagram.com/p/example2',
        },
      },
      websiteAnalytics: {
        uxScore: 5,
        mobileFriendly: false,
        seoStatus: 'ضعیف',
        onlineBooking: false,
        liveSupport: false,
        narrative: 'سایت رقیب دوم از پسوند ملی .ir استفاده می‌کند و فاقد گواهی امنیت HTTPS معتبر است. بهینه‌سازی وب‌سایت برای موبایل انجام نشده و چیدمان منوها در صفحات گوشی‌های همراه نامنظم است. محصولات به درستی دسته‌بندی نشده‌اند و خرید آنلاین به دلیل ضعف در درگاه پرداخت با کندی روبه‌رو است. وب‌سایت فاقد بخش بلاگ یا محتوای سئو شده است که منجر به رتبه پایین در سرچ گوگل گردیده است.'
      },
    },
  ],
  swot: {
    strengths: [
      'نرخ تعامل بالاتر از میانگین صنعت (۴.۲٪)',
      'وفاداری مشتریان فعلی قوی',
      'تنوع محصولات در سبد فروش',
    ],
    weaknesses: [
      'تعداد فالوور کمتر نسبت به رقیب اصلی',
      'عدم تایید اکانت اینستاگرام',
      'حضور ضعیف‌تر در وب‌سایت',
    ],
    opportunities: [
      'رشد سریع بازار دکوراسیون کودک در ایران',
      'استفاده از اینفلوئنسر مارکتینگ پدر و مادری',
      'گسترش به فروش آنلاین و مارکت‌پلیس‌ها',
    ],
    threats: [
      'افزایش رقبای جدید در بازار',
      'نوسانات اقتصادی و کاهش قدرت خرید',
      'تغییر الگوریتم اینستاگرام',
    ],
  },
  cpmMatrix: {
    headers: ['کسب‌وکار', 'اینستاگرام', 'وب‌سایت', 'اعتبار', 'خدمات', 'مجموع'],
    rows: [
      {
        name: 'کسب‌وکار هدف',
        isTarget: true,
        instagram: 7,
        website: 6,
        credibility: 7,
        services: 9,
        total: 29,
        instagramBreakdown: {
          visualQuality: 8,
          creativity: 7,
          scriptTopic: 6,
          captions: 7,
          storytelling: 7,
          bio: 6,
          highlights: 7,
          layout: 8,
          engagementRate: 8,
        },
        websiteBreakdown: {
          ux: 6,
          deviceCompatibility: 7,
          seo: 5,
          serviceCategorization: 7,
          onlineBooking: 4,
          liveSupport: 5,
        },
        credibilityBreakdown: {
          physicalStore: 8,
          digitalPresence: 7,
          influencerCollabs: 6,
          yearsExperience: 7,
        },
        servicesBreakdown: {
          productDiversity: 9,
          customization: 9,
          accessories: 9,
          additionalServices: 9,
        },
      },
      {
        name: 'رقیب اول',
        isTarget: false,
        instagram: 9,
        website: 7,
        credibility: 9,
        services: 7,
        total: 32,
        instagramBreakdown: {
          visualQuality: 9,
          creativity: 9,
          scriptTopic: 8,
          captions: 9,
          storytelling: 9,
          bio: 9,
          highlights: 9,
          layout: 9,
          engagementRate: 7,
        },
        websiteBreakdown: {
          ux: 8,
          deviceCompatibility: 8,
          seo: 9,
          serviceCategorization: 8,
          onlineBooking: 9,
          liveSupport: 4,
        },
        credibilityBreakdown: {
          physicalStore: 9,
          digitalPresence: 9,
          influencerCollabs: 9,
          yearsExperience: 9,
        },
        servicesBreakdown: {
          productDiversity: 7,
          customization: 6,
          accessories: 7,
          additionalServices: 8,
        },
      },
      {
        name: 'رقیب دوم',
        isTarget: false,
        instagram: 6,
        website: 5,
        credibility: 6,
        services: 8,
        total: 25,
        instagramBreakdown: {
          visualQuality: 7,
          creativity: 6,
          scriptTopic: 5,
          captions: 5,
          storytelling: 5,
          bio: 4,
          highlights: 6,
          layout: 7,
          engagementRate: 9,
        },
        websiteBreakdown: {
          ux: 5,
          deviceCompatibility: 3,
          seo: 4,
          serviceCategorization: 6,
          onlineBooking: 3,
          liveSupport: 3,
        },
        credibilityBreakdown: {
          physicalStore: 5,
          digitalPresence: 6,
          influencerCollabs: 5,
          yearsExperience: 6,
        },
        servicesBreakdown: {
          productDiversity: 8,
          customization: 8,
          accessories: 8,
          additionalServices: 7,
        },
      },
    ],
  },
  positioningMaps: [
    {
      title: 'Instagram vs Website',
      xAxis: 'امتیاز اینستاگرام',
      yAxis: 'امتیاز وب‌سایت',
      data: [
        { name: 'کسب‌وکار هدف', x: 7, y: 6, isTarget: true },
        { name: 'رقیب اول', x: 9, y: 7, isTarget: false },
        { name: 'رقیب دوم', x: 6, y: 5, isTarget: false },
      ],
    },
    {
      title: 'Credibility vs Product',
      xAxis: 'امتیاز اعتبار',
      yAxis: 'امتیاز خدمات',
      data: [
        { name: 'کسب‌وکار هدف', x: 7, y: 9, isTarget: true },
        { name: 'رقیب اول', x: 9, y: 7, isTarget: false },
        { name: 'رقیب دوم', x: 6, y: 8, isTarget: false },
      ],
    },
    {
      title: 'Website vs Credibility',
      xAxis: 'امتیاز وب‌سایت',
      yAxis: 'امتیاز اعتبار',
      data: [
        { name: 'کسب‌وکار هدف', x: 6, y: 7, isTarget: true },
        { name: 'رقیب اول', x: 7, y: 9, isTarget: false },
        { name: 'رقیب دوم', x: 5, y: 6, isTarget: false },
      ],
    },
    {
      title: 'Instagram vs Credibility',
      xAxis: 'امتیاز اینستاگرام',
      yAxis: 'امتیاز اعتبار',
      data: [
        { name: 'کسب‌وکار هدف', x: 7, y: 7, isTarget: true },
        { name: 'رقیب اول', x: 9, y: 9, isTarget: false },
        { name: 'رقیب دوم', x: 6, y: 6, isTarget: false },
      ],
    },
  ],
  recommendations: [
    {
      priority: 1,
      title: 'افزایش فرکانس انتشار محتوا',
      description:
        'با برنامه‌ریزی محتوایی منظم (حداقل ۵ پست در هفته)، ویزیبیلیتی برند را در اینستاگرام افزایش دهید و از الگوریتم به نفع خود استفاده کنید.',
      actionSteps: [
        'تدوین تقویم محتوایی ماهیانه بر اساس موضوعات ترند و نیاز مخاطبان.',
        'تولید ریل‌های کوتاه (زیر ۳۰ ثانیه) با سناریوهای جذاب آموزشی.',
        'تحلیل هفتگی ساعات پربازدید و تنظیم زمان‌بندی دقیق انتشار پست‌ها.'
      ]
    },
    {
      priority: 2,
      title: 'راه‌اندازی کمپین اینفلوئنسر مارکتینگ',
      description:
        'با ۳ تا ۵ میکرواینفلوئنسر در حوزه فرزندپروری همکاری کنید تا آگاهی از برند را در مخاطبان هدف افزایش دهید.',
      actionSteps: [
        'شناسایی و لیست کردن بلاگرهای حوزه کودک با فالوور بین ۱۰ تا ۵۰ هزار نفر.',
        'ارسال نمونه محصولات دکوراسیون اتاق کودک جهت معرفی ارگانیک و غیرمستقیم.',
        'ایجاد کدهای تخفیف اختصاصی برای هر اینفلوئنسر جهت سنجش دقیق بازدهی کمپین.'
      ]
    },
    {
      priority: 3,
      title: 'بهینه‌سازی وب‌سایت برای سئو',
      description:
        'با تولید محتوای بلاگ درباره دکوراسیون اتاق کودک و بهینه‌سازی کلمات کلیدی، ترافیک ارگانیک وب‌سایت را بهبود دهید.',
      actionSteps: [
        'کیورد ریسرچ و یافتن کلمات کلیدی پرسرچ مانند «طراحی اتاق نوزاد» و «سیسمونی شیک».',
        'نگارش ۲ مقاله بلاگ در هفته با اصول سئو و لینک‌دهی داخلی مناسب به محصولات.',
        'بهینه‌سازی تگ‌های Alt تصاویر محصولات جهت ایندکس شدن بهتر در بخش سرچ تصاویر گوگل.'
      ]
    },
    {
      priority: 4,
      title: 'دریافت تایید (Verified Badge) اینستاگرام',
      description:
        'با ثبت برند رسمی و تولید محتوای باکیفیت، برای دریافت تایید اینستاگرام اقدام کنید تا اعتبار برند افزایش یابد.',
      actionSteps: [
        'ثبت رسمی نام و علامت تجاری برند در مراجع قانونی کشور.',
        'افزایش حضور رسانه‌ای از طریق مصاحبه‌ها و انتشار رپورتاژهای معتبر خبری.',
        'ارسال درخواست رسمی و مدارک هویتی و ثبتی به پلتفرم متا.'
      ]
    },
    {
      priority: 5,
      title: 'راه‌اندازی برنامه وفاداری مشتری',
      description:
        'یک سیستم امتیازدهی یا تخفیف برای مشتریان تکراری طراحی کنید تا نرخ بازگشت مشتری را بالا ببرید و از نرخ تعامل بالای فعلی بهره‌برداری کنید.',
      actionSteps: [
        'طراحی کمپین باشگاه مشتریان با تخصیص امتیاز به هر خرید ثبت‌شده در سایت.',
        'ارسال پیامک‌های تبریک تولد کودک همراه با کدهای تخفیف اختصاصی ۱۵ درصدی.',
        'برگزاری نظرسنجی‌های فصلی و اعطای هدایای کوچک تبلیغاتی به مشارکت‌کنندگان.'
      ]
    },
  ],
};
