import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  targetDate: string;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useGoals() {
  const [goals, setGoals, hydrated] = useLocalStorage<Goal[]>("goals_list", []);

  const addGoal = useCallback(
    (data: Omit<Goal, "id">) => setGoals((prev) => [{ id: newId(), ...data }, ...prev]),
    [setGoals]
  );
  const removeGoal = useCallback((id: string) => setGoals((prev) => prev.filter((g) => g.id !== id)), [setGoals]);
  const updateProgress = useCallback(
    (id: string, current: number) => setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, current } : g))),
    [setGoals]
  );

  return { goals, addGoal, removeGoal, updateProgress, hydrated };
}
