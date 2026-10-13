import { createFileRoute } from "@tanstack/react-router";

import { GamePlayScreen } from "@/features/game/game-play-screen";

const GameRoute = () => <GamePlayScreen />;

export const Route = createFileRoute("/game")({ component: GameRoute });
