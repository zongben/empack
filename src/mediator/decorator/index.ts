import { Newable } from "../../di";
import { MEDIATOR_KEY } from "../mediator";

export function HandleFor<TReq>(
  req: new (...args: any[]) => TReq,
): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(MEDIATOR_KEY.handlerFor, req, target);
  };
}

export function Subscribe(event: Newable): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(MEDIATOR_KEY.subscribe, event, target);
  };
}
