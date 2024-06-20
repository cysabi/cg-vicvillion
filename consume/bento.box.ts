import bento from "bento";
import { readdir } from "node:fs/promises";
import { watch } from "fs";

let countdown: Timer | null = null;

type State = {
  files: { data: ArrayBuffer; type: string }[];
};

function shuffle(array: any[]) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

bento.box<State>(
  {
    files: [],
    setFiles: async (set, payload) => {
      set((state) => {
        state.files = payload;
      });
    },
  },
  (act) => {
    const dir = import.meta.dir + "/public";
    const syncFiles = async () => {
      const paths = await readdir(dir);
      const files = await Promise.all(
        paths.map(async (path) => {
          const file = Bun.file(Bun.pathToFileURL(dir + "/" + path));
          return {
            type: file.type,
            data: await file.arrayBuffer(),
          };
        })
      );
      act("setFiles", shuffle(files));
    };
    watch(dir, syncFiles);
    syncFiles();
  }
);
