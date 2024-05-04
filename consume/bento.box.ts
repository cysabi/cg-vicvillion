import bento from "bento";

let countdown: Timer | null = null;

type State = {
  obs: any;
  flavorText: string;
  nextMatch: null | number;
  scoreboard: { name: string; score: number }[];
};

export default bento.box<State>({
  obs: {
    scene: null,
  },
  flavorText: "thingy",
  nextMatch: null,
  scoreboard: [
    {
      name: "apple",
      score: 1,
    },
    {
      name: "banana",
      score: 2,
    },
  ],
  setObsScene(set, payload: string) {
    set((state) => {
      state.obs.scene = payload;
    });
  },
  setCount(set, payload: number | null) {
    if (countdown) clearInterval(countdown);
    set((state) => {
      state.nextMatch = payload;
    });
    countdown = setInterval(() => {
      set((state) => {
        if (state.nextMatch) {
          state.nextMatch -= 1;
        } else if (countdown) {
          clearInterval(countdown);
        }
      });
    }, 1000);
  },
  updateScore(set, payload) {
    set((state) => {
      state.scoreboard[0].score -= 1;
    });
  },
});
