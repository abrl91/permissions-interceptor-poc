import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';
import { InjectRolesBuilder, Permission, RolesBuilder } from 'nest-access-control';
import { Reflector } from '@nestjs/core';
import * as abacUtil from "../auth/abac.util";
import * as errors from "../errors";
import { ForbiddenException } from "../errors";
import { IS_PUBLIC_KEY } from "src/decorators/public.decorator";


// export interface Response<T> {
//     data: T;
// }

@Injectable()
export class PermissionsInterceptor<T> implements NestInterceptor {
    constructor(
        @InjectRolesBuilder() private readonly rolesBuilder: RolesBuilder, 
        private readonly reflector: Reflector
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const isPublic = this.reflector.get<boolean>(
            IS_PUBLIC_KEY,
            context.getHandler()
        );

        if (!isPublic) {
            const [permissionsRoles]: any = this.reflector.getAllAndMerge<string[]>('roles', [
                context.getHandler(),
                context.getClass(),
              ]);
    
            const { route } = context.switchToHttp().getRequest();
    
            const permission = this.rolesBuilder.permission({
                role: permissionsRoles.role,
                action: permissionsRoles.action,
                possession: permissionsRoles.possession,
                resource: permissionsRoles.resource,
              });
            
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

        return next.handle();
        
    }

    /**
     * @param url: string, the rout path
     * @param action: string, crud operation (create/read/update/delete)
     * @param resource: string, the entity
     * @param userRoles: string[], array of the user roles (string)
     * @param permission: Permission the permissions by resource and role
     * @param data: any (depends on the resource), the return value from the route handler
     * @returns data[] (find many) | data (find one) | void (delete operations return void)
     */
    private mapPermissionsByAction(
        url: string,
        action: string, 
        resource: string, 
        userRoles: string[], 
        permission: Permission, 
        data: any): any | any[] | void  {
        let invalidAttributes;
        console.log({data}, 'no filter');
        switch (action) {
            case 'read':
                if (Array.isArray(data)) {
                    console.log(data.map((results: T) => permission.filter(results)), 'find many filtered');
                    return data.map((results: T) => permission.filter(results))    
                } else {
                    console.log(permission.filter(data), 'find one filtered');
                   return permission.filter(data);
                }
            case 'crete':
                invalidAttributes = abacUtil.getInvalidAttributes(permission, data);
                if (invalidAttributes.length) {
                    const properties = invalidAttributes
                        .map((attribute: string) => JSON.stringify(attribute))
                        .join(", ");
                    const roles = userRoles
                        .map((role: string) => JSON.stringify(role))
                        .join(",");
                    throw new errors.ForbiddenException(
                        `providing the properties: ${properties} on ${resource} ${action} is forbidden for roles: ${roles}`
                    );
                }
                return data;
            case 'update':
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
                console.log('will get here if simple delete');
                if (invalidAttributes.length && this.checkRequestUrlNested(url)) {
                    console.log('will get here if nested delete');
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
