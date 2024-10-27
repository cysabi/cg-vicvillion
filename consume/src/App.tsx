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
import up from "./up.png";
import down from "./down.png";
import land from "./land.png";
import run from "./run.gif";
import city1 from "./city/1.png";
import city2 from "./city/2.png";
import city3 from "./city/3.png";
import city4 from "./city/4.png";
import city5 from "./city/5.png";
import city6 from "./city/6.png";
import speechL from "./speech-l.png";
import speechM from "./speech-m.png";
import speechR from "./speech-r.png";

// every so often, make red circle go back and jump forward
const offset = 384 * 1.5;
const gap = 100;
const speed = 192;

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
        const jumpBefore = 20 / speed;
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
                  const subtl = gsap
                    .timeline()
                    .to(spriteLandRef!, {
                      duration: 1 / 10,
                      onStart: () => {
                        spriteRunRef!.style.opacity = "0";
                        spriteLandRef!.style.opacity = "1";
                      },
                    })
                    .fromTo(
                      spriteRef!,
                      {
                        y: 0,
                      },
                      {
                        y: -100,
                        duration: jumpDir + jumpBefore,
                        ease: "circ.out",
                        onStart: () => {
                          spriteLandRef!.style.opacity = "0";
                          spriteUpRef!.style.opacity = "1";
                        },
                      }
                    )
                    .to(spriteRef!, {
                      y: 0,
                      duration: jumpDir,
                      ease: "circ.in",
                      onStart: () => {
                        spriteUpRef!.style.opacity = "0";
                        spriteDownRef!.style.opacity = "1";
                      },
                    })
                    .to(spriteLandRef!, {
                      onStart: () => {
                        spriteDownRef!.style.opacity = "0";
                        spriteLandRef!.style.opacity = "1";
                      },
                      duration: 1 / 10,
                      onComplete: () => {
                        spriteLandRef!.style.opacity = "0";
                        spriteRunRef!.style.opacity = "1";
                      },
                    })
                    .fromTo([ref, spriteRef], { y: 0 }, springBounce, "<");

                  const popRef = [popRefs()[ri]];
                  if (ri === refs().length - 5 - 1) {
                    popRef.push(popRefs()[0]);
                  }
                  subtl
                    .fromTo(popRef, { y: 0 }, springFloat, "<")
                    .to(popRef, { opacity: 1 }, "<")
                    .to(popRef, {
                      duration: 5,
                      onComplete: () => {
                        popRef.forEach((ref) => (ref.style.opacity = "0"));
                      },
                    });
                },
              },
              runningWidth / speed - (jumpDir * 2 + jumpBefore + 1 / 10)
            );
            runningWidth += ref.getBoundingClientRect().width + gap;
          }
        }
      });
      onCleanup(() => ctx.kill());
    }
  });

  const [speech, setSpeech] = createSignal("starting soon!");

  return (
    <div class="absolute inset-0 m-auto h-[1080px] w-[1920px] outline-red-500 outline-dashed outline-2 outline-offset-2 font-mono">
      <div class="absolute inset-0 h-full w-full">
        {[city1, city2, city3, city4, city5, city6].map((src, i) => (
          <div
            ref={(ref) => {
              gsap.to(ref, {
                backgroundPositionX: "-1920px",
                repeat: -1,
                duration: 100 - i * 15,
                ease: "none",
              });
            }}
            class="absolute inset-0 h-full w-full"
            style={{
              "background-repeat": "repeat-x",
              "background-size": "contain",
              "background-image": `url('${src}')`,
              "image-rendering": "pixelated",
            }}
          />
        ))}
      </div>
      <div
        class="flex flex-col justify-end h-full py-16"
        style={{
          "margin-left": offset + "px",
        }}
      >
        <div class="w-full flex flex-col">
          <div
            ref={spriteRef}
            class="relative h-[300px] w-[300px]"
            style={{ transform: "translateX(-97.5px)" }}
          >
            <div
              style={{ transform: "translateX(14.5rem) translateY(-8.5rem)" }}
              class="absolute bottom-0 left-0"
            >
              <div class="relative flex">
                <div
                  class={`whitespace-nowrap h-32 flex items-center z-10 px-5 font-['Pixelify_Sans'] text-5xl font-semibold`}
                >
                  {speech()}
                </div>
                <input
                  class="absolute inset-0 whitespace-nowrap h-32 flex items-center z-10 px-5 font-['Pixelify_Sans'] text-5xl font-semibold opacity-0"
                  oninput={(e) => {
                    setSpeech(e.target.value);
                  }}
                />
                <div class="flex absolute inset-0 min-w-24">
                  <img
                    class="h-32 shrink-0 grow-0"
                    style={{ "image-rendering": "pixelated" }}
                    src={speechL}
                  ></img>
                  <img
                    class="h-32 flex-1 w-full"
                    style={{ "image-rendering": "pixelated" }}
                    src={speechM}
                  ></img>
                  <img
                    class="h-32 shrink-0 grow-0"
                    style={{ "image-rendering": "pixelated" }}
                    src={speechR}
                  ></img>
                </div>
              </div>
            </div>

            <img
              class="absolute inset-0 opacity-0"
              ref={spriteUpRef}
              style={{ "image-rendering": "pixelated" }}
              src={up}
            />
            <img
              class="absolute inset-0 opacity-0"
              ref={spriteDownRef}
              style={{ "image-rendering": "pixelated" }}
              src={down}
            />
            <img
              class="absolute inset-0 opacity-0"
              ref={spriteLandRef}
              style={{ "image-rendering": "pixelated" }}
              src={land}
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
              <div class="relative h-full min-w-fit">
                <img
                  ref={(ref) => {
                    const newRefs = [...refs()];
                    newRefs[i()] = ref;
                    setRefs(newRefs);
                  }}
                  class="h-full min-w-fit"
                  src={img?.src}
                />
                <div
                  class="absolute bottom-0 inset-x-0 flex flex-col items-center font-['Pixelify_Sans'] justify-start"
                  style={{ transform: "translateY(-43rem)" }}
                >
                  <div
                    ref={(ref) => {
                      const newRefs = [...popRefs()];
                      newRefs[i()] = ref;
                      setPopRefs(newRefs);
                    }}
                    class="px-5 py-2 opacity-0 leading-none bg-purple-[#5e3a83] outline-[8px] text-white outline-purple-[#5e3a83] border-white border-[5px] text-5xl"
                  >
                    {img?.name}
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

// bento client
type State = { name: string; type: string; data: ArrayBuffer }[];
const client = new Client({
  initial: { files: [] as State },
});

const [state, setState] = createSignal([] as { name: string; src: string }[]);
client.dispatch = (state) => {
  setState(
    state.files.map((file) => {
      let binary = "";
      let bytes = new Uint8Array(file.data);
      for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return {
        name: file.name,
        src: `data:${file.type};base64,${window.btoa(binary)}`,
      };
    })
  );
};

// img state
const imgs = createMemo(() =>
  state().length ? [state().at(-1), ...state(), ...state().slice(0, 5)] : []
);

// refs
const [refs, setRefs] = createSignal<HTMLImageElement[]>([]);
const [popRefs, setPopRefs] = createSignal<HTMLDivElement[]>([]);
let carouselRef: HTMLDivElement | undefined;
let spriteRef: HTMLDivElement | undefined;
let spriteUpRef: HTMLImageElement | undefined;
let spriteDownRef: HTMLImageElement | undefined;
let spriteLandRef: HTMLImageElement | undefined;
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
const springBounce = (() => {
  const [y, duration] = SpringEasing([0, 0.45], {
    easing: "spring(0.01, 1, 0.1, 100000)",
    numPoints: 2167,
  });
  const wrappedY = gsap.utils.wrap(y);
  const springY = (y: string) => wrappedY(parseFloat(y)) + "px";

  return {
    duration: duration / 1000,
    y: y.length,
    ease: "none",
    modifiers: { y: springY },
  };
})();

const springFloat = (() => {
  const [y, duration] = SpringEasing([100, 0], {
    easing: "spring(0.45, 100, 500, 0)",
    numPoints: 1000,
  });
  const wrappedY = gsap.utils.wrap(y);
  const springY = (y: string) => {
    const val = wrappedY(parseFloat(y)) + "px";
    if (val === "100px") return "0px";
    return val;
  };

  return {
    duration: duration / 1000,
    y: y.length,
    ease: "none",
    modifiers: { y: springY },
  };
})();

export default App;
