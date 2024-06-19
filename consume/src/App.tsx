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
import { SpringEasing } from "spring-easing";

let spriteRef: HTMLDivElement | undefined;
let carouselRef: HTMLDivElement | undefined;
const [refs, setRefs] = createSignal<HTMLImageElement[]>([]);

// every so often, make red circle go back and jump forward
const offset = 360;
const gap = 100;
const speed = 200;

function App() {
  createEffect(() => {
    const width = fullWidth();
    if (!syncFullWidth(width)) {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline().fromTo(
          carouselRef!,
          { x: -width },
          {
            x: -(width * 2),
            repeat: Infinity,
            ease: "none",
            duration: width / speed,
            onUpdate: () => {
              syncFullWidth(width);
            },
          }
        );
        const jumpDir = gap / speed;
        let runningWidth = 0;
        for (let ri = 0; ri < refs().length / 3; ri++) {
          const ref = refs()[ri + refs().length / 3];
          tl.to(
            ref,
            {
              duration: 0,
              repeatDelay: width / speed,
              repeat: -1,
              onRepeat: () => {
                gsap
                  .timeline()
                  .fromTo(
                    spriteRef!,
                    {
                      y: 0,
                    },
                    {
                      y: -100,
                      duration: jumpDir,
                      ease: "circ.out",
                      onStart: () => {
                        spriteRef!.style.backgroundColor = "#fbbf24";
                      },
                    }
                  )
                  .to(spriteRef!, {
                    y: 0,
                    duration: jumpDir,
                    ease: "circ.in",
                    onComplete: () => {
                      spriteRef!.style.backgroundColor = "#d8b4fe";
                    },
                  })
                  .fromTo(
                    [ref, spriteRef],
                    { y: 0 },
                    {
                      duration: duration / 1000,
                      y: y.length,
                      ease: "none",
                      modifiers: { y: springY },
                    }
                  );
              },
            },
            runningWidth / speed - jumpDir * 2
          );
          runningWidth += ref.getBoundingClientRect().width + gap;
        }
      });
      onCleanup(() => ctx.kill());
    }
  });

  return (
    <div class="absolute inset-0 m-auto h-[1080px] w-[1920px] outline-red-500 outline-dashed outline-2 outline-offset-2 font-mono">
      <div
        class="flex flex-col justify-end h-full py-16"
        style={{
          "margin-left": offset + "px",
        }}
      >
        <div class="w-full flex flex-col">
          <div ref={spriteRef} class="h-32 w-32 rounded-full bg-purple-300" />
        </div>
        <div ref={carouselRef} class="flex h-96" style={{ gap: `${gap}px` }}>
          <For each={imgs()}>
            {(img, i) => (
              <img
                ref={(ref) => {
                  const newRefs = [...refs()];
                  newRefs[i()] = ref;
                  setRefs(newRefs);
                }}
                class="object-contain"
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
const client = new Client({
  initial: { files: [] as State },
});
const [state, setState] = createSignal<string[]>([]);
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
const imgs = createMemo(() => [...state(), ...state(), ...state()]);
const deriveFullWidth = () =>
  (refs().reduce((total, ref) => total + ref.getBoundingClientRect().width, 0) +
    refs().length * gap) /
  3;
const syncFullWidth = (prev: number) => {
  if (Math.floor(prev) !== Math.floor(deriveFullWidth())) {
    setFullWidth(deriveFullWidth());
    return true;
  }
  return false;
};

const [fullWidth, setFullWidth] = createSignal(deriveFullWidth());

const [y, duration] = SpringEasing([0, 0.45], {
  easing: "spring(0.01, 1, 0.1, 100000)",
  numPoints: 200,
});
const wrappedY = gsap.utils.wrap(y);
const springY = (y: string) => wrappedY(parseFloat(y)) + "px";

export default App;
