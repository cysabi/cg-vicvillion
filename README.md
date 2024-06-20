# `cg-vicvillion`
> Staring soon carousel for [@Vicvillon](https://www.youtube.com/@Vicvillon)!!

Carousel with a sprite running along some fan art

## usage
Download the most recent release, unzip, and run!
- Create an `art/` folder and fill it up with art! the name of the file corresponds to the artist name that is shown.

## local setup
- Inside `bento.box.ts`, set `DEV_ENV` to `true`
- `bun --watch bento.box.ts`

### building for production
- There are 2 parts: the server binary, and the static dist folder
- To build `dist/`, run `bun run build`
- To compile, run `bun run compile`
- Move `/dist`, `/art`, `carousel.exe` into a folder and zip it!

---

*empathy included • [**@cysabi**](https://github.com/cysabi) • [cysabi.github.io](https://cysabi.github.io)*
