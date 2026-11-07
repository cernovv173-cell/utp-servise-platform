import { createFileRoute } from "@tanstack/react-router";

import { LoginExperience } from "@/features/auth/login-experience";

const LoginPage = () => <LoginExperience />;

export const Route = createFileRoute("/login")({ component: LoginPage });
