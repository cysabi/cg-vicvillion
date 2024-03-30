import { useMemo, useState, useEffect } from "react";
import { create } from "zustand";
import ReactDOM from "react-dom/client";

import { Client } from "./client";

const useStore = create((set) => ({
  state: undefined,
  setState: (state: unknown) => set({ state }),
}));

const useCg = (defaultState: any) => {
  const setState = useStore((s: any) => s.setState);
  const cg = useMemo(() => {
    return new Client("ws://localhost:2513");
  }, []);

  useEffect(
    () =>
      cg.watch([], (s) => {
        setState(s);
      }),
    []
  );

  cg.useState = (cb: (s: any) => any) =>
    useStore(({ state }: any) => cb(state || defaultState));
  return cg;
};

const App = () => {
  const [log, setLog] = useState<string[]>([]);
  const cg = useCg({
    flavorText: "NULL",
    scoreboard: {
      0: {
        name: "nope",
        score: 1,
      },
      1: {
        name: "banana",
        score: 2,
      },
    },
  });
  const flavorText = cg.useState((s: any) => s.flavorText);
  const name = cg.useState((s: any) => s.scoreboard[0].name);

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto p-2 gap-2" id="feed">
      <div className="flex gap-2">
        <button
          onClick={() => {
            cg.act(
              "setText",
              `hehe its ${(new Date().getTime() / 1000).toString()}`
            );
          }}
          className="bg-slate-300 rounded-md p-2 font-medium"
        >
          Change flavor text
          <span className="font-mono rounded-sm bg-slate-800 text-white py-0.5 px-1 mx-2">
            {flavorText} | {name}
          </span>
        </button>
      </div>
      {log.map((message) => (
        <div className="p-2 rounded-md bg-slate-300">{message}</div>
      ))}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
