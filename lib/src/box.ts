import type { Actions, ServerConfig } from "./types";

export type BentoBoxModel<S> = S | Actions<S>;

export const box = <S extends Record<string, unknown>>(
  model: BentoBoxModel<S>
): ServerConfig<S> => {
  const config: ServerConfig<S> = {
    state: {} as S,
    actions: {},
  };

  Object.entries(model).forEach(([key, value]) => {
    // TODO: deep search for an external lib
    if (typeof value === "function") {
      config.actions[key] = value as Actions<S>[keyof Actions<S>];
    } else {
      config.state[key as keyof S] = value as S[keyof S];
    }
  });

  return config;
};
