import BentoBox from "./box";
import type { Input } from "./types";

export const box = <S extends Record<string, unknown>>(input: Input<S>) =>
  new BentoBox<S>(input);

export default {
  box,
};
