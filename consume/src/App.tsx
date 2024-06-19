import { Client } from "bento/client";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
} from "solid-js";
import "./index.css";
import gsap from "gsap";

// every so often, make red circle go back and jump forward

function App() {
  createEffect(() => {
    const width = fullWidth();
    syncFullWidth(width);

    const ctx = gsap.context(() => {
      gsap.timeline().fromTo(
        caro!,
        { x: -width },
        {
          x: 0,
          repeat: Infinity,
          ease: "none",
          duration: width / 640,
          onRepeat: () => syncFullWidth(width),
        }
      );
    });

    onCleanup(() => ctx.kill());
  });

  let caro: HTMLDivElement | undefined;

  return (
    <div class="absolute inset-0 m-auto h-[1080px] w-[1920px] outline-red-500 outline-dashed outline-2 outline-offset-2 font-mono">
      <div class="flex flex-col justify-end h-full py-16">
        <div class="w-full flex flex-col items-end">
          <div class="h-32 w-32 mr-64 rounded-full bg-red-400" />
        </div>
        <div ref={caro} class="flex gap-16 h-96">
          <For each={imgs()}>
            {(img, i) => (
              <img
                ref={(ref) => {
                  const newRefs = [...refs()];
                  newRefs[i()] = ref;
                  console.log(ref.getBoundingClientRect().width);
                  setRefs(newRefs);
                }}
                class="object-cover"
                src={img}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

type State = { type: string; data: ArrayBuffer }[];

const [state, setState] = createSignal<string[]>([]);

const client = new Client({
  initial: { files: [] as State },
});
client.dispatch = (state) => {
  setState(
    state.files.map((file) => {
      let binary = "";
      let bytes = new Uint8Array(file.data);
      for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return `data:${file.type};base64,${window.btoa(binary)}`;
    })
  );
};

const imgs = createMemo(() => [...state(), ...state()]);
const [refs, setRefs] = createSignal<HTMLImageElement[]>([]);
const deriveFullWidth = () =>
  (refs().reduce((total, ref) => total + ref.getBoundingClientRect().width, 0) +
    refs().length * 16 * 4) /
  2;
const syncFullWidth = (prev: number) => {
  if (prev !== deriveFullWidth()) {
    setFullWidth(deriveFullWidth());
  }
};

const [fullWidth, setFullWidth] = createSignal(deriveFullWidth());

export default App;
