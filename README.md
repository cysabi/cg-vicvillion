# `cg-vicvillion`
> staring soon carousel for [@Vicvillon](https://www.youtube.com/@Vicvillon)!!

A carousel with the cutest sprite running along some fan art
- Using a beta version of [bento](https://github.com/cysabi/bento)!

## usage
Download `cg-vicvillion.zip` from the most recent release, unzip, and run!
- Create an `art/` folder and fill it up with art! the name of the file corresponds to the artist name that is shown.

## local setup
- Inside `bento.box.ts`, set `DEV_ENV` to `true`
- `bun --watch bento.box.ts`

### building for production
- There are 2 parts: the server binary, and the static dist folder
- `bun run build` to build `dist/`
- `bun run compile` to compile the bento server for windows, make sure to set `DEV_ENV=false`!
- `bun run zip` to zip up `dist/`, `art/`, and `carousel.exe`!

---

*empathy included • [**@cysabi**](https://github.com/cysabi) • [cysabi.github.io](https://cysabi.github.io)*
