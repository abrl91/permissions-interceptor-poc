import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';
import { InjectRolesBuilder, Permission, RolesBuilder } from 'nest-access-control';
import { Reflector } from '@nestjs/core';
import * as abacUtil from "../auth/abac.util";
import * as errors from "../errors";
import { ForbiddenException } from "../errors";


export interface Response<T> {
    data: T;
}

@Injectable()
export class PermissionsInterceptor<T> implements NestInterceptor<T, Response<T>> {
    constructor(@InjectRolesBuilder() private readonly rolesBuilder: RolesBuilder, 
    private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
        const [permissionsRoles]: any = this.reflector.getAllAndMerge<string[]>('roles', [
            context.getHandler(),
            context.getClass(),
          ]);

          const { route } = context.switchToHttp().getRequest();
          console.log(this.rolesBuilder.getResources())

        const permission = this.rolesBuilder.permission({
            role: permissionsRoles.role,
            action: permissionsRoles.action,
            possession: permissionsRoles.possession,
            resource: permissionsRoles.resource,
          });

        console.log(permission, 'permissions from interceptor');
        
        return next.handle().pipe(
            map((data) => {
                return this.mapPermissionsByAction(
                    route.path,
                    permissionsRoles.action,
                    permissionsRoles.resource,
                    permissionsRoles.role,
                    permission,
                    data
                )
            })
        )
    }

    private mapPermissionsByAction(
        url: string,
        action: string, 
        resource: string, 
        userRoles: string[], 
        permission: Permission, 
        data: T) {
        let invalidAttributes;
        switch (action) {
            case 'read':
                if (Array.isArray(data)) {
                    console.log(data.map((results: T) => permission.filter(results)), 'filtered from interceptor');
                    return data.map((results: T) => permission.filter(results))    
                } else {
                   return permission.filter(data);
                }
            case 'crete' || 'update':
                invalidAttributes = abacUtil.getInvalidAttributes(permission, data);
                if (invalidAttributes.length) {
                    if (!this.checkRequestUrlNested(url)) {
                        const properties = invalidAttributes
                            .map((attribute: string) => JSON.stringify(attribute))
                            .join(", ");
                        const roles = userRoles
                            .map((role: string) => JSON.stringify(role))
                            .join(",");
                        throw new errors.ForbiddenException(
                            `providing the properties: ${properties} on ${resource} ${action} is forbidden for roles: ${roles}`
                        );
                    } else {
                        const roles = userRoles
                        .map((role: string) => JSON.stringify(role))
                        .join(",");
                      throw new ForbiddenException(
                        `Updating the relationship: ${
                          invalidAttributes[0]
                        } of ${resource} is forbidden for roles: ${roles}`
                      );
                    }
                }
                return data;
                case 'delete':
                    invalidAttributes = abacUtil.getInvalidAttributes(permission, data);
                    if (invalidAttributes.length && this.checkRequestUrlNested(url)) {
                      const roles = userRoles
                        .map((role: string) => JSON.stringify(role))
                        .join(",");
                      throw new ForbiddenException(
                        `Updating the relationship: ${
                          invalidAttributes[0]
                        } of ${"Order"} is forbidden for roles: ${roles}`
                      );
                    }
        }
    }

    /**
     * 
     * @param url string
     * check if url contains /:id/
     * if so - we need to handle the invalid attributed differently
     */
    private checkRequestUrlNested(url: string): boolean {
        return !!url.match('\/:id\/');
    }
  }

