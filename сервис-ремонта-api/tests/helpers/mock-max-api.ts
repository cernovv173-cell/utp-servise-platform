import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import https from "node:https";

export type MaxApiMockRequest = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string | null;
  body: string;
};

type MaxApiMockResponse = {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body: unknown;
};

export const mockMaxApiRequests = (
  respond: (request: MaxApiMockRequest) => MaxApiMockResponse,
): {
  readonly requests: MaxApiMockRequest[];
  readonly restore: () => void;
} => {
  const requests: MaxApiMockRequest[] = [];
  const previousDescriptor = Object.getOwnPropertyDescriptor(https, "request");
  const mockedRequest = ((
    input: string | URL,
    options: { readonly method?: string; readonly headers?: HeadersInit },
    callback?: (response: IncomingMessage) => void,
  ) => {
    const requestInfo: MaxApiMockRequest = {
      url: String(input),
      method: options.method ?? "GET",
      authorization: new Headers(options.headers).get("authorization"),
      body: "",
    };
    requests.push(requestInfo);

    const request = new EventEmitter() as EventEmitter & {
      destroy: () => EventEmitter;
      end: (chunk?: string | Uint8Array) => EventEmitter;
      setTimeout: () => EventEmitter;
      write: (chunk: string | Uint8Array) => boolean;
    };
    Object.assign(request, {
      destroy: () => request,
      end: (chunk?: string | Uint8Array) => {
        if (chunk) {
          requestInfo.body +=
            typeof chunk === "string"
              ? chunk
              : Buffer.from(chunk).toString("utf8");
        }
        const result = respond(requestInfo);
        const response = Object.assign(new EventEmitter(), {
          statusCode: result.status ?? 200,
          headers: result.headers ?? {},
        });
        callback?.(response as unknown as IncomingMessage);
        response.emit("data", Buffer.from(JSON.stringify(result.body)));
        response.emit("end");
        return request;
      },
      setTimeout: () => request,
      write: (chunk: string | Uint8Array) => {
        requestInfo.body +=
          typeof chunk === "string"
            ? chunk
            : Buffer.from(chunk).toString("utf8");
        return true;
      },
    });

    return request as unknown as ClientRequest;
  }) as unknown as typeof https.request;

  Object.defineProperty(https, "request", {
    configurable: true,
    value: mockedRequest,
    writable: true,
  });

  return {
    requests,
    restore: () => {
      if (previousDescriptor) {
        Object.defineProperty(https, "request", previousDescriptor);
      }
    },
  };
};
