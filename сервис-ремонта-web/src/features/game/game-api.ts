import { apiRequest } from "@/lib/api";

export type GameOption = { id: string; text: string };

export type GameQuestion = {
  id: string;
  prompt: string;
  correctFeedback: string;
  incorrectFeedback: string;
  options: GameOption[];
};

export type GameEpisode = {
  id: string;
  title: string;
  introduction: string;
  completed: boolean;
  questions: GameQuestion[];
};

export type GameEpisodeList = {
  episodes: GameEpisode[];
  balance: number;
  weeklyAwardedPoints: number;
  weeklyLimit: number;
  pointsPerEpisode: number;
};

export type GameAnswerResult = {
  correct: boolean;
  feedback: string;
};

export type GameCompletionResult = {
  awardedPoints: number;
  balance: number;
  weeklyAwardedPoints: number;
  alreadyCompleted: boolean;
  weeklyLimitReached: boolean;
};

export type GameAdminOptionInput = { text: string; isCorrect: boolean };

export type GameAdminQuestionInput = {
  prompt: string;
  correctFeedback: string;
  incorrectFeedback: string;
  options: GameAdminOptionInput[];
};

export type GameAdminEpisodeInput = {
  title: string;
  introduction: string;
  isActive: boolean;
  questions: GameAdminQuestionInput[];
};

export type GameAdminEpisode = {
  id: string;
  title: string;
  introduction: string;
  isActive: boolean;
  questions: Array<
    Omit<GameQuestion, "options"> & {
      options: Array<GameOption & { isCorrect: boolean }>;
    }
  >;
};

export const getGameEpisodes = (token: string, signal?: AbortSignal) =>
  apiRequest<GameEpisodeList>("/games/episodes", token, { signal });

export const submitGameAnswer = (
  token: string,
  episodeId: string,
  questionId: string,
  optionId: string,
) =>
  apiRequest<GameAnswerResult>(`/games/episodes/${episodeId}/answer`, token, {
    method: "POST",
    body: JSON.stringify({ questionId, optionId }),
  });

export const completeGameEpisode = (
  token: string,
  episodeId: string,
  answers: Array<{ questionId: string; optionId: string }>,
) =>
  apiRequest<GameCompletionResult>(`/games/episodes/${episodeId}/complete`, token, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });

export const getAdminGameEpisodes = (token: string, signal?: AbortSignal) =>
  apiRequest<{ episodes: GameAdminEpisode[] }>("/admin/games/episodes", token, { signal });

export const createAdminGameEpisode = (token: string, episode: GameAdminEpisodeInput) =>
  apiRequest<{ episode: GameAdminEpisode }>("/admin/games/episodes", token, {
    method: "POST",
    body: JSON.stringify(episode),
  });

export const updateAdminGameEpisode = (
  token: string,
  episodeId: string,
  update: Partial<GameAdminEpisodeInput>,
) =>
  apiRequest<{ episode: GameAdminEpisode }>(`/admin/games/episodes/${episodeId}`, token, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
