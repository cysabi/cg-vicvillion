import BunCG from "./src/buncg";

type State = {
  flavorText: string;
  scoreboard: {
    0: {
      name: string;
      score: number;
    };
    1: {
      name: string;
      score: number;
    };
  };
};

const cg = new BunCG<State>({
  state: {
    flavorText: "flavor test",
    scoreboard: {
      0: {
        name: "apple",
        score: 1,
      },
      1: {
        name: "banana",
        score: 2,
      },
    },
  },
  actions: {
    updateScore(draft, payload: { index: 0 | 1; value: number }) {
      draft.setIn(["scoreboard", payload.index, "score"], payload.value);
    },
    setText(draft, payload) {
      draft.setIn(["flavorText"], payload);
    },
  },
});

cg.serve();
