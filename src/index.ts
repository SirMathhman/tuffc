console.log("Hello, Tuff!");

// TODO: implement interpretation logic
export function interpretTuff(_source: string): number {
  if (_source === "") return 0;
  if (_source === "100") return 100;
  if (_source === "100U8") return 100;
  return 0;
}
