export function useRouter() {
  return {
    replace() {},
    push() {},
    refresh() {},
  };
}

export function usePathname() {
  return "/app/setup";
}

export function useSearchParams() {
  return new URLSearchParams();
}
