declare namespace Deno {
  const env: { get(name: string): string | undefined };
  function readTextFile(path: string | URL): Promise<string>;
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}
