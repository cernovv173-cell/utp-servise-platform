import { createFileRoute } from "@tanstack/react-router";

import { TechnicianProfileScreen } from "@/features/staff/technician-profile-screen";

const TechnicianProfilePage = () => {
  const { technicianId } = Route.useParams();
  return <TechnicianProfileScreen technicianId={technicianId} />;
};

export const Route = createFileRoute("/staff/$technicianId")({
  component: TechnicianProfilePage,
});
