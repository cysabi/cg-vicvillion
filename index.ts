import bento from "./server/src";

const cg = bento.box<{
  flavorText: string;
  scoreboard: { name: string; score: number }[];
}>({
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
  updateScore(stream, payload) {
    stream((state) => {
      const w = state.scoreboard.shift();
      console.log(state.scoreboard);
      if (w) {
        state.scoreboard.push(w);
      }
      // return "error?";
    });
    // return "error?"
  },
});

cg.use(async (act) => {
  await act({ action: "updateScore", payload: 1 });
});

cg.run();
