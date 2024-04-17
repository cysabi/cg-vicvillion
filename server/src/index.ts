import BentoBox from "./box";
import type { Input } from "./types";

export const box = <S>(input: Input<S>) => new BentoBox<S>(input);

export default {
  box,
};
