import BunCG from "./server/src";

const cg = new BunCG({
  flavorText: "thingy",
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
  updateScore(draft, _) {
    const w = draft.scoreboard.shift();
    console.log(draft.scoreboard);
    draft.scoreboard.push(w);
  },
});

cg.serve();
