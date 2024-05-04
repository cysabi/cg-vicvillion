import { createContext } from "preact";
import { useState, useContext, useEffect } from "preact/hooks";
import { render } from "preact";
import { Client } from "bento/client";
import "./index.css";

// react bindings
const cg = new Client();
const ClientContext = createContext();

export const ClientProvider = ({ children }) => {
  const [state, setState] = useState();

  useEffect(() => {
    cg.dispatch = (state) => {
      setState(state);
    };
    return () => {
      cg.dispatch = null;
    };
  }, []);

  return (
    <ClientContext.Provider value={state}>{children}</ClientContext.Provider>
  );
};

export const useClient = () => {
  const client = useContext(ClientContext);
  return client;
};

// actual page
const App = () => {
  const state = useClient();
  const [log, setLog] = useState([]);

  useEffect(() => {
    setLog([...log, `current state: ${JSON.stringify(state)}`]);
  }, [state]);

  return (
    <div class="flex flex-col w-full max-w-6xl mx-auto p-2 gap-2" id="feed">
      <div class="flex gap-2">
        <button
          onClick={() => {
            cg.act("updateScore", { index: 0, name: `hehe ${Date.now()}` });
          }}
          class="bg-slate-300 rounded-md p-2 font-medium"
        >
          Change score
          <span class="font-mono rounded-sm bg-slate-800 text-white py-0.5 px-1 mx-2">
            {state?.scoreboard?.[0].name}
          </span>
          <span class="font-mono rounded-sm bg-slate-800 text-white py-0.5 px-1 mx-2">
            {state?.scoreboard?.[0].score}
          </span>
          <span class="font-mono rounded-sm bg-slate-800 text-white py-0.5 px-1 mx-2">
            {state?.scoreboard?.[1].name}
          </span>
          <span class="font-mono rounded-sm bg-slate-800 text-white py-0.5 px-1 mx-2">
            {state?.scoreboard?.[1].score}
          </span>
        </button>
      </div>
      {log.map((message) => (
        <div class="p-2 rounded-md bg-slate-300">{message}</div>
      ))}
    </div>
  );
};

render(
  <ClientProvider>
    <App />
  </ClientProvider>,
  document.getElementById("app")
);
