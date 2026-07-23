"use client";

import { motion } from "framer-motion";

type GlassCardProps = {
  title: string;
  value: string;
  subtitle: string;
  delay?: number;
};

function GlassCard({ title, value, subtitle, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ scale: 1.03 }}
      className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-xl"
    >
      <p className="text-sm text-slate-300">{title}</p>
      <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
      <p className="mt-2 text-sm text-sky-300">{subtitle}</p>
    </motion.div>
  );
}

function Dashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8 }}
      className="relative"
      dir="ltr"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-72 w-72 -translate-x-10 rounded-full bg-sky-500/20 blur-3xl"
      />

      <div className="relative grid gap-5">
        <GlassCard
          title="Monthly Revenue"
          value="24,850 OMR"
          subtitle="↑ 12% this month"
          delay={0.1}
        />

        <div className="grid grid-cols-2 gap-5">
          <GlassCard
            title="Collection"
            value="94%"
            subtitle="Excellent"
            delay={0.2}
          />
          <GlassCard
            title="Students"
            value="1,245"
            subtitle="Active"
            delay={0.3}
          />
        </div>

        <GlassCard
          title="AI Insight"
          value="Smart"
          subtitle="23 payments need attention"
          delay={0.4}
        />
      </div>
    </motion.div>
  );
}

export default function RusoomHero() {
  return (
    <section
      dir="rtl"
      className="relative flex min-h-screen items-center overflow-hidden bg-slate-950"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-20 top-20 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl"
      />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-teal-500 shadow-xl shadow-sky-500/40">
              <span className="text-3xl font-bold text-white">R</span>
            </div>
            <h2 className="text-3xl font-bold text-white">RusoomPay</h2>
          </div>

          <h1 className="text-5xl font-bold leading-tight text-white md:text-6xl">
            إدارة المدرسة
            <span className="block bg-gradient-to-r from-sky-400 to-teal-400 bg-clip-text text-transparent">
              بذكاء
            </span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            النظام المالي والإداري المتكامل للمدارس الخاصة.
            <br />
            رسوم، تحصيل، تقارير وقرارات في منصة واحدة.
          </p>

          <button
            type="button"
            className="mt-8 rounded-xl bg-sky-500 px-8 py-4 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            ابدأ التجربة
          </button>
        </motion.div>

        <Dashboard />
      </div>
    </section>
  );
}
