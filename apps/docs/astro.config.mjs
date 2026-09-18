import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.alsaada.internal',
  image: {
    service: passthroughImageService(),
  },
  integrations: [
    starlight({
      title: 'منظومة السعادة سمارت بوت',
      description: 'البوابة التفاعلية للتوثيق المؤسسي وخريطة المعمارية الحية وبوابات الحراسة الآلية',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'العربية (RTL)',
          lang: 'ar',
          dir: 'rtl',
        },
        en: {
          label: 'English (LTR)',
          lang: 'en',
          dir: 'ltr',
        },
      },
      customCss: ['./src/styles/custom.css'],
      components: {
        Head: './src/components/Head.astro',
      },
      sidebar: [
        {
          label: '🌐 خريطة المعمارية الحية (Living Architecture)',
          link: '/living-architecture/',
        },
        {
          label: '1️⃣ الأسس والميثاق التأسيسي (Foundations & Baseline)',
          items: [{ autogenerate: { directory: 'foundations' } }],
        },
        {
          label: '2️⃣ المعمارية وحزم النواة (Core Architecture & Engines)',
          items: [{ autogenerate: { directory: 'core-architecture' } }],
        },
        {
          label: '3️⃣ المالية والحوكمة والرقابة (Financial Engine & Governance)',
          items: [{ autogenerate: { directory: 'financial-and-governance' } }],
        },
        {
          label: '4️⃣ قواعد البيانات وسجل الترحيل (Data & Migration Radar)',
          items: [{ autogenerate: { directory: 'data-and-migration' } }],
        },
        {
          label: '5️⃣ تجربة مستخدم البوت (Telegram UX & Bot Ergonomics)',
          items: [{ autogenerate: { directory: 'telegram-ux' } }],
        },
        {
          label: '6️⃣ السجلات المعمارية المعتمدة (ADRs 001 - 037)',
          collapsed: true,
          items: [{ autogenerate: { directory: 'adrs' } }],
        },
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/SalehOsman/Alsaada-Smart-Bot',
        },
      ],
    }),
  ],
});
