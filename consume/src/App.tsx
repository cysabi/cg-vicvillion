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
import idle from "./idle.gif";
import run from "./run.gif";

// every so often, make red circle go back and jump forward
const offset = 288;
const gap = 100;
const speed = 200;

function App() {
  createEffect(() => {
    const width = fullWidth();
    if (!syncFullWidth(width)) {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline().fromTo(
          carouselRef!,
          { x: -overflowOffset() },
          {
            x: -(overflowOffset() + width),
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
        for (let ri = 1; ri < refs().length - 5; ri++) {
          const ref = refs()[ri];
          if (ref) {
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
                          spriteIdleRef!.style.opacity = "1";
                          spriteRunRef!.style.opacity = "0";
                        },
                      }
                    )
                    .to(spriteRef!, {
                      y: 0,
                      duration: jumpDir,
                      ease: "circ.in",
                      onComplete: () => {
                        spriteIdleRef!.style.opacity = "0";
                        spriteRunRef!.style.opacity = "1";
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
          <div
            ref={spriteRef}
            class="relative h-[300px] w-[300px] -translate-x-[35%]"
          >
            <img
              class="absolute inset-0 opacity-0"
              ref={spriteIdleRef}
              style={{ "image-rendering": "pixelated" }}
              src={idle}
            />
            <img
              class="absolute inset-0"
              ref={spriteRunRef}
              style={{ "image-rendering": "pixelated" }}
              src={run}
            />
          </div>
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

// bento client
type State = { type: string; data: ArrayBuffer }[];
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

// img state
const [state, setState] = createSignal<string[]>([]);
const imgs = createMemo(() =>
  state().length ? [state().at(-1), ...state(), ...state().slice(0, 5)] : []
);

// refs
const [refs, setRefs] = createSignal<HTMLImageElement[]>([]);
let carouselRef: HTMLDivElement | undefined;
let spriteRef: HTMLDivElement | undefined;
let spriteIdleRef: HTMLImageElement | undefined;
let spriteRunRef: HTMLImageElement | undefined;

// fullWidth manager
const [fullWidth, setFullWidth] = createSignal(0);
const [overflowOffset, setOverflowOffset] = createSignal(0);
const syncFullWidth = (prev: number) => {
  if (Math.floor(prev) !== Math.floor(deriveFullWidth())) {
    setFullWidth(deriveFullWidth());
    setOverflowOffset((refs()[0]?.getBoundingClientRect()?.width || 0) + gap);
    return true;
  }
  return false;
};
const deriveFullWidth = () =>
  refs()
    .slice(1, -5)
    .reduce((total, ref) => total + ref.getBoundingClientRect().width + gap, 0);

// gsap utils
const [y, duration] = SpringEasing([0, 0.45], {
  easing: "spring(0.01, 1, 0.1, 100000)",
  numPoints: 2167,
});

const wrappedY = gsap.utils.wrap(y);
const springY = (y: string) => wrappedY(parseFloat(y)) + "px";

export default App;
