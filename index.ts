import BunCG from "./lib/buncg";

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
  flavorText: "1",
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
  updateScore(draft, { index, name }) {
    draft.setIn(
      ["scoreboard", index.toString(), "score"],
      (draft.getIn(["scoreboard", index.toString(), "score"]) as number) + 1
    );
    draft.setIn(["scoreboard", index, "name"], name);
  },
  setText(draft, payload) {
    draft.setIn(["flavorText"], payload);
  },
  async setTextAsync(payload) {
    await (() => new Promise((res) => setTimeout(res, 1000)));
    return (draft) => {
      draft.setIn(["flavorText"], payload);
    };
  },
});

cg.serve();
