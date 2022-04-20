import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { JwtAuthGuard } from "./jwt/jwtAuth.guard";

export class DefaultAuthGuard extends JwtAuthGuard {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let parentCanActivate = false;

    try {
      parentCanActivate = (await super.canActivate(context)) as boolean;
    } catch (err) {
      parentCanActivate = false;
    }

    const isPublic = this.reflector?.get<boolean>(
      IS_PUBLIC_KEY,
      context.getHandler()
    );

    return isPublic || parentCanActivate;
  }
}
