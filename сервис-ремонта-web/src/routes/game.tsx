import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

import { RaccoonGame } from "@/features/game/raccoon/raccoon-game";

const GamePage = () => {
  const embedded =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embedded") === "android";
  const game = <RaccoonGame embedded={embedded} />;

  return embedded ? game : <AppShell active="/game">{game}</AppShell>;
};

export const Route = createFileRoute("/game")({ component: GamePage });
