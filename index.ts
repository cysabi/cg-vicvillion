import Model from "./src/model";

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

const model = new Model<State>({
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
  updateScore(payload: { index: 0 | 1; value: number }, draft) {
    draft.scoreboard[payload.index].score = payload.value;
  },
  setText(payload, draft) {
    draft.flavorText = payload;
  },
});

model.serve();
