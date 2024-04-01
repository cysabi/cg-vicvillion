import BunCG from "./server/buncg";

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
  updateScore(draft) {
    draft.scoreboard[0].score += 1;
    draft.scoreboard[1] = {
      name: "poop",
      score: Math.floor(Math.random() * 999),
    };
  },
});

cg.serve();
