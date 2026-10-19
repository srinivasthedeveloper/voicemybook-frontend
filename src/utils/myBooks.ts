// Books this browser has opened, newest first (the server lists nobody's books: it's public)
const KEY = "vmb.myBooks";

export function myBookIds(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || "[]") as string[]).filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 100)));
  } catch {
    /* private mode: the list just isn't remembered */
  }
}

export function rememberBook(id: string) {
  save([id, ...myBookIds().filter((x) => x !== id)]);
}

export function forgetBooks(gone: string[]) {
  save(myBookIds().filter((x) => !gone.includes(x)));
}
