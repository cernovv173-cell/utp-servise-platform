import { createFileRoute } from "@tanstack/react-router";

import { LoginExperience } from "@/features/auth/login-experience";

import { createPageHead } from "@/lib/seo";

const LoginPage = () => <LoginExperience />;

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () =>
    createPageHead({
      title: "Вход в личный кабинет — ЕНОТ СЕРВИС",
      description:
        "Вход и регистрация в сервисе ЕНОТ СЕРВИС: заявки, статус ремонта, бонусы и история обращений.",
      path: "/login",
      noindex: true,
    }),
});
