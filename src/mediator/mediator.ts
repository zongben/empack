import { Container, inject, injectable, Newable } from "inversify";
import { IPublisher, IReqHandler, IRequest, ISender, ISenderSymbol } from ".";
import { EventMap, MediatorMap } from "./types";

export const MEDIATOR_KEY = {
  handlerFor: Symbol.for("empack:handleFor"),
  subscribe: Symbol.for("empack:subscribeTo"),
};

export abstract class MediatedController {
  @inject(ISenderSymbol) private readonly _sender!: ISender;

  async dispatch<
    TReq extends IRequest<TRes>,
    TRes = TReq extends IRequest<infer R> ? R : never,
  >(req: TReq): Promise<TRes> {
    return await this._sender.send(req);
  }
}

@injectable()
export abstract class MediatorPipe {
  abstract handle(req: any, next: any): Promise<any>;
}

export abstract class Request<TResult> implements IRequest<TResult> {
  __TYPE_ASSERT?: TResult;
}

export class Mediator implements ISender, IPublisher {
  constructor(
    private readonly container: Container,
    private readonly mediatorMap: MediatorMap,
    private readonly eventMap: EventMap,
    private readonly pipeline?: {
      pre?: Newable<MediatorPipe>[];
      post?: Newable<MediatorPipe>[];
    },
  ) {}

  private async processPipeline<T>(
    input: T,
    pipelines?: Newable<MediatorPipe>[],
  ): Promise<T> {
    let index = 0;
    const next = async (pipe: T): Promise<T> => {
      if (pipelines && index < pipelines.length) {
        const PipelineClass = pipelines[index++];
        const pipeline = await this.container.getAsync(PipelineClass);
        return await pipeline.handle(pipe, (nextInput: T) => next(nextInput));
      }
      return pipe;
    };
    return await next(input);
  }

  async send<TRes>(req: any): Promise<TRes> {
    const handler = this.mediatorMap.get(req.constructor) as new (
      ...args: any[]
    ) => IReqHandler<any, TRes>;
    if (!handler) {
      throw new Error("handler not found");
    }

    return await this.processPipeline(req, this.pipeline?.pre)
      .then((input) => this.container.get(handler).handle(input))
      .then((output) => this.processPipeline(output, this.pipeline?.post));
  }

  async publish<T extends object>(event: T): Promise<void> {
    const handlers = this.eventMap.get(event.constructor) ?? [];
    await Promise.all(
      handlers.map(async (HandlerClass: any) => {
        const instance: any = await this.container.getAsync(HandlerClass);
        await instance.handle(event);
      }),
    );
  }
}
