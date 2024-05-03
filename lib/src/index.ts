import type { Connect, ServerConfig, BentoBox } from "./types";

export const box = <S extends Record<string, unknown>>(
  config: ServerConfig<S>
): BentoBox<S> => {
  return {
    config,
    uses: [],
    controls: [],
    use(connect: Connect) {
      this.uses.push(connect);
      return this;
    },
    control(control: any) {
      this.controls.push(control);
      return this;
    },
  };
};

export type { BentoBox };
export default { box };