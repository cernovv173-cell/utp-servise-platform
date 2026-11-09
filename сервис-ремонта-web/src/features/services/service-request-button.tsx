import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { PublicAuthTrigger } from "@/components/public-site-shell";

import { useAuth } from "@/features/auth/auth-context";

export const ServiceRequestButton = ({
  className,
  label = "Оставить заявку",
}: {
  className: string;
  label?: string;
}) => {
  const { user } = useAuth();
  const content = (
    <>
      {label} <ArrowRight size={18} aria-hidden="true" />
    </>
  );

  if (user) {
    return (
      <Link to="/orders" className={className}>
        {content}
      </Link>
    );
  }

  return (
    <PublicAuthTrigger intent="register" nextPath="/orders" className={className}>
      {content}
    </PublicAuthTrigger>
  );
};
