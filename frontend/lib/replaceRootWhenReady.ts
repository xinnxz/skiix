import type { Router } from "expo-router";

/** Defer so auth store updates before `app/index` reads `stage`. */
export function replaceRootWhenReady(router: Router) {
  setTimeout(() => {
    router.replace("/");
  }, 32);
}
